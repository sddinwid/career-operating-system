import { randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  ResumeCompositionVersionStatus,
  StructuredResumeVersionStatus
} from "@prisma/client";
import {
  canonicalCareerKnowledgeContractSchema,
  type CanonicalCareerKnowledgeContract
} from "@/lib/career/contracts";
import { getCareerProfileVersionById } from "@/lib/career/service";
import { prisma } from "@/lib/prisma";
import {
  RESUME_COMPOSITION_CONFIGURATION_VERSION,
  RESUME_COMPOSITION_CONTRACT_VERSION,
  RESUME_COMPOSITION_ENGINE_VERSION,
  resumeCompositionConfiguration
} from "@/lib/resume-composition/config";
import {
  resumeCompositionContentSchema,
  type ResumeCompositionContent
} from "@/lib/resume-composition/contract";
import { buildResumeComposition } from "@/lib/resume-composition/engine";
import {
  getStructuredResumeContext,
  getStructuredResumeVersionById,
  parseStoredStructuredResumeVersion
} from "@/lib/structured-resume/service";

type TransactionClient = Prisma.TransactionClient;

type CreateResumeCompositionOptions = {
  structuredResumeVersionId: string;
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

export async function computeResumeCompositionInputChecksum(args: {
  structuredResumeVersionId: string;
  structuredResumeInputChecksum: string;
  careerProfileVersionId: string;
  careerSourceChecksum: string;
  compositionConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      structuredResumeVersionId: args.structuredResumeVersionId,
      structuredResumeInputChecksum: args.structuredResumeInputChecksum,
      careerProfileVersionId: args.careerProfileVersionId,
      careerSourceChecksum: args.careerSourceChecksum,
      resumeCompositionContractVersion: RESUME_COMPOSITION_CONTRACT_VERSION,
      resumeCompositionEngineVersion: RESUME_COMPOSITION_ENGINE_VERSION,
      resumeCompositionConfigurationVersion: RESUME_COMPOSITION_CONFIGURATION_VERSION,
      compositionConfiguration: args.compositionConfiguration
    })
  );
}

function parseCareerContent(value: Prisma.JsonValue): CanonicalCareerKnowledgeContract {
  return canonicalCareerKnowledgeContractSchema.parse(value);
}

async function parseStoredContent(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The composed resume content is missing.");
  }
  return resumeCompositionContentSchema.parse(value);
}

export async function getResumeCompositionVersionById(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeCompositionVersion.findFirst({
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
      requirementAnalysis: true,
      structuredResumeVersion: true
    }
  });
}

