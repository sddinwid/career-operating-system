import { randomUUID } from "node:crypto";
import {
  MatchReportRunStatus,
  Prisma,
  PrismaClient,
  StructuredResumeVersionStatus
} from "@prisma/client";
import {
  canonicalCareerKnowledgeContractSchema,
  type CanonicalCareerKnowledgeContract
} from "@/lib/career/contracts";
import { getCareerProfileVersionById } from "@/lib/career/service";
import { prisma } from "@/lib/prisma";
import {
  RESUME_PLANNING_CONFIGURATION_VERSION,
  RESUME_PLANNING_ENGINE_VERSION,
  STRUCTURED_RESUME_CONTRACT_VERSION,
  structuredResumeConfiguration
} from "@/lib/structured-resume/config";
import {
  structuredResumePlanSchema,
  type StructuredResumePlan
} from "@/lib/structured-resume/contract";
import { buildStructuredResumePlan } from "@/lib/structured-resume/engine";
import {
  getMatchReportContext,
  getMatchReportRunById,
  parseStoredMatchReportRun
} from "@/lib/match-report/service";

type TransactionClient = Prisma.TransactionClient;

type CreateStructuredResumeOptions = {
  matchReportRunId: string;
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
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`
    )
    .join(",")}}`;
}

async function computeSha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeStructuredResumeInputChecksum(args: {
  matchReportRunId: string;
  matchReportInputChecksum: string;
  careerProfileVersionId: string;
  careerSourceChecksum: string;
  planningConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      matchReportRunId: args.matchReportRunId,
      matchReportInputChecksum: args.matchReportInputChecksum,
      careerProfileVersionId: args.careerProfileVersionId,
      careerSourceChecksum: args.careerSourceChecksum,
      structuredResumeContractVersion: STRUCTURED_RESUME_CONTRACT_VERSION,
      resumePlanningEngineVersion: RESUME_PLANNING_ENGINE_VERSION,
      resumePlanningConfigurationVersion: RESUME_PLANNING_CONFIGURATION_VERSION,
      planningConfiguration: args.planningConfiguration
    })
  );
}

async function parseStoredPlan(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The structured resume plan is missing.");
  }

  return structuredResumePlanSchema.parse(value);
}

function parseCareerContent(value: Prisma.JsonValue): CanonicalCareerKnowledgeContract {
  return canonicalCareerKnowledgeContractSchema.parse(value);
}

export async function getStructuredResumeVersionById(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.structuredResumeVersion.findFirst({
    where: {
      id: versionId,
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
      evidenceRetrievalRun: true,
      evidenceScoringRun: true,
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
      predecessorVersion: {
        select: {
          id: true,
          createdAt: true,
          status: true
        }
      },
      requirementAnalysis: true
    }
  });
}

