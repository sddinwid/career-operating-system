import { randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  ResumeAuditRunStatus,
  ResumeCompositionVersionStatus
} from "@prisma/client";
import { canonicalCareerKnowledgeContractSchema } from "@/lib/career/contracts";
import { parseStoredMatchReportRun } from "@/lib/match-report/service";
import { prisma } from "@/lib/prisma";
import {
  RESUME_AUDIT_CONFIGURATION_VERSION,
  RESUME_AUDIT_CONTRACT_VERSION,
  RESUME_AUDIT_ENGINE_VERSION,
  resumeAuditConfiguration
} from "@/lib/resume-audit/config";
import {
  resumeAuditResultSchema,
  type ResumeAuditResult
} from "@/lib/resume-audit/contract";
import { buildResumeAudit } from "@/lib/resume-audit/engine";
import { projectResumeRevisionToCompositionContent } from "@/lib/resume-revision/engine";
import {
  getResumeRevisionVersionById,
  markResumeRevisionAudited,
  parseStoredResumeRevisionVersion
} from "@/lib/resume-revision/service";
import {
  getResumeCompositionContext,
  getResumeCompositionVersionById,
  parseStoredResumeCompositionVersion
} from "@/lib/resume-composition/service";
import { parseStoredStructuredResumeVersion } from "@/lib/structured-resume/service";

type TransactionClient = Prisma.TransactionClient;

type RunResumeAuditOptions =
  | {
      resumeCompositionVersionId: string;
      resumeRevisionVersionId?: never;
      simulateFailureAfterCreate?: boolean;
    }
  | {
      resumeCompositionVersionId?: never;
      resumeRevisionVersionId: string;
      simulateFailureAfterCreate?: boolean;
    };

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function computeSha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeResumeAuditInputChecksum(args: {
  resumeCompositionVersionId: string;
  resumeRevisionVersionId?: string | null;
  resumeCompositionInputChecksum: string;
  auditConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      resumeCompositionVersionId: args.resumeCompositionVersionId,
      resumeRevisionVersionId: args.resumeRevisionVersionId ?? null,
      resumeCompositionInputChecksum: args.resumeCompositionInputChecksum,
      resumeAuditContractVersion: RESUME_AUDIT_CONTRACT_VERSION,
      resumeAuditEngineVersion: RESUME_AUDIT_ENGINE_VERSION,
      resumeAuditConfigurationVersion: RESUME_AUDIT_CONFIGURATION_VERSION,
      auditConfiguration: args.auditConfiguration
    })
  );
}

export async function getResumeAuditRunById(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeAuditRun.findFirst({
    where: {
      id: runId,
      workspaceId
    },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          appliedAt: true,
          recordedAt: true
        }
      },
      careerProfileVersion: {
        include: {
          source: {
            select: {
              id: true,
              filename: true,
              checksum: true,
              createdAt: true
            }
          }
        }
      },
      jobDescriptionVersion: {
        include: {
          opportunity: {
            include: {
              company: true
            }
          }
        }
      },
      matchReportRun: true,
      requirementAnalysis: true,
      resumeCompositionVersion: true,
      structuredResumeVersion: true
    }
  });
}

