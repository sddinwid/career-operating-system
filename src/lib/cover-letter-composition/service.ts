import { randomUUID } from "node:crypto";
import {
  CoverLetterCompositionVersionStatus,
  MatchReportRunStatus,
  Prisma,
  PrismaClient,
  ResumeCompositionVersionStatus,
  ResumeRevisionVersionStatus
} from "@prisma/client";
import {
  canonicalCareerKnowledgeContractSchema,
  type CanonicalCareerKnowledgeContract
} from "@/lib/career/contracts";
import { getCareerProfileVersionById } from "@/lib/career/service";
import { prisma } from "@/lib/prisma";
import {
  COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
  COVER_LETTER_COMPOSITION_CONTRACT_VERSION,
  COVER_LETTER_COMPOSITION_ENGINE_VERSION,
  coverLetterCompositionConfiguration
} from "@/lib/cover-letter-composition/config";
import {
  coverLetterCompositionContentSchema,
  type CoverLetterCompositionContent
} from "@/lib/cover-letter-composition/contract";
import { buildCoverLetterComposition } from "@/lib/cover-letter-composition/engine";
import { getEvidenceRetrievalRunById, parseStoredEvidenceRetrievalRun } from "@/lib/evidence-retrieval/service";
import { getEvidenceScoringRunById, parseStoredEvidenceScoringRun } from "@/lib/evidence-scoring/service";
import {
  getJobRequirementAnalysisById,
  parseStoredJobRequirementAnalysis
} from "@/lib/job-descriptions/requirement-analysis-service";
import { getMatchReportContext, getMatchReportRunById, parseStoredMatchReportRun } from "@/lib/match-report/service";
import { getLatestResumeCompositionVersionForJobDescription, parseStoredResumeCompositionVersion } from "@/lib/resume-composition/service";
import { getLatestFinalizedResumeRevisionForJobDescription, parseStoredResumeRevisionVersion } from "@/lib/resume-revision/service";

type TransactionClient = Prisma.TransactionClient;

type CreateCoverLetterCompositionOptions = {
  matchReportRunId: string;
  resumeSource?:
    | {
        sourceType: "BASE_COMPOSITION";
        sourceId: string;
      }
    | {
        sourceType: "FINALIZED_REVISION";
        sourceId: string;
      }
    | null;
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

function parseCareerContent(value: Prisma.JsonValue): CanonicalCareerKnowledgeContract {
  return canonicalCareerKnowledgeContractSchema.parse(value);
}

async function parseStoredContent(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The cover-letter composition content is missing.");
  }

  return coverLetterCompositionContentSchema.parse(value);
}

function resumeCompositionToPlainText(content: Awaited<
  ReturnType<typeof parseStoredResumeCompositionVersion>
>["content"]) {
  return [
    content.professionalSummary.text,
    ...content.professionalExperience.flatMap((role) => role.bullets.map((bullet) => bullet.text)),
    ...content.selectedProjects.flatMap((project) => project.bullets.map((bullet) => bullet.text))
  ].join(" ");
}

function resumeRevisionToPlainText(record: Awaited<
  ReturnType<typeof parseStoredResumeRevisionVersion>
>["record"]) {
  return [
    record.content.professionalSummary.currentText,
    ...record.content.professionalExperience.flatMap((role) =>
      role.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.currentText)
    ),
    ...record.content.selectedProjects.flatMap((project) =>
      project.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.currentText)
    )
  ]
    .filter(Boolean)
    .join(" ");
}

export async function computeCoverLetterCompositionInputChecksum(args: {
  matchReportRunId: string;
  matchReportInputChecksum: string;
  careerProfileVersionId: string;
  careerSourceChecksum: string;
  resumeSource:
    | {
        sourceType: "BASE_COMPOSITION" | "FINALIZED_REVISION";
        sourceId: string;
        sourceInputChecksum: string;
      }
    | null;
  compositionConfiguration: unknown;
}) {
  return computeSha256(
    stableSerialize({
      matchReportRunId: args.matchReportRunId,
      matchReportInputChecksum: args.matchReportInputChecksum,
      careerProfileVersionId: args.careerProfileVersionId,
      careerSourceChecksum: args.careerSourceChecksum,
      resumeSource: args.resumeSource,
      coverLetterCompositionContractVersion: COVER_LETTER_COMPOSITION_CONTRACT_VERSION,
      coverLetterCompositionEngineVersion: COVER_LETTER_COMPOSITION_ENGINE_VERSION,
      coverLetterCompositionConfigurationVersion: COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
      coverLetterCompositionConfiguration: args.compositionConfiguration
    })
  );
}

