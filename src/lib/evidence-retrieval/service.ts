import { randomUUID } from "node:crypto";
import {
  EvidenceRetrievalRunStatus,
  JobRequirementAnalysisStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertCanonicalCareerKnowledgeContract
} from "@/lib/career/validation";
import { getLatestCareerProfileVersion } from "@/lib/career/service";
import {
  EVIDENCE_RETRIEVAL_CONTRACT_VERSION,
  EVIDENCE_RETRIEVAL_ENGINE_VERSION,
  evidenceRetrievalResultSchema,
  type EvidenceRetrievalResult
} from "@/lib/evidence-retrieval/contract";
import { buildEvidenceRetrievalResult } from "@/lib/evidence-retrieval/engine";

type TransactionClient = Prisma.TransactionClient;

export type EvidenceRetrievalRunDetail = NonNullable<
  Awaited<ReturnType<typeof getEvidenceRetrievalRunById>>
>;

type RetrieveEvidenceOptions = {
  jobDescriptionVersionId: string;
  careerProfileVersionId?: string;
  simulateFailureAfterCreate?: boolean;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
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

async function parseStoredResult(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The evidence retrieval result is missing.");
  }

  return evidenceRetrievalResultSchema.parse(value);
}

export async function getEvidenceRetrievalRunById(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.evidenceRetrievalRun.findFirst({
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
      requirementAnalysis: true
    }
  });
}

export async function getLatestEvidenceRetrievalRunForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.evidenceRetrievalRun.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

