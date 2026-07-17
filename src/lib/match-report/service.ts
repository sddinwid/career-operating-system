import { randomUUID } from "node:crypto";
import {
  EvidenceScoringRunStatus,
  MatchReportRunStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MATCH_REPORT_CONFIGURATION_VERSION,
  MATCH_REPORT_CONTRACT_VERSION,
  MATCH_REPORT_ENGINE_VERSION,
  matchReportConfiguration
} from "@/lib/match-report/config";
import {
  matchReportResultSchema,
  type MatchReportResult
} from "@/lib/match-report/contract";
import { buildMatchReportResult } from "@/lib/match-report/engine";
import {
  getEvidenceScoringContext,
  getEvidenceScoringRunById,
  parseStoredEvidenceScoringRun
} from "@/lib/evidence-scoring/service";

type TransactionClient = Prisma.TransactionClient;

type GenerateMatchReportOptions = {
  evidenceScoringRunId: string;
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

export async function computeMatchReportInputChecksum(args: {
  evidenceScoringRunId: string;
  scoringInputChecksum: string;
  reportConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      evidenceScoringRunId: args.evidenceScoringRunId,
      scoringInputChecksum: args.scoringInputChecksum,
      matchReportContractVersion: MATCH_REPORT_CONTRACT_VERSION,
      matchReportEngineVersion: MATCH_REPORT_ENGINE_VERSION,
      matchReportConfigurationVersion: MATCH_REPORT_CONFIGURATION_VERSION,
      matchReportConfiguration: args.reportConfiguration
    })
  );
}

async function parseStoredResult(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The match report result is missing.");
  }

  return matchReportResultSchema.parse(value);
}

export async function getMatchReportRunById(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.matchReportRun.findFirst({
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
      requirementAnalysis: true
    }
  });
}

export async function getLatestSuccessfulMatchReportRunForInputs(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.matchReportRun.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [MatchReportRunStatus.SUCCESS, MatchReportRunStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getMatchReportContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const scoringContext = await getEvidenceScoringContext(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );

  if (!scoringContext) {
    return null;
  }

  const reportRun = scoringContext.reusableScoringRun
    ? await getLatestSuccessfulMatchReportRunForInputs(
        workspaceId,
        await computeMatchReportInputChecksum({
          evidenceScoringRunId: scoringContext.reusableScoringRun.id,
          scoringInputChecksum: scoringContext.reusableScoringRun.inputChecksum,
          reportConfiguration: matchReportConfiguration
        }),
        prismaClient
      )
    : null;

  return {
    ...scoringContext,
    reusableMatchReportRun: reportRun,
    reportReady:
      scoringContext.reusableScoringRun?.status === EvidenceScoringRunStatus.SUCCESS ||
      scoringContext.reusableScoringRun?.status === EvidenceScoringRunStatus.SUCCESS_WITH_WARNINGS
  };
}

async function createMatchReportRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  evidenceScoringRunId: string;
  inputChecksum: string;
  result: MatchReportResult;
}) {
  return args.transaction.matchReportRun.create({
    data: {
      id: args.result.runId,
      workspaceId: args.workspaceId,
      evidenceScoringRunId: args.evidenceScoringRunId,
      evidenceRetrievalRunId: args.result.evidenceRetrievalRunId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      applicationId: args.result.applicationId,
      contractVersion: MATCH_REPORT_CONTRACT_VERSION,
      engineVersion: MATCH_REPORT_ENGINE_VERSION,
      configurationVersion: MATCH_REPORT_CONFIGURATION_VERSION,
      scoringInputChecksum: args.result.scoringInputChecksum,
      inputChecksum: args.inputChecksum,
      status: MatchReportRunStatus[args.result.status],
      result: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary: args.result.status === "FAILED" ? "Match report generation failed." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function generateMatchReport(
  workspaceId: string,
  options: GenerateMatchReportOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const scoringRun = await getEvidenceScoringRunById(
      workspaceId,
      options.evidenceScoringRunId,
      transaction
    );

    if (!scoringRun) {
      throw new Error("Evidence scoring run not found.");
    }

    if (
      scoringRun.status !== EvidenceScoringRunStatus.SUCCESS &&
      scoringRun.status !== EvidenceScoringRunStatus.SUCCESS_WITH_WARNINGS
    ) {
      throw new Error("Only successful evidence scoring runs can generate match reports.");
    }

    const parsedScoring = await parseStoredEvidenceScoringRun(
      workspaceId,
      options.evidenceScoringRunId,
      transaction
    );

    const inputChecksum = await computeMatchReportInputChecksum({
      evidenceScoringRunId: scoringRun.id,
      scoringInputChecksum: scoringRun.inputChecksum,
      reportConfiguration: matchReportConfiguration
    });

    const existing = await getLatestSuccessfulMatchReportRunForInputs(
      workspaceId,
      inputChecksum,
      transaction
    );

    if (existing) {
      return {
        run: await getMatchReportRunById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    const result = buildMatchReportResult({
      runId,
      workspaceId,
      evidenceScoringRunId: scoringRun.id,
      scoringResult: parsedScoring.result,
      createdAt,
      inputChecksum
    });

    await createMatchReportRecord({
      transaction,
      workspaceId,
      evidenceScoringRunId: scoringRun.id,
      inputChecksum,
      result
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated match report persistence failure.");
    }

    return {
      run: await getMatchReportRunById(workspaceId, runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredMatchReportRun(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const run = await getMatchReportRunById(workspaceId, runId, prismaClient);
  if (!run) {
    throw new Error("Match report run not found.");
  }

  return {
    run,
    result: await parseStoredResult(run.result)
  };
}