export async function getCoverLetterCompositionVersionById(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterCompositionVersion.findFirst({
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
      jobOpportunity: {
        include: {
          company: true
        }
      },
      matchReportRun: true,
      predecessor: {
        select: {
          id: true,
          createdAt: true,
          status: true
        }
      },
      requirementAnalysis: true,
      resumeCompositionVersion: true,
      resumeRevisionVersion: true
    }
  });
}

export async function getLatestReusableCoverLetterCompositionVersion(
  workspaceId: string,
  inputChecksum: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterCompositionVersion.findFirst({
    where: {
      workspaceId,
      inputChecksum,
      status: {
        in: [
          CoverLetterCompositionVersionStatus.SUCCESS,
          CoverLetterCompositionVersionStatus.SUCCESS_WITH_WARNINGS
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestCoverLetterCompositionVersionForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterCompositionVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        in: [
          CoverLetterCompositionVersionStatus.SUCCESS,
          CoverLetterCompositionVersionStatus.SUCCESS_WITH_WARNINGS
        ]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

async function resolveResumeSource(
  workspaceId: string,
  jobDescriptionVersionId: string,
  explicitSource: CreateCoverLetterCompositionOptions["resumeSource"] | undefined,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  if (explicitSource?.sourceType === "FINALIZED_REVISION") {
    const revision = await parseStoredResumeRevisionVersion(workspaceId, explicitSource.sourceId, prismaClient);
    if (revision.version.status !== ResumeRevisionVersionStatus.AUDITED &&
        revision.version.status !== ResumeRevisionVersionStatus.READY_FOR_AUDIT &&
        revision.version.status !== ResumeRevisionVersionStatus.NEEDS_REVIEW) {
      throw new Error("Only finalized resume revisions can be used as cover-letter sources.");
    }

    return {
      sourceType: "FINALIZED_REVISION" as const,
      sourceId: revision.version.id,
      sourceInputChecksum: revision.version.inputChecksum,
      plainText: resumeRevisionToPlainText(revision.record)
    };
  }

  if (explicitSource?.sourceType === "BASE_COMPOSITION") {
    const composition = await parseStoredResumeCompositionVersion(
      workspaceId,
      explicitSource.sourceId,
      prismaClient
    );
    if (
      composition.version.status !== ResumeCompositionVersionStatus.READY &&
      composition.version.status !== ResumeCompositionVersionStatus.READY_WITH_WARNINGS
    ) {
      throw new Error("Only successful resume compositions can be used as cover-letter sources.");
    }

    return {
      sourceType: "BASE_COMPOSITION" as const,
      sourceId: composition.version.id,
      sourceInputChecksum: composition.version.inputChecksum,
      plainText: resumeCompositionToPlainText(composition.content)
    };
  }

  const latestFinalizedRevision = await getLatestFinalizedResumeRevisionForJobDescription(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );
  if (latestFinalizedRevision) {
    const revision = await parseStoredResumeRevisionVersion(
      workspaceId,
      latestFinalizedRevision.id,
      prismaClient
    );

    return {
      sourceType: "FINALIZED_REVISION" as const,
      sourceId: revision.version.id,
      sourceInputChecksum: revision.version.inputChecksum,
      plainText: resumeRevisionToPlainText(revision.record)
    };
  }

  const latestComposition = await getLatestResumeCompositionVersionForJobDescription(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );
  if (!latestComposition) {
    return null;
  }

  const composition = await parseStoredResumeCompositionVersion(
    workspaceId,
    latestComposition.id,
    prismaClient
  );
  return {
    sourceType: "BASE_COMPOSITION" as const,
    sourceId: composition.version.id,
    sourceInputChecksum: composition.version.inputChecksum,
    plainText: resumeCompositionToPlainText(composition.content)
  };
}

export async function getCoverLetterCompositionContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const reportContext = await getMatchReportContext(workspaceId, jobDescriptionVersionId, prismaClient);
  if (!reportContext?.reusableMatchReportRun) {
    return null;
  }

  const reportRun = await getMatchReportRunById(
    workspaceId,
    reportContext.reusableMatchReportRun.id,
    prismaClient
  );
  if (!reportRun) {
    return null;
  }

  const preferredResumeSource = await resolveResumeSource(
    workspaceId,
    jobDescriptionVersionId,
    null,
    prismaClient
  );
  const reusableCoverLetter =
    reportRun.status === MatchReportRunStatus.SUCCESS ||
    reportRun.status === MatchReportRunStatus.SUCCESS_WITH_WARNINGS
      ? await getLatestReusableCoverLetterCompositionVersion(
          workspaceId,
          await computeCoverLetterCompositionInputChecksum({
            matchReportRunId: reportRun.id,
            matchReportInputChecksum: reportRun.inputChecksum,
            careerProfileVersionId: reportRun.careerProfileVersionId,
            careerSourceChecksum: reportRun.careerProfileVersion.checksum,
            resumeSource: preferredResumeSource
              ? {
                  sourceType: preferredResumeSource.sourceType,
                  sourceId: preferredResumeSource.sourceId,
                  sourceInputChecksum: preferredResumeSource.sourceInputChecksum
                }
              : null,
            compositionConfiguration: coverLetterCompositionConfiguration
          }),
          prismaClient
        )
      : null;

  return {
    ...reportContext,
    preferredResumeSource,
    reusableCoverLetterCompositionVersion: reusableCoverLetter,
    compositionReady:
      reportRun.status === MatchReportRunStatus.SUCCESS ||
      reportRun.status === MatchReportRunStatus.SUCCESS_WITH_WARNINGS
  };
}

async function createCoverLetterCompositionRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  predecessorId: string | null;
  result: CoverLetterCompositionContent;
  inputChecksum: string;
  matchReportInputChecksum: string;
  careerSourceChecksum: string;
  resumeSourceInputChecksum: string | null;
}) {
  return args.transaction.coverLetterCompositionVersion.create({
    data: {
      id: args.result.runId,
      workspaceId: args.workspaceId,
      applicationId: args.result.applicationId,
      jobOpportunityId: args.result.jobOpportunityId,
      jobDescriptionVersionId: args.result.jobDescriptionVersionId,
      careerProfileVersionId: args.result.careerProfileVersionId,
      requirementAnalysisId: args.result.requirementAnalysisId,
      evidenceRetrievalRunId: args.result.evidenceRetrievalRunId,
      evidenceScoringRunId: args.result.evidenceScoringRunId,
      matchReportRunId: args.result.matchReportRunId,
      resumeCompositionVersionId: args.result.resumeCompositionVersionId,
      resumeRevisionVersionId: args.result.resumeRevisionVersionId,
      predecessorId: args.predecessorId,
      contractVersion: COVER_LETTER_COMPOSITION_CONTRACT_VERSION,
      engineVersion: COVER_LETTER_COMPOSITION_ENGINE_VERSION,
      configurationVersion: COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
      matchReportInputChecksum: args.matchReportInputChecksum,
      careerSourceChecksum: args.careerSourceChecksum,
      resumeSourceInputChecksum: args.resumeSourceInputChecksum,
      inputChecksum: args.inputChecksum,
      status: CoverLetterCompositionVersionStatus[args.result.status],
      content: args.result as Prisma.InputJsonValue,
      summary: args.result.summary as Prisma.InputJsonValue,
      diagnostics: args.result.diagnostics as Prisma.InputJsonValue,
      errorSummary:
        args.result.status === "FAILED" ? "Cover-letter composition requires review." : null,
      completedAt: new Date(args.result.createdAt)
    }
  });
}

export async function createCoverLetterComposition(
  workspaceId: string,
  options: CreateCoverLetterCompositionOptions,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const matchReportRun = await getMatchReportRunById(workspaceId, options.matchReportRunId, transaction);
    if (!matchReportRun) {
      throw new Error("Match report run not found.");
    }

    if (
      matchReportRun.status !== MatchReportRunStatus.SUCCESS &&
      matchReportRun.status !== MatchReportRunStatus.SUCCESS_WITH_WARNINGS
    ) {
      throw new Error("Only successful match reports can create deterministic cover letters.");
    }

    const requirementAnalysis = await getJobRequirementAnalysisById(
      workspaceId,
      matchReportRun.requirementAnalysisId,
      transaction
    );
    if (!requirementAnalysis || requirementAnalysis.status !== "CONFIRMED") {
      throw new Error("A confirmed requirement analysis is required for cover-letter composition.");
    }

    const parsedRequirementAnalysis = parseStoredJobRequirementAnalysis(
      requirementAnalysis.analysis
    );
    if (parsedRequirementAnalysis.summary.downstreamReadiness === "BLOCKED") {
      throw new Error("Requirement analysis downstream readiness is blocked.");
    }

    const retrievalRun = await getEvidenceRetrievalRunById(
      workspaceId,
      matchReportRun.evidenceRetrievalRunId,
      transaction
    );
    if (!retrievalRun || (retrievalRun.status !== "SUCCESS" && retrievalRun.status !== "SUCCESS_WITH_WARNINGS")) {
      throw new Error("A successful evidence retrieval run is required for cover-letter composition.");
    }

    const scoringRun = await getEvidenceScoringRunById(
      workspaceId,
      matchReportRun.evidenceScoringRunId,
      transaction
    );
    if (!scoringRun || (scoringRun.status !== "SUCCESS" && scoringRun.status !== "SUCCESS_WITH_WARNINGS")) {
      throw new Error("A successful evidence scoring run is required for cover-letter composition.");
    }

    const careerProfileVersion = await getCareerProfileVersionById(
      workspaceId,
      matchReportRun.careerProfileVersionId,
      transaction
    );
    if (!careerProfileVersion) {
      throw new Error("Career profile version not found for cover-letter composition.");
    }

    const parsedRetrieval = await parseStoredEvidenceRetrievalRun(workspaceId, retrievalRun.id, transaction);
    const parsedScoring = await parseStoredEvidenceScoringRun(workspaceId, scoringRun.id, transaction);
    const parsedReport = await parseStoredMatchReportRun(workspaceId, matchReportRun.id, transaction);
    const resumeSource = await resolveResumeSource(
      workspaceId,
      matchReportRun.jobDescriptionVersionId,
      options.resumeSource,
      transaction
    );

    if (
      resumeSource?.sourceType === "BASE_COMPOSITION" &&
      options.resumeSource?.sourceType === "FINALIZED_REVISION"
    ) {
      throw new Error("Resume source resolution became ambiguous.");
    }

    const inputChecksum = await computeCoverLetterCompositionInputChecksum({
      matchReportRunId: matchReportRun.id,
      matchReportInputChecksum: matchReportRun.inputChecksum,
      careerProfileVersionId: careerProfileVersion.id,
      careerSourceChecksum: careerProfileVersion.source.checksum,
      resumeSource: resumeSource
        ? {
            sourceType: resumeSource.sourceType,
            sourceId: resumeSource.sourceId,
            sourceInputChecksum: resumeSource.sourceInputChecksum
          }
        : null,
      compositionConfiguration: coverLetterCompositionConfiguration
    });

    const existing = await getLatestReusableCoverLetterCompositionVersion(
      workspaceId,
      inputChecksum,
      transaction
    );
    if (existing) {
      return {
        version: await getCoverLetterCompositionVersionById(workspaceId, existing.id, transaction),
        duplicate: true
      };
    }

    const predecessor = await getLatestCoverLetterCompositionVersionForJobDescription(
      workspaceId,
      matchReportRun.jobDescriptionVersionId,
      transaction
    );

    const result = buildCoverLetterComposition({
      runId: randomUUID(),
      workspaceId,
      applicationId: matchReportRun.applicationId,
      jobOpportunityId: matchReportRun.jobDescriptionVersion.opportunityId,
      jobDescriptionVersionId: matchReportRun.jobDescriptionVersionId,
      careerProfileVersionId: careerProfileVersion.id,
      requirementAnalysisId: matchReportRun.requirementAnalysisId,
      evidenceRetrievalRunId: retrievalRun.id,
      evidenceScoringRunId: scoringRun.id,
      matchReportRunId: matchReportRun.id,
      targetCompany: matchReportRun.jobDescriptionVersion.opportunity.company.name,
      targetRole: matchReportRun.jobDescriptionVersion.opportunity.title,
      createdAt: new Date().toISOString(),
      inputChecksum,
      careerProfileContent: parseCareerContent(careerProfileVersion.content),
      requirementAnalysis: parsedRequirementAnalysis,
      retrievalResult: parsedRetrieval.result,
      scoringResult: parsedScoring.result,
      matchReportResult: parsedReport.result,
      resumeSource
    });

    await createCoverLetterCompositionRecord({
      transaction,
      workspaceId,
      predecessorId: predecessor?.id ?? null,
      result,
      inputChecksum,
      matchReportInputChecksum: matchReportRun.inputChecksum,
      careerSourceChecksum: careerProfileVersion.source.checksum,
      resumeSourceInputChecksum: resumeSource?.sourceInputChecksum ?? null
    });

    if (options.simulateFailureAfterCreate) {
      throw new Error("Simulated cover-letter composition persistence failure.");
    }

    return {
      version: await getCoverLetterCompositionVersionById(workspaceId, result.runId, transaction),
      duplicate: false
    };
  });
}

export async function parseStoredCoverLetterCompositionVersion(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getCoverLetterCompositionVersionById(workspaceId, versionId, prismaClient);
  if (!version) {
    throw new Error("Cover-letter composition version not found.");
  }

  return {
    version,
    content: await parseStoredContent(version.content)
  };
}
