import { randomUUID } from "node:crypto";
import {
  EvidenceRetrievalRunStatus,
  EvidenceScoringRunStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EVIDENCE_SCORING_CONFIGURATION_VERSION,
  EVIDENCE_SCORING_CONTRACT_VERSION,
  EVIDENCE_SCORING_ENGINE_VERSION,
  evidenceScoringConfiguration
} from "@/lib/evidence-scoring/config";
import {
  evidenceScoringResultSchema,
  type EvidenceScoringResult
} from "@/lib/evidence-scoring/contract";
import { buildEvidenceScoringResult } from "@/lib/evidence-scoring/engine";
import {
  getEvidenceRetrievalContext,
  getEvidenceRetrievalRunById,
  parseStoredEvidenceRetrievalRun
} from "@/lib/evidence-retrieval/service";

type TransactionClient = Prisma.TransactionClient;

export type EvidenceScoringRunDetail = NonNullable<
  Awaited<ReturnType<typeof getEvidenceScoringRunById>>
>;

type ScoreEvidenceOptions = {
  evidenceRetrievalRunId: string;
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

async function computeInputChecksum(args: {
  evidenceRetrievalRunId: string;
  retrievalInputChecksum: string;
  scoringConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      evidenceRetrievalRunId: args.evidenceRetrievalRunId,
      retrievalInputChecksum: args.retrievalInputChecksum,
      scoringContractVersion: EVIDENCE_SCORING_CONTRACT_VERSION,
      scoringEngineVersion: EVIDENCE_SCORING_ENGINE_VERSION,
      scoringConfigurationVersion: EVIDENCE_SCORING_CONFIGURATION_VERSION,
      scoringConfiguration: args.scoringConfiguration
    })
  );
}

async function parseStoredResult(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The evidence scoring result is missing.");
  }

  return evidenceScoringResultSchema.parse(value);
}

export async function getEvidenceScoringRunById(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.evidenceScoringRun.findFirst({
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
      evidenceRetrievalRun: true,
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

export async function getLatestSuccessfulEvidenceScoringRunForInputs(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.evidenceScoringRun.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [EvidenceScoringRunStatus.SUCCESS, EvidenceScoringRunStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getEvidenceScoringContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const retrievalContext = await getEvidenceRetrievalContext(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );

  if (!retrievalContext) {
    return null;
  }

  const scoringRun = retrievalContext.reusableRun
    ? await getLatestSuccessfulEvidenceScoringRunForInputs(
        workspaceId,
        await computeInputChecksum({
          evidenceRetrievalRunId: retrievalContext.reusableRun.id,
          retrievalInputChecksum: retrievalContext.reusableRun.inputChecksum,
          scoringConfiguration: evidenceScoringConfiguration
        }),
        prismaClient
      )
    : null;

  return {
    ...retrievalContext,
    reusableScoringRun: scoringRun,
    scoringReady:
      retrievalContext.reusableRun?.status === EvidenceRetrievalRunStatus.SUCCESS ||
      retrievalContext.reusableRun?.status === EvidenceRetrievalRunStatus.SUCCESS_WITH_WARNINGS
  };
}

async function createScoringRunRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  evidenceRetrievalRunId: string;
  runId: string;
  inputChecksum: string;
  retrievalInputChecksum: string;
  result: EvidenceScoringResult;
}) {
  return args.transaction.evidenceScoringRun.create({
    data: {
      id: args.runId,
      workspaceId: args.workspaceId,
      evidenceRetrievalRunId: args.evidenceRetrievalRunId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      applicationId: args.result.applicationId,
      contractVersion: EVIDENCE_SCORING_CONTRACT_VERSION,
      engineVersion: EVIDENCE_SCORING_ENGINE_VERSION,
      configurationVersion: EVIDENCE_SCORING_CONFIGURATION_VERSION,
      retrievalInputChecksum: args.retrievalInputChecksum,
      inputChecksum: args.inputChecksum,
      status: EvidenceScoringRunStatus[args.result.status],
      result: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary: args.result.status === "FAILED" ? "Evidence scoring failed." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function scoreRetrievedEvidence(
  workspaceId: string,
  options: ScoreEvidenceOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const run = await getEvidenceRetrievalRunById(
      workspaceId,
      options.evidenceRetrievalRunId,
      transaction
    );

    if (!run) {
      throw new Error("Evidence retrieval run not found.");
    }

    if (
      run.status !== EvidenceRetrievalRunStatus.SUCCESS &&
      run.status !== EvidenceRetrievalRunStatus.SUCCESS_WITH_WARNINGS
    ) {
      throw new Error("Only successful evidence retrieval runs can be scored.");
    }

    const parsedRetrieval = await parseStoredEvidenceRetrievalRun(
      workspaceId,
      options.evidenceRetrievalRunId,
      transaction
    );

    const inputChecksum = await computeInputChecksum({
      evidenceRetrievalRunId: run.id,
      retrievalInputChecksum: run.inputChecksum,
      scoringConfiguration: evidenceScoringConfiguration
    });

    const existing = await getLatestSuccessfulEvidenceScoringRunForInputs(
      workspaceId,
      inputChecksum,
      transaction
    );

    if (existing) {
      return {
        run: await getEvidenceScoringRunById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    const result = buildEvidenceScoringResult({
      runId,
      workspaceId,
      evidenceRetrievalRunId: run.id,
      retrievalResult: parsedRetrieval.result,
      createdAt,
      inputChecksum
    });

    await createScoringRunRecord({
      transaction,
      workspaceId,
      evidenceRetrievalRunId: run.id,
      runId,
      inputChecksum,
      retrievalInputChecksum: run.inputChecksum,
      result
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated evidence scoring persistence failure.");
    }

    return {
      run: await getEvidenceScoringRunById(workspaceId, runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredEvidenceScoringRun(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const run = await getEvidenceScoringRunById(workspaceId, runId, prismaClient);
  if (!run) {
    throw new Error("Evidence scoring run not found.");
  }

  return {
    run,
    result: await parseStoredResult(run.result)
  };
}