export async function getLatestReusableStructuredResumeVersion(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.structuredResumeVersion.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [
          StructuredResumeVersionStatus.READY,
          StructuredResumeVersionStatus.READY_WITH_LIMITATIONS,
          StructuredResumeVersionStatus.NEEDS_REVIEW
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestStructuredResumeVersionForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.structuredResumeVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        in: [
          StructuredResumeVersionStatus.READY,
          StructuredResumeVersionStatus.READY_WITH_LIMITATIONS,
          StructuredResumeVersionStatus.NEEDS_REVIEW
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getStructuredResumeContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const reportContext = await getMatchReportContext(workspaceId, jobDescriptionVersionId, prismaClient);

  if (!reportContext) {
    return null;
  }

  const latestReusableReport = reportContext.reusableMatchReportRun
    ? await getMatchReportRunById(workspaceId, reportContext.reusableMatchReportRun.id, prismaClient)
    : null;

  const latestPlan = latestReusableReport
    ? await getLatestReusableStructuredResumeVersion(
        workspaceId,
        await computeStructuredResumeInputChecksum({
          matchReportRunId: latestReusableReport.id,
          matchReportInputChecksum: latestReusableReport.inputChecksum,
          careerProfileVersionId: latestReusableReport.careerProfileVersionId,
          careerSourceChecksum: latestReusableReport.careerProfileVersion.checksum,
          planningConfiguration: structuredResumeConfiguration
        }),
        prismaClient
      )
    : null;

  const reportSummary =
    reportContext.reusableMatchReportRun?.summary &&
    typeof reportContext.reusableMatchReportRun.summary === "object"
      ? (reportContext.reusableMatchReportRun.summary as { resumeReadinessState?: string })
      : null;

  const planningReady =
    (reportContext.reusableMatchReportRun?.status === MatchReportRunStatus.SUCCESS ||
      reportContext.reusableMatchReportRun?.status ===
        MatchReportRunStatus.SUCCESS_WITH_WARNINGS) &&
    reportSummary?.resumeReadinessState !== "NOT_READY";

  return {
    ...reportContext,
    reusableStructuredResumeVersion: latestPlan,
    planningReady
  };
}

async function createStructuredResumeRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  predecessorVersionId: string | null;
  result: StructuredResumePlan;
  inputChecksum: string;
  matchReportInputChecksum: string;
  careerSourceChecksum: string;
}) {
  return args.transaction.structuredResumeVersion.create({
    data: {
      id: args.result.runId,
      workspaceId: args.workspaceId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      evidenceRetrievalRunId: args.result.evidenceRetrievalRunId,
      evidenceScoringRunId: args.result.evidenceScoringRunId,
      matchReportRunId: args.result.matchReportRunId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      applicationId: args.result.applicationId,
      predecessorVersionId: args.predecessorVersionId,
      contractVersion: STRUCTURED_RESUME_CONTRACT_VERSION,
      engineVersion: RESUME_PLANNING_ENGINE_VERSION,
      configurationVersion: RESUME_PLANNING_CONFIGURATION_VERSION,
      matchReportInputChecksum: args.matchReportInputChecksum,
      careerSourceChecksum: args.careerSourceChecksum,
      inputChecksum: args.inputChecksum,
      status: StructuredResumeVersionStatus[args.result.status],
      plan: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary:
        args.result.status === "FAILED" ? "Structured resume planning failed." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function createStructuredResumePlan(
  workspaceId: string,
  options: CreateStructuredResumeOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const matchReportRun = await getMatchReportRunById(
      workspaceId,
      options.matchReportRunId,
      transaction
    );

    if (!matchReportRun) {
      throw new Error("Match report run not found.");
    }

    if (
      matchReportRun.status !== MatchReportRunStatus.SUCCESS &&
      matchReportRun.status !== MatchReportRunStatus.SUCCESS_WITH_WARNINGS
    ) {
      throw new Error("Only successful match report runs can create structured resume plans.");
    }

    const parsedReport = await parseStoredMatchReportRun(
      workspaceId,
      options.matchReportRunId,
      transaction
    );

    if (parsedReport.result.summary.resumeReadinessState === "NOT_READY") {
      throw new Error("Match reports with NOT_READY resume readiness cannot create structured resume plans.");
    }

    const careerProfileVersion = await getCareerProfileVersionById(
      workspaceId,
      matchReportRun.careerProfileVersionId,
      transaction
    );
    if (!careerProfileVersion) {
      throw new Error("Career profile version not found for structured resume planning.");
    }

    const inputChecksum = await computeStructuredResumeInputChecksum({
      matchReportRunId: matchReportRun.id,
      matchReportInputChecksum: matchReportRun.inputChecksum,
      careerProfileVersionId: careerProfileVersion.id,
      careerSourceChecksum: careerProfileVersion.source.checksum,
      planningConfiguration: structuredResumeConfiguration
    });

    const existing = await getLatestReusableStructuredResumeVersion(
      workspaceId,
      inputChecksum,
      transaction
    );

    if (existing) {
      return {
        version: await getStructuredResumeVersionById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const predecessor = await getLatestStructuredResumeVersionForJobDescription(
      workspaceId,
      matchReportRun.jobDescriptionVersionId,
      transaction
    );

    const result = buildStructuredResumePlan({
      runId: randomUUID(),
      workspaceId,
      matchReportRunId: matchReportRun.id,
      matchReportResult: parsedReport.result,
      careerProfileVersionId: careerProfileVersion.id,
      careerProfileSourceChecksum: careerProfileVersion.source.checksum,
      careerProfileContent: parseCareerContent(careerProfileVersion.content),
      targetCompany: matchReportRun.jobDescriptionVersion.opportunity.company.name,
      targetRole: matchReportRun.jobDescriptionVersion.opportunity.title,
      workArrangement: matchReportRun.jobDescriptionVersion.opportunity.workArrangement,
      location: matchReportRun.jobDescriptionVersion.opportunity.location,
      createdAt: new Date().toISOString(),
      inputChecksum
    });

    await createStructuredResumeRecord({
      transaction,
      workspaceId,
      predecessorVersionId: predecessor?.id ?? null,
      result,
      inputChecksum,
      matchReportInputChecksum: matchReportRun.inputChecksum,
      careerSourceChecksum: careerProfileVersion.source.checksum
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated structured resume persistence failure.");
    }

    return {
      version: await getStructuredResumeVersionById(workspaceId, result.runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredStructuredResumeVersion(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getStructuredResumeVersionById(workspaceId, versionId, prismaClient);
  if (!version) {
    throw new Error("Structured resume version not found.");
  }

  return {
    version,
    plan: await parseStoredPlan(version.plan)
  };
}