export async function getLatestReusableResumeCompositionVersion(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeCompositionVersion.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [
          ResumeCompositionVersionStatus.READY,
          ResumeCompositionVersionStatus.READY_WITH_WARNINGS
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestResumeCompositionVersionForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeCompositionVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        in: [
          ResumeCompositionVersionStatus.READY,
          ResumeCompositionVersionStatus.READY_WITH_WARNINGS,
          ResumeCompositionVersionStatus.NEEDS_REVIEW
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getResumeCompositionContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const planContext = await getStructuredResumeContext(workspaceId, jobDescriptionVersionId, prismaClient);
  if (!planContext) {
    return null;
  }

  const latestPlan =
    planContext.reusableStructuredResumeVersion &&
    await getStructuredResumeVersionById(
      workspaceId,
      planContext.reusableStructuredResumeVersion.id,
      prismaClient
    );

  const reusableComposition =
    latestPlan &&
    latestPlan.status !== StructuredResumeVersionStatus.NEEDS_REVIEW &&
    latestPlan.status !== StructuredResumeVersionStatus.FAILED
      ? await getLatestReusableResumeCompositionVersion(
          workspaceId,
          await computeResumeCompositionInputChecksum({
            structuredResumeVersionId: latestPlan.id,
            structuredResumeInputChecksum: latestPlan.inputChecksum,
            careerProfileVersionId: latestPlan.careerProfileVersionId,
            careerSourceChecksum: latestPlan.careerProfileVersion.checksum,
            compositionConfiguration: resumeCompositionConfiguration
          }),
          prismaClient
        )
      : null;

  const compositionReady = Boolean(
    latestPlan &&
      (latestPlan.status === StructuredResumeVersionStatus.READY ||
        latestPlan.status === StructuredResumeVersionStatus.READY_WITH_LIMITATIONS)
  );

  return {
    ...planContext,
    reusableResumeCompositionVersion: reusableComposition,
    compositionReady
  };
}

async function createResumeCompositionRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  predecessorVersionId: string | null;
  result: ResumeCompositionContent;
  inputChecksum: string;
  structuredResumeInputChecksum: string;
  careerSourceChecksum: string;
}) {
  return args.transaction.resumeCompositionVersion.create({
    data: {
      id: args.result.runId,
      workspaceId: args.workspaceId,
      structuredResumeVersionId: args.result.structuredResumeVersionId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      matchReportRunId: args.result.matchReportRunId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      applicationId: args.result.applicationId,
      predecessorVersionId: args.predecessorVersionId,
      contractVersion: RESUME_COMPOSITION_CONTRACT_VERSION,
      engineVersion: RESUME_COMPOSITION_ENGINE_VERSION,
      configurationVersion: RESUME_COMPOSITION_CONFIGURATION_VERSION,
      structuredResumeInputChecksum: args.structuredResumeInputChecksum,
      careerSourceChecksum: args.careerSourceChecksum,
      inputChecksum: args.inputChecksum,
      status: ResumeCompositionVersionStatus[args.result.status],
      content: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary:
        args.result.status === "FAILED" || args.result.status === "NEEDS_REVIEW"
          ? "Resume composition requires review."
          : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function createResumeComposition(
  workspaceId: string,
  options: CreateResumeCompositionOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const structuredResume = await getStructuredResumeVersionById(
      workspaceId,
      options.structuredResumeVersionId,
      transaction
    );

    if (!structuredResume) {
      throw new Error("Structured resume version not found.");
    }

    if (
      structuredResume.status !== StructuredResumeVersionStatus.READY &&
      structuredResume.status !== StructuredResumeVersionStatus.READY_WITH_LIMITATIONS
    ) {
      throw new Error("Only READY structured resume plans can create deterministic resume compositions.");
    }

    const parsedPlan = await parseStoredStructuredResumeVersion(
      workspaceId,
      structuredResume.id,
      transaction
    );

    const careerProfileVersion = await getCareerProfileVersionById(
      workspaceId,
      structuredResume.careerProfileVersionId,
      transaction
    );

    if (!careerProfileVersion) {
      throw new Error("Career profile version not found for resume composition.");
    }

    const inputChecksum = await computeResumeCompositionInputChecksum({
      structuredResumeVersionId: structuredResume.id,
      structuredResumeInputChecksum: structuredResume.inputChecksum,
      careerProfileVersionId: careerProfileVersion.id,
      careerSourceChecksum: careerProfileVersion.source.checksum,
      compositionConfiguration: resumeCompositionConfiguration
    });

    const existing = await getLatestReusableResumeCompositionVersion(
      workspaceId,
      inputChecksum,
      transaction
    );

    if (existing) {
      return {
        version: await getResumeCompositionVersionById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const predecessor = await getLatestResumeCompositionVersionForJobDescription(
      workspaceId,
      structuredResume.jobDescriptionVersionId,
      transaction
    );

    const result = buildResumeComposition({
      runId: randomUUID(),
      workspaceId,
      structuredResumeVersionId: structuredResume.id,
      structuredResumePlan: parsedPlan.plan,
      careerProfileVersionId: careerProfileVersion.id,
      careerProfileSourceChecksum: careerProfileVersion.source.checksum,
      careerProfileContent: parseCareerContent(careerProfileVersion.content),
      createdAt: new Date().toISOString(),
      inputChecksum
    });

    await createResumeCompositionRecord({
      transaction,
      workspaceId,
      predecessorVersionId: predecessor?.id ?? null,
      result,
      inputChecksum,
      structuredResumeInputChecksum: structuredResume.inputChecksum,
      careerSourceChecksum: careerProfileVersion.source.checksum
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated resume composition persistence failure.");
    }

    return {
      version: await getResumeCompositionVersionById(workspaceId, result.runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredResumeCompositionVersion(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getResumeCompositionVersionById(workspaceId, versionId, prismaClient);
  if (!version) {
    throw new Error("Resume composition version not found.");
  }

  return {
    version,
    content: await parseStoredContent(version.content)
  };
}