export async function getLatestReusableResumeAuditRun(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeAuditRun.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [
          ResumeAuditRunStatus.PASSED,
          ResumeAuditRunStatus.PASSED_WITH_WARNINGS,
          ResumeAuditRunStatus.NEEDS_REVIEW,
          ResumeAuditRunStatus.FAILED
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function parseStoredResumeAuditRun(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const run = await getResumeAuditRunById(workspaceId, runId, prismaClient);

  if (!run) {
    throw new Error("Resume audit run not found.");
  }

  if (!run.result) {
    throw new Error("The stored resume audit result is missing.");
  }

  return {
    run,
    result: resumeAuditResultSchema.parse(run.result)
  };
}

export async function getResumeAuditContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const compositionContext = await getResumeCompositionContext(workspaceId, jobDescriptionVersionId, prismaClient);

  if (!compositionContext) {
    return null;
  }

  const reusableResumeAuditRun = compositionContext.reusableResumeCompositionVersion
    ? await getLatestReusableResumeAuditRun(
        workspaceId,
        await computeResumeAuditInputChecksum({
          resumeCompositionVersionId: compositionContext.reusableResumeCompositionVersion.id,
          resumeCompositionInputChecksum: compositionContext.reusableResumeCompositionVersion.inputChecksum,
          auditConfiguration: resumeAuditConfiguration
        }),
        prismaClient
      )
    : null;

  return {
    ...compositionContext,
    reusableResumeAuditRun,
    auditReady: Boolean(compositionContext.reusableResumeCompositionVersion)
  };
}

function extractRequestedExperienceYears(text: string) {
  const matches = [...text.matchAll(/(\d+)\+?\s+years?/gi)];
  if (matches.length === 0) {
    return null;
  }

  return Math.max(...matches.map((match) => Number.parseInt(match[1] ?? "0", 10)).filter(Number.isFinite));
}

async function createResumeAuditRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  result: ResumeAuditResult;
}) {
  return args.transaction.resumeAuditRun.create({
    data: {
      id: args.result.runId,
      workspaceId: args.workspaceId,
      resumeCompositionVersionId: args.result.resumeCompositionVersionId,
      resumeRevisionVersionId: args.result.resumeRevisionVersionId,
      structuredResumeVersionId: args.result.structuredResumeVersionId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      matchReportRunId: args.result.matchReportRunId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      applicationId: args.result.applicationId,
      contractVersion: RESUME_AUDIT_CONTRACT_VERSION,
      engineVersion: RESUME_AUDIT_ENGINE_VERSION,
      configurationVersion: RESUME_AUDIT_CONFIGURATION_VERSION,
      resumeCompositionInputChecksum: args.result.resumeCompositionInputChecksum,
      inputChecksum: args.result.inputChecksum,
      status: ResumeAuditRunStatus[args.result.status],
      renderingReadiness: args.result.renderingReadiness,
      result: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary: args.result.status === "FAILED" ? "Resume audit blocked rendering readiness." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function runResumeAudit(
  workspaceId: string,
  options: RunResumeAuditOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const compositionVersionId =
      "resumeCompositionVersionId" in options ? options.resumeCompositionVersionId : undefined;
    const revisionVersion =
      "resumeRevisionVersionId" in options && options.resumeRevisionVersionId
        ? await getResumeRevisionVersionById(workspaceId, options.resumeRevisionVersionId, transaction)
        : null;

    const compositionVersion = revisionVersion
      ? await getResumeCompositionVersionById(
          workspaceId,
          revisionVersion.baseResumeCompositionVersionId,
          transaction
        )
      : await getResumeCompositionVersionById(
          workspaceId,
          compositionVersionId ?? "",
          transaction
        );

    if (!compositionVersion) {
      throw new Error("Resume composition version not found.");
    }

    if (!revisionVersion && (
      compositionVersion.status !== ResumeCompositionVersionStatus.READY &&
      compositionVersion.status !== ResumeCompositionVersionStatus.READY_WITH_WARNINGS &&
      compositionVersion.status !== ResumeCompositionVersionStatus.NEEDS_REVIEW
    )) {
      throw new Error("Only composed resume versions can be audited.");
    }

    const parsedRevision = revisionVersion
      ? await parseStoredResumeRevisionVersion(workspaceId, revisionVersion.id, transaction)
      : null;
    const parsedComposition = revisionVersion
      ? null
      : await parseStoredResumeCompositionVersion(workspaceId, compositionVersion.id, transaction);
    const parsedStructuredResume = await parseStoredStructuredResumeVersion(
      workspaceId,
      compositionVersion.structuredResumeVersionId,
      transaction
    );
    const parsedMatchReport = await parseStoredMatchReportRun(
      workspaceId,
      compositionVersion.matchReportRunId,
      transaction
    );

    const inputChecksum = await computeResumeAuditInputChecksum({
      resumeCompositionVersionId: compositionVersion.id,
      resumeRevisionVersionId: revisionVersion?.id ?? null,
      resumeCompositionInputChecksum: compositionVersion.inputChecksum,
      auditConfiguration: resumeAuditConfiguration
    });

    const existing = await getLatestReusableResumeAuditRun(workspaceId, inputChecksum, transaction);
    if (existing) {
      return {
        run: await getResumeAuditRunById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const maximumRequestedExperienceYears = parsedMatchReport.result.requirementConclusions
      .filter((item) => item.kinds.includes("EXPERIENCE"))
      .reduce<number | null>((current, item) => {
        const extracted = extractRequestedExperienceYears(item.requirementText);
        if (extracted === null) {
          return current;
        }
        return current === null ? extracted : Math.max(current, extracted);
      }, null);

    const result = buildResumeAudit({
      input: {
        runId: randomUUID(),
        workspaceId,
        resumeCompositionVersionId: compositionVersion.id,
        resumeRevisionVersionId: revisionVersion?.id ?? null,
        resumeCompositionInputChecksum: compositionVersion.inputChecksum,
        createdAt: new Date().toISOString(),
        inputChecksum,
        resumeComposition: revisionVersion
          ? projectResumeRevisionToCompositionContent({
              content: parsedRevision!.record.content
            })
          : parsedComposition!.content,
        matchReportClaimsToAvoid: parsedMatchReport.result.resumeGuidance.claimsToAvoid.map(
          (item) => item.concept
        ),
        maximumRequestedExperienceYears
      },
      careerProfile: canonicalCareerKnowledgeContractSchema.parse(compositionVersion.careerProfileVersion.content),
      structuredResumePlan: parsedStructuredResume.plan,
      matchReport: parsedMatchReport.result
    });

    await createResumeAuditRecord({
      transaction,
      workspaceId,
      result
    });

    if (revisionVersion) {
      await markResumeRevisionAudited({
        workspaceId,
        revisionId: revisionVersion.id,
        auditStatus:
          result.renderingReadiness === "BLOCKED" || result.renderingReadiness === "NEEDS_REVIEW"
            ? "NEEDS_REVIEW"
            : "AUDITED",
        prismaClient: transaction
      });
    }

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated resume audit persistence failure.");
    }

    return {
      run: await getResumeAuditRunById(workspaceId, result.runId, transaction),
      duplicate: false
    };
  });
}
