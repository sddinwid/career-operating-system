import { randomUUID } from "node:crypto";
import { CoverLetterAuditRunStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COVER_LETTER_AUDIT_CONFIGURATION_VERSION,
  COVER_LETTER_AUDIT_CONTRACT_VERSION,
  COVER_LETTER_AUDIT_ENGINE_VERSION,
  coverLetterAuditConfiguration
} from "@/lib/cover-letter-audit/config";
import { coverLetterAuditResultSchema } from "@/lib/cover-letter-audit/contract";
import { buildCoverLetterAudit } from "@/lib/cover-letter-audit/engine";
import { parseStoredCoverLetterCompositionVersion } from "@/lib/cover-letter-composition/service";
import {
  createCoverLetterRevisionDraftFromComposition
} from "@/lib/cover-letter-revision/engine";
import {
  getCoverLetterRevisionContext,
  parseStoredCoverLetterRevisionVersion
} from "@/lib/cover-letter-revision/service";

type TransactionClient = Prisma.TransactionClient;
type AuditSourceType = "BASE_COMPOSITION" | "FINALIZED_REVISION";

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

export async function computeCoverLetterAuditInputChecksum(args: {
  sourceType: AuditSourceType;
  coverLetterCompositionVersionId: string;
  coverLetterRevisionVersionId: string | null;
  contentChecksum: string;
  auditConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      sourceType: args.sourceType,
      coverLetterCompositionVersionId: args.coverLetterCompositionVersionId,
      coverLetterRevisionVersionId: args.coverLetterRevisionVersionId,
      contentChecksum: args.contentChecksum,
      coverLetterAuditContractVersion: COVER_LETTER_AUDIT_CONTRACT_VERSION,
      coverLetterAuditEngineVersion: COVER_LETTER_AUDIT_ENGINE_VERSION,
      coverLetterAuditConfigurationVersion: COVER_LETTER_AUDIT_CONFIGURATION_VERSION,
      coverLetterAuditConfiguration: args.auditConfiguration
    })
  );
}

export async function getCoverLetterAuditRunById(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterAuditRun.findFirst({
    where: {
      id: runId,
      workspaceId
    }
  });
}