async function getLatestSuccessfulEvidenceRetrievalRunForInputs(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient
) {
  return prismaClient.evidenceRetrievalRun.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [EvidenceRetrievalRunStatus.SUCCESS, EvidenceRetrievalRunStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

async function computeInputChecksum(args: {
  careerProfileVersionId: string;
  careerSourceChecksum: string;
  requirementAnalysisId: string;
  requirementSourceChecksum: string;
}) {
  return computeSha256(
    stableSerialize({
      careerProfileVersionId: args.careerProfileVersionId,
      careerSourceChecksum: args.careerSourceChecksum,
      requirementAnalysisId: args.requirementAnalysisId,
      requirementSourceChecksum: args.requirementSourceChecksum,
      retrievalContractVersion: EVIDENCE_RETRIEVAL_CONTRACT_VERSION,
      retrievalEngineVersion: EVIDENCE_RETRIEVAL_ENGINE_VERSION
    })
  );
}

export async function getEvidenceRetrievalContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const [jobDescriptionVersion, latestCareerProfileVersion, latestConfirmedRequirementAnalysis] =
    await Promise.all([
      prismaClient.jobDescriptionVersion.findFirst({
        where: {
          id: jobDescriptionVersionId,
          workspaceId
        },
        include: {
          opportunity: {
            include: {
              company: true
            }
          },
          currentForApplications: {
            select: { id: true, status: true, appliedAt: true, recordedAt: true },
            orderBy: { createdAt: "asc" }
          },
          sourceApplication: {
            select: { id: true, status: true, appliedAt: true, recordedAt: true }
          },
          parses: {
            where: {
              status: {
                in: ["SUCCESS", "SUCCESS_WITH_WARNINGS"]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1
          }
        }
      }),
      getLatestCareerProfileVersion(workspaceId, prismaClient),
      prismaClient.jobRequirementAnalysis.findFirst({
        where: {
          workspaceId,
          jobDescriptionVersionId,
          status: JobRequirementAnalysisStatus.CONFIRMED
        },
        orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
      })
    ]);

  if (!jobDescriptionVersion) {
    return null;
  }

  const activeApplication =
    jobDescriptionVersion.currentForApplications[0] ?? jobDescriptionVersion.sourceApplication;

  let reusableRun = null;
  if (latestCareerProfileVersion && latestConfirmedRequirementAnalysis) {
    const inputChecksum = await computeInputChecksum({
      careerProfileVersionId: latestCareerProfileVersion.id,
      careerSourceChecksum: latestCareerProfileVersion.checksum,
      requirementAnalysisId: latestConfirmedRequirementAnalysis.id,
      requirementSourceChecksum: latestConfirmedRequirementAnalysis.sourceChecksum
    });
    reusableRun = await getLatestSuccessfulEvidenceRetrievalRunForInputs(
      workspaceId,
      inputChecksum,
      prismaClient
    );
  }

  return {
    jobDescriptionVersion,
    latestCareerProfileVersion,
    latestConfirmedRequirementAnalysis,
    activeApplication,
    reusableRun
  };
}

async function createRetrievalRunRecord(args: {
  transaction: TransactionClient;
  runId: string;
  workspaceId: string;
  careerProfileVersionId: string;
  requirementAnalysisId: string;
  jobDescriptionVersionId: string;
  applicationId: string | null;
  inputChecksum: string;
  careerSourceChecksum: string;
  requirementSourceChecksum: string;
  result: EvidenceRetrievalResult;
}) {
  return args.transaction.evidenceRetrievalRun.create({
    data: {
      id: args.runId,
      workspaceId: args.workspaceId,
      careerProfileVersionId: args.careerProfileVersionId,
      requirementAnalysisId: args.requirementAnalysisId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId,
      contractVersion: EVIDENCE_RETRIEVAL_CONTRACT_VERSION,
      engineVersion: EVIDENCE_RETRIEVAL_ENGINE_VERSION,
      inputChecksum: args.inputChecksum,
      careerSourceChecksum: args.careerSourceChecksum,
      requirementSourceChecksum: args.requirementSourceChecksum,
      status: EvidenceRetrievalRunStatus[args.result.status],
      result: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary: args.result.status === "FAILED" ? "Evidence retrieval failed." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function retrieveCareerEvidence(
  workspaceId: string,
  options: RetrieveEvidenceOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const context = await getEvidenceRetrievalContext(
      workspaceId,
      options.jobDescriptionVersionId,
      transaction as unknown as PrismaClient
    );

    if (!context) {
      throw new Error("Job description version not found.");
    }

    if (!context.latestConfirmedRequirementAnalysis) {
      throw new Error("A confirmed requirement analysis is required before retrieving evidence.");
    }

    const careerProfileVersion = options.careerProfileVersionId
      ? await transaction.careerProfileVersion.findFirst({
          where: {
            id: options.careerProfileVersionId,
            workspaceId
          },
          include: {
            source: true
          }
        })
      : context.latestCareerProfileVersion;

    if (!careerProfileVersion) {
      throw new Error("An active career profile version is required before retrieving evidence.");
    }

    assertCanonicalCareerKnowledgeContract(careerProfileVersion.content);
    const inputChecksum = await computeInputChecksum({
      careerProfileVersionId: careerProfileVersion.id,
      careerSourceChecksum: careerProfileVersion.checksum,
      requirementAnalysisId: context.latestConfirmedRequirementAnalysis.id,
      requirementSourceChecksum: context.latestConfirmedRequirementAnalysis.sourceChecksum
    });

    const existing = await getLatestSuccessfulEvidenceRetrievalRunForInputs(
      workspaceId,
      inputChecksum,
      transaction
    );
    if (existing) {
      return {
        run: await getEvidenceRetrievalRunById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const createdAt = new Date().toISOString();
    const runId = randomUUID();
    const result = buildEvidenceRetrievalResult({
      runId,
      workspaceId,
      careerProfileVersion: {
        id: careerProfileVersion.id,
        checksum: careerProfileVersion.checksum,
        content: careerProfileVersion.content
      },
      requirementAnalysisRecord: {
        id: context.latestConfirmedRequirementAnalysis.id,
        jobDescriptionVersionId: context.latestConfirmedRequirementAnalysis.jobDescriptionVersionId,
        sourceChecksum: context.latestConfirmedRequirementAnalysis.sourceChecksum,
        status: context.latestConfirmedRequirementAnalysis.status,
        analysis: context.latestConfirmedRequirementAnalysis.analysis
      },
      applicationId: context.activeApplication?.id ?? null,
      createdAt,
      inputChecksum
    });

    await createRetrievalRunRecord({
      transaction,
      runId,
      workspaceId,
      careerProfileVersionId: careerProfileVersion.id,
      requirementAnalysisId: context.latestConfirmedRequirementAnalysis.id,
      jobDescriptionVersionId: context.jobDescriptionVersion.id,
      applicationId: context.activeApplication?.id ?? null,
      inputChecksum,
      careerSourceChecksum: careerProfileVersion.checksum,
      requirementSourceChecksum: context.latestConfirmedRequirementAnalysis.sourceChecksum,
      result
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated evidence retrieval persistence failure.");
    }

    return {
      run: await getEvidenceRetrievalRunById(workspaceId, runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredEvidenceRetrievalRun(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const run = await getEvidenceRetrievalRunById(workspaceId, runId, prismaClient);

  if (!run) {
    throw new Error("Evidence retrieval run not found.");
  }

  return {
    run,
    result: await parseStoredResult(run.result)
  };
}