export async function getLatestReusableCoverLetterAuditRunByInputChecksum(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterAuditRun.findFirst({
    where: {
      workspaceId,
      inputChecksum
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestReusableCoverLetterAuditRun(
  workspaceId: string,
  args: {
    sourceType: AuditSourceType;
    coverLetterCompositionVersionId: string;
    coverLetterRevisionVersionId: string | null;
    contentChecksum: string;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const inputChecksum = await computeCoverLetterAuditInputChecksum({
    sourceType: args.sourceType,
    coverLetterCompositionVersionId: args.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: args.coverLetterRevisionVersionId,
    contentChecksum: args.contentChecksum,
    auditConfiguration: coverLetterAuditConfiguration
  });

  return getLatestReusableCoverLetterAuditRunByInputChecksum(workspaceId, inputChecksum, prismaClient);
}

export async function parseStoredCoverLetterAuditRun(
  workspaceId: string,
  runId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const run = await getCoverLetterAuditRunById(workspaceId, runId, prismaClient);
  if (!run || !run.result) {
    throw new Error("Cover-letter audit run not found.");
  }

  return {
    run,
    result: coverLetterAuditResultSchema.parse(run.result)
  };
}

async function resolveCoverLetterAuditSource(
  workspaceId: string,
  args:
    | { sourceType: "BASE_COMPOSITION"; sourceId: string }
    | { sourceType: "FINALIZED_REVISION"; sourceId: string },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  if (args.sourceType === "BASE_COMPOSITION") {
    const composition = await parseStoredCoverLetterCompositionVersion(workspaceId, args.sourceId, prismaClient);
    const projected = await createCoverLetterRevisionDraftFromComposition({
      composition: composition.content,
      predecessor: null,
      revisionId: composition.version.id,
      createdAt: composition.content.createdAt,
      status: "FINALIZED"
    });

    return {
      sourceType: "BASE_COMPOSITION" as const,
      sourceId: composition.version.id,
      coverLetterCompositionVersionId: composition.version.id,
      coverLetterRevisionVersionId: null,
      contentChecksum: projected.contentChecksum,
      content: projected
    };
  }

  const revision = await parseStoredCoverLetterRevisionVersion(workspaceId, args.sourceId, prismaClient);
  return {
    sourceType: "FINALIZED_REVISION" as const,
    sourceId: revision.version.id,
    coverLetterCompositionVersionId: revision.version.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: revision.version.id,
    contentChecksum: revision.version.contentChecksum,
    content: revision.record.content
  };
}

export async function getCoverLetterAuditContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const revisionContext = await getCoverLetterRevisionContext(workspaceId, jobDescriptionVersionId, prismaClient);
  if (!revisionContext?.baseCompositionVersion) {
    return revisionContext ? { ...revisionContext, auditReady: false, auditSource: null, reusableAuditRun: null } : null;
  }

  const source = revisionContext.latestFinalizedRevision
    ? {
        sourceType: "FINALIZED_REVISION" as const,
        sourceId: revisionContext.latestFinalizedRevision.id,
        coverLetterCompositionVersionId: revisionContext.latestFinalizedRevision.coverLetterCompositionVersionId,
        coverLetterRevisionVersionId: revisionContext.latestFinalizedRevision.id,
        contentChecksum: revisionContext.latestFinalizedRevision.contentChecksum
      }
    : await resolveCoverLetterAuditSource(
        workspaceId,
        {
          sourceType: "BASE_COMPOSITION",
          sourceId: revisionContext.baseCompositionVersion.id
        },
        prismaClient
      );

  return {
    ...revisionContext,
    auditReady: true,
    auditSource: source,
    reusableAuditRun: await getLatestReusableCoverLetterAuditRun(
      workspaceId,
      {
        sourceType: source.sourceType,
        coverLetterCompositionVersionId: source.coverLetterCompositionVersionId,
        coverLetterRevisionVersionId: source.coverLetterRevisionVersionId,
        contentChecksum: source.contentChecksum
      },
      prismaClient
    )
  };
}

export async function runCoverLetterAudit(
  workspaceId: string,
  args:
    | { sourceType: "BASE_COMPOSITION"; sourceId: string }
    | { sourceType: "FINALIZED_REVISION"; sourceId: string },
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const source = await resolveCoverLetterAuditSource(workspaceId, args, transaction);
    const inputChecksum = await computeCoverLetterAuditInputChecksum({
      sourceType: source.sourceType,
      coverLetterCompositionVersionId: source.coverLetterCompositionVersionId,
      coverLetterRevisionVersionId: source.coverLetterRevisionVersionId,
      contentChecksum: source.contentChecksum,
      auditConfiguration: coverLetterAuditConfiguration
    });
    const existing = await getLatestReusableCoverLetterAuditRunByInputChecksum(workspaceId, inputChecksum, transaction);
    if (existing) {
      return {
        run: existing,
        duplicate: true
      };
    }

    const result = buildCoverLetterAudit({
      runId: randomUUID(),
      workspaceId,
      sourceType: source.sourceType,
      revision: source.content,
      inputChecksum
    });

    const run = await transaction.coverLetterAuditRun.create({
      data: {
        id: result.runId,
        workspaceId,
        sourceType: result.sourceType,
        coverLetterRevisionVersionId: result.coverLetterRevisionVersionId ?? undefined,
        coverLetterCompositionVersionId: result.coverLetterCompositionVersionId,
        applicationId: result.applicationId,
        jobOpportunityId: result.jobOpportunityId,
        jobDescriptionVersionId: result.jobDescriptionVersionId,
        careerProfileVersionId: result.careerProfileVersionId,
        requirementAnalysisId: result.requirementAnalysisId,
        evidenceRetrievalRunId: result.evidenceRetrievalRunId,
        evidenceScoringRunId: result.evidenceScoringRunId,
        matchReportRunId: result.matchReportRunId,
        contractVersion: COVER_LETTER_AUDIT_CONTRACT_VERSION,
        engineVersion: COVER_LETTER_AUDIT_ENGINE_VERSION,
        configurationVersion: COVER_LETTER_AUDIT_CONFIGURATION_VERSION,
        contentChecksum: result.contentChecksum,
        inputChecksum: result.inputChecksum,
        status: CoverLetterAuditRunStatus[result.status],
        renderingReadiness: result.renderingReadiness,
        result: result as Prisma.InputJsonValue,
        summary: result.summary as Prisma.InputJsonValue,
        diagnostics: result.diagnostics as Prisma.InputJsonValue,
        errorSummary: result.status === "FAILED" ? "Cover-letter audit blocked approval readiness." : null,
        completedAt: new Date(result.createdAt)
      }
    });

    return {
      run,
      duplicate: false
    };
  });
}
