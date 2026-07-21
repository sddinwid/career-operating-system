import { Prisma, PrismaClient, CoverLetterRevisionVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COVER_LETTER_REVISION_CONFIGURATION_VERSION,
  COVER_LETTER_REVISION_CONTRACT_VERSION,
  COVER_LETTER_REVISION_ENGINE_VERSION
} from "@/lib/cover-letter-revision/config";
import {
  buildCoverLetterRevisionRecord,
  computeCoverLetterRevisionChecksum,
  computeCoverLetterRevisionContentChecksum,
  createCoverLetterRevisionDraftFromComposition
} from "@/lib/cover-letter-revision/engine";
import {
  coverLetterRevisionRecordSchema,
  coverLetterRevisionSavePayloadSchema,
  type CoverLetterRevisionContent,
  type CoverLetterRevisionRecord,
  type CoverLetterRevisionSavePayload
} from "@/lib/cover-letter-revision/contract";
import {
  getCoverLetterCompositionContext,
  getCoverLetterCompositionVersionById,
  parseStoredCoverLetterCompositionVersion
} from "@/lib/cover-letter-composition/service";

type TransactionClient = Prisma.TransactionClient;

export class CoverLetterRevisionServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(args: { code: string; message: string; status: number; name: string }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.name = args.name;
  }
}

function createServiceError(args: {
  code: string;
  message: string;
  status: number;
  name: string;
}) {
  return new CoverLetterRevisionServiceError(args);
}

function parseStoredRecord(version: {
  content: Prisma.JsonValue | null;
  changeSet: Prisma.JsonValue | null;
  summary: Prisma.JsonValue | null;
  diagnostics: Prisma.JsonValue | null;
  userNotes: string | null;
}) {
  return coverLetterRevisionRecordSchema.parse({
    content: version.content,
    changeSet: version.changeSet ?? [],
    summary: version.summary,
    diagnostics: version.diagnostics ?? [],
    userNotes: version.userNotes
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function getCoverLetterRevisionVersionById(
  workspaceId: string,
  revisionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterRevisionVersion.findFirst({
    where: {
      id: revisionId,
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
      coverLetterAuditRuns: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5
      },
      coverLetterApprovals: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5
      },
      coverLetterCompositionVersion: true,
      predecessorRevision: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          finalizedAt: true
        }
      },
      successorRevisions: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          finalizedAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }
    }
  });
}

export async function parseStoredCoverLetterRevisionVersion(
  workspaceId: string,
  revisionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getCoverLetterRevisionVersionById(workspaceId, revisionId, prismaClient);
  if (!version) {
    throw new Error("Cover-letter revision version not found.");
  }

  return {
    version,
    record: (() => {
      const record = parseStoredRecord(version);
      record.content.createdAt = version.createdAt.toISOString();
      record.content.updatedAt = version.updatedAt.toISOString();
      return record;
    })()
  };
}

export async function getLatestDraftCoverLetterRevision(
  workspaceId: string,
  coverLetterCompositionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterRevisionVersion.findFirst({
    where: {
      workspaceId,
      coverLetterCompositionVersionId,
      status: CoverLetterRevisionVersionStatus.DRAFT,
      supersededAt: null
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestFinalizedCoverLetterRevisionForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.coverLetterRevisionVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: CoverLetterRevisionVersionStatus.FINALIZED
    },
    orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });
}

async function createRevisionRow(args: {
  transaction: TransactionClient;
  workspaceId: string;
  record: CoverLetterRevisionRecord;
}) {
  return args.transaction.coverLetterRevisionVersion.create({
    data: {
      id: args.record.content.revisionId,
      workspaceId: args.workspaceId,
      coverLetterCompositionVersionId: args.record.content.coverLetterCompositionVersionId,
      predecessorRevisionId: args.record.content.predecessorRevisionId,
      applicationId: args.record.content.applicationId,
      jobOpportunityId: args.record.content.jobOpportunityId,
      jobDescriptionVersionId: args.record.content.jobDescriptionVersionId,
      careerProfileVersionId: args.record.content.careerProfileVersionId,
      requirementAnalysisId: args.record.content.requirementAnalysisId,
      evidenceRetrievalRunId: args.record.content.evidenceRetrievalRunId,
      evidenceScoringRunId: args.record.content.evidenceScoringRunId,
      matchReportRunId: args.record.content.matchReportRunId,
      resumeCompositionVersionId: args.record.content.resumeCompositionVersionId,
      resumeRevisionVersionId: args.record.content.resumeRevisionVersionId,
      contractVersion: COVER_LETTER_REVISION_CONTRACT_VERSION,
      engineVersion: COVER_LETTER_REVISION_ENGINE_VERSION,
      contentChecksum: args.record.content.contentChecksum,
      inputChecksum: args.record.content.inputChecksum,
      status: CoverLetterRevisionVersionStatus[args.record.content.status],
      content: args.record.content as Prisma.InputJsonValue,
      changeSet: args.record.changeSet as Prisma.InputJsonValue,
      summary: args.record.summary as Prisma.InputJsonValue,
      diagnostics: args.record.diagnostics as Prisma.InputJsonValue,
      userNotes: args.record.userNotes,
      updatedAt: new Date(args.record.content.updatedAt)
    }
  });
}

async function createDraftFromExistingContent(args: {
  transaction: TransactionClient;
  workspaceId: string;
  predecessorRevisionId: string | null;
  content: CoverLetterRevisionContent;
  userNotes: string | null;
  createdAt: string;
}) {
  const content = clone(args.content);
  content.revisionId = crypto.randomUUID();
  content.predecessorRevisionId = args.predecessorRevisionId;
  content.createdAt = args.createdAt;
  content.updatedAt = args.createdAt;
  content.status = "DRAFT";
  content.contentChecksum = await computeCoverLetterRevisionContentChecksum({
    revisionId: content.revisionId,
    workspaceId: content.workspaceId,
    coverLetterCompositionVersionId: content.coverLetterCompositionVersionId,
    predecessorRevisionId: content.predecessorRevisionId,
    applicationId: content.applicationId,
    jobOpportunityId: content.jobOpportunityId,
    jobDescriptionVersionId: content.jobDescriptionVersionId,
    careerProfileVersionId: content.careerProfileVersionId,
    requirementAnalysisId: content.requirementAnalysisId,
    evidenceRetrievalRunId: content.evidenceRetrievalRunId,
    evidenceScoringRunId: content.evidenceScoringRunId,
    matchReportRunId: content.matchReportRunId,
    resumeCompositionVersionId: content.resumeCompositionVersionId,
    resumeRevisionVersionId: content.resumeRevisionVersionId,
    coverLetterRevisionContractVersion: content.coverLetterRevisionContractVersion,
    coverLetterRevisionEngineVersion: content.coverLetterRevisionEngineVersion,
    coverLetterRevisionConfigurationVersion: content.coverLetterRevisionConfigurationVersion,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    status: content.status,
    validationState: content.validationState,
    candidateName: content.candidateName,
    header: content.header,
    salutation: content.salutation,
    paragraphs: content.paragraphs,
    closing: content.closing,
    summary: content.summary,
    styleSummary: content.styleSummary,
    lengthSummary: content.lengthSummary,
    overallProvenance: content.overallProvenance,
    diagnostics: content.diagnostics
  });
  content.inputChecksum = await computeCoverLetterRevisionChecksum({
    coverLetterCompositionVersionId: content.coverLetterCompositionVersionId,
    predecessorRevisionId: content.predecessorRevisionId,
    contentChecksum: content.contentChecksum
  });

  const record = await buildCoverLetterRevisionRecord({
    content,
    predecessor: args.predecessorRevisionId ? args.content : null,
    userNotes: args.userNotes
  });

  await createRevisionRow({
    transaction: args.transaction,
    workspaceId: args.workspaceId,
    record
  });

  return getCoverLetterRevisionVersionById(args.workspaceId, content.revisionId, args.transaction);
}

export async function getCoverLetterRevisionContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const compositionContext = await getCoverLetterCompositionContext(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );
  const baseCompositionVersion = compositionContext?.reusableCoverLetterCompositionVersion ?? null;

  if (!baseCompositionVersion) {
    return null;
  }

  const latestDraft = await getLatestDraftCoverLetterRevision(
    workspaceId,
    baseCompositionVersion.id,
    prismaClient
  );
  const latestFinalizedRevision = await getLatestFinalizedCoverLetterRevisionForJobDescription(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );

  return {
    ...compositionContext,
    baseCompositionVersion,
    latestDraft,
    latestFinalizedRevision
  };
}

export async function openCoverLetterStudio(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma,
  options?: { createSuccessorDraft?: boolean }
) {
  const context = await getCoverLetterRevisionContext(workspaceId, jobDescriptionVersionId, prismaClient);
  if (!context?.baseCompositionVersion) {
    throw new Error("Cover Letter Studio requires a composed cover letter.");
  }

  if (context.latestDraft && !options?.createSuccessorDraft) {
    return { mode: "draft" as const, revision: context.latestDraft };
  }

  if (context.latestFinalizedRevision && !options?.createSuccessorDraft) {
    return { mode: "finalized" as const, revision: context.latestFinalizedRevision };
  }

  return prismaClient.$transaction(async (transaction) => {
    const freshContext = await getCoverLetterRevisionContext(
      workspaceId,
      jobDescriptionVersionId,
      transaction as PrismaClient
    );

    if (!freshContext?.baseCompositionVersion) {
      throw new Error("Cover Letter Studio requires a composed cover letter.");
    }

    const composition = await parseStoredCoverLetterCompositionVersion(
      workspaceId,
      freshContext.baseCompositionVersion.id,
      transaction
    );

    const predecessor =
      options?.createSuccessorDraft && freshContext.latestFinalizedRevision
        ? await parseStoredCoverLetterRevisionVersion(
            workspaceId,
            freshContext.latestFinalizedRevision.id,
            transaction
          )
        : null;

    const content = predecessor
      ? {
          ...predecessor.record.content,
          revisionId: crypto.randomUUID(),
          predecessorRevisionId: predecessor.record.content.revisionId,
          status: "DRAFT" as const,
          validationState: predecessor.record.content.validationState,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      : await createCoverLetterRevisionDraftFromComposition({
          composition: composition.content,
          predecessor: null
        });

    const contentChecksum = await computeCoverLetterRevisionContentChecksum({
      revisionId: content.revisionId,
      workspaceId: content.workspaceId,
      coverLetterCompositionVersionId: content.coverLetterCompositionVersionId,
      predecessorRevisionId: content.predecessorRevisionId,
      applicationId: content.applicationId,
      jobOpportunityId: content.jobOpportunityId,
      jobDescriptionVersionId: content.jobDescriptionVersionId,
      careerProfileVersionId: content.careerProfileVersionId,
      requirementAnalysisId: content.requirementAnalysisId,
      evidenceRetrievalRunId: content.evidenceRetrievalRunId,
      evidenceScoringRunId: content.evidenceScoringRunId,
      matchReportRunId: content.matchReportRunId,
      resumeCompositionVersionId: content.resumeCompositionVersionId,
      resumeRevisionVersionId: content.resumeRevisionVersionId,
      coverLetterRevisionContractVersion: content.coverLetterRevisionContractVersion,
      coverLetterRevisionEngineVersion: content.coverLetterRevisionEngineVersion,
      coverLetterRevisionConfigurationVersion:
        content.coverLetterRevisionConfigurationVersion,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      status: content.status,
      validationState: content.validationState,
      candidateName: content.candidateName,
      header: content.header,
      salutation: content.salutation,
      paragraphs: content.paragraphs,
      closing: content.closing,
      summary: content.summary,
      styleSummary: content.styleSummary,
      lengthSummary: content.lengthSummary,
      overallProvenance: content.overallProvenance,
      diagnostics: content.diagnostics
    });
    const inputChecksum = await computeCoverLetterRevisionChecksum({
      coverLetterCompositionVersionId: content.coverLetterCompositionVersionId,
      predecessorRevisionId: content.predecessorRevisionId,
      contentChecksum
    });
    const nextContent: CoverLetterRevisionContent = {
      ...content,
      contentChecksum,
      inputChecksum
    };
    const record = await buildCoverLetterRevisionRecord({
      content: nextContent,
      predecessor: predecessor?.record.content ?? null
    });
    const version = await createRevisionRow({
      transaction,
      workspaceId,
      record
    });

    return {
      mode: "created" as const,
      revision: version
    };
  });
}

export async function saveCoverLetterRevisionSuccessor(
  workspaceId: string,
  payload: CoverLetterRevisionSavePayload,
  prismaClient: PrismaClient = prisma
) {
  const parsed = coverLetterRevisionSavePayloadSchema.parse(payload);
  return prismaClient.$transaction(async (transaction) => {
    const current = await getCoverLetterRevisionVersionById(workspaceId, parsed.revisionId, transaction);
    if (!current) {
      throw createServiceError({
        code: "REVISION_NOT_FOUND",
        message: "Cover-letter revision draft not found.",
        status: 404,
        name: "CoverLetterRevisionNotFoundError"
      });
    }
    if (current.status !== CoverLetterRevisionVersionStatus.DRAFT) {
      throw createServiceError({
        code: "INVALID_STATE",
        message: "Only mutable draft revisions can be saved.",
        status: 409,
        name: "CoverLetterRevisionInvalidStateError"
      });
    }
    if (current.supersededAt) {
      throw createServiceError({
        code: "STALE_REVISION",
        message: "This revision is no longer current.",
        status: 409,
        name: "CoverLetterRevisionConflictError"
      });
    }
    if (current.updatedAt.toISOString() !== parsed.updatedAt) {
      throw createServiceError({
        code: "STALE_REVISION",
        message: "This revision was updated elsewhere.",
        status: 409,
        name: "CoverLetterRevisionConflictError"
      });
    }

    const predecessor = parseStoredRecord(current);
    const updatedAt = new Date().toISOString();
    const contentChecksum = await computeCoverLetterRevisionContentChecksum({
      revisionId: parsed.content.revisionId,
      workspaceId: parsed.content.workspaceId,
      coverLetterCompositionVersionId: parsed.content.coverLetterCompositionVersionId,
      predecessorRevisionId: parsed.content.predecessorRevisionId,
      applicationId: parsed.content.applicationId,
      jobOpportunityId: parsed.content.jobOpportunityId,
      jobDescriptionVersionId: parsed.content.jobDescriptionVersionId,
      careerProfileVersionId: parsed.content.careerProfileVersionId,
      requirementAnalysisId: parsed.content.requirementAnalysisId,
      evidenceRetrievalRunId: parsed.content.evidenceRetrievalRunId,
      evidenceScoringRunId: parsed.content.evidenceScoringRunId,
      matchReportRunId: parsed.content.matchReportRunId,
      resumeCompositionVersionId: parsed.content.resumeCompositionVersionId,
      resumeRevisionVersionId: parsed.content.resumeRevisionVersionId,
      coverLetterRevisionContractVersion: parsed.content.coverLetterRevisionContractVersion,
      coverLetterRevisionEngineVersion: parsed.content.coverLetterRevisionEngineVersion,
      coverLetterRevisionConfigurationVersion:
        parsed.content.coverLetterRevisionConfigurationVersion,
      createdAt: parsed.content.createdAt,
      updatedAt,
      status: "DRAFT",
      validationState: parsed.content.validationState,
      candidateName: parsed.content.candidateName,
      header: parsed.content.header,
      salutation: parsed.content.salutation,
      paragraphs: parsed.content.paragraphs,
      closing: parsed.content.closing,
      summary: parsed.content.summary,
      styleSummary: parsed.content.styleSummary,
      lengthSummary: parsed.content.lengthSummary,
      overallProvenance: parsed.content.overallProvenance,
      diagnostics: parsed.content.diagnostics
    });
    const inputChecksum = await computeCoverLetterRevisionChecksum({
      coverLetterCompositionVersionId: parsed.content.coverLetterCompositionVersionId,
      predecessorRevisionId: current.predecessorRevisionId,
      contentChecksum
    });

    if (current.contentChecksum === contentChecksum && current.userNotes === (parsed.userNotes ?? null)) {
      return current;
    }

    const nextContent: CoverLetterRevisionContent = {
      ...parsed.content,
      revisionId: current.id,
      predecessorRevisionId: current.predecessorRevisionId,
      createdAt: predecessor.content.createdAt,
      updatedAt,
      status: "DRAFT",
      contentChecksum,
      inputChecksum
    };
    const nextRecord = await buildCoverLetterRevisionRecord({
      content: nextContent,
      predecessor: predecessor.content,
      userNotes: parsed.userNotes
    });

    const updated = await transaction.coverLetterRevisionVersion.update({
      where: { id: current.id },
      data: {
        inputChecksum: nextRecord.content.inputChecksum,
        contentChecksum: nextRecord.content.contentChecksum,
        content: nextRecord.content as Prisma.InputJsonValue,
        changeSet: nextRecord.changeSet as Prisma.InputJsonValue,
        summary: nextRecord.summary as Prisma.InputJsonValue,
        diagnostics: nextRecord.diagnostics as Prisma.InputJsonValue,
        userNotes: nextRecord.userNotes,
        status: CoverLetterRevisionVersionStatus.DRAFT,
        updatedAt: new Date(updatedAt)
      }
    });

    return getCoverLetterRevisionVersionById(workspaceId, updated.id, transaction);
  });
}

export async function finalizeCoverLetterRevision(
  workspaceId: string,
  args: {
    revisionId: string;
    updatedAt: string;
  },
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (transaction) => {
    const revision = await getCoverLetterRevisionVersionById(workspaceId, args.revisionId, transaction);
    if (!revision) {
      throw createServiceError({
        code: "REVISION_NOT_FOUND",
        message: "Cover-letter revision not found.",
        status: 404,
        name: "CoverLetterRevisionNotFoundError"
      });
    }
    if (revision.status === CoverLetterRevisionVersionStatus.SUPERSEDED) {
      const finalizedSuccessor = revision.successorRevisions.find(
        (successor) => successor.status === CoverLetterRevisionVersionStatus.FINALIZED
      );
      if (finalizedSuccessor) {
        return getCoverLetterRevisionVersionById(workspaceId, finalizedSuccessor.id, transaction);
      }
    }
    if (revision.supersededAt) {
      throw createServiceError({
        code: "STALE_REVISION",
        message: "This revision is no longer current.",
        status: 409,
        name: "CoverLetterRevisionConflictError"
      });
    }
    if (revision.updatedAt.toISOString() !== args.updatedAt) {
      throw createServiceError({
        code: "STALE_REVISION",
        message: "This revision was updated elsewhere.",
        status: 409,
        name: "CoverLetterRevisionConflictError"
      });
    }

    if (revision.status === CoverLetterRevisionVersionStatus.FINALIZED) {
      return revision;
    }

    if (revision.status !== CoverLetterRevisionVersionStatus.DRAFT) {
      throw createServiceError({
        code: "INVALID_STATE",
        message: "Only mutable draft revisions can be finalized.",
        status: 409,
        name: "CoverLetterRevisionInvalidStateError"
      });
    }

    const parsedRevision = parseStoredRecord(revision);
    const rebuiltRecord = await buildCoverLetterRevisionRecord({
      content: parsedRevision.content,
      predecessor: revision.predecessorRevision?.id
        ? (await parseStoredCoverLetterRevisionVersion(workspaceId, revision.predecessorRevision.id, transaction)).record.content
        : null,
      userNotes: parsedRevision.userNotes
    });

    if (rebuiltRecord.summary.localValidationState === "BLOCKED") {
      throw createServiceError({
        code: "INVALID_REVISION",
        message: "Resolve the current cover-letter validation issues before finalizing.",
        status: 422,
        name: "CoverLetterRevisionValidationError"
      });
    }

    const finalizedAt = new Date().toISOString();
    const finalizedContent: CoverLetterRevisionContent = {
      ...rebuiltRecord.content,
      revisionId: crypto.randomUUID(),
      predecessorRevisionId: revision.id,
      createdAt: finalizedAt,
      updatedAt: finalizedAt,
      status: "FINALIZED"
    };
    finalizedContent.contentChecksum = await computeCoverLetterRevisionContentChecksum({
      revisionId: finalizedContent.revisionId,
      workspaceId: finalizedContent.workspaceId,
      coverLetterCompositionVersionId: finalizedContent.coverLetterCompositionVersionId,
      predecessorRevisionId: finalizedContent.predecessorRevisionId,
      applicationId: finalizedContent.applicationId,
      jobOpportunityId: finalizedContent.jobOpportunityId,
      jobDescriptionVersionId: finalizedContent.jobDescriptionVersionId,
      careerProfileVersionId: finalizedContent.careerProfileVersionId,
      requirementAnalysisId: finalizedContent.requirementAnalysisId,
      evidenceRetrievalRunId: finalizedContent.evidenceRetrievalRunId,
      evidenceScoringRunId: finalizedContent.evidenceScoringRunId,
      matchReportRunId: finalizedContent.matchReportRunId,
      resumeCompositionVersionId: finalizedContent.resumeCompositionVersionId,
      resumeRevisionVersionId: finalizedContent.resumeRevisionVersionId,
      coverLetterRevisionContractVersion: finalizedContent.coverLetterRevisionContractVersion,
      coverLetterRevisionEngineVersion: finalizedContent.coverLetterRevisionEngineVersion,
      coverLetterRevisionConfigurationVersion:
        finalizedContent.coverLetterRevisionConfigurationVersion,
      createdAt: finalizedContent.createdAt,
      updatedAt: finalizedContent.updatedAt,
      status: finalizedContent.status,
      validationState: finalizedContent.validationState,
      candidateName: finalizedContent.candidateName,
      header: finalizedContent.header,
      salutation: finalizedContent.salutation,
      paragraphs: finalizedContent.paragraphs,
      closing: finalizedContent.closing,
      summary: finalizedContent.summary,
      styleSummary: finalizedContent.styleSummary,
      lengthSummary: finalizedContent.lengthSummary,
      overallProvenance: finalizedContent.overallProvenance,
      diagnostics: finalizedContent.diagnostics
    });
    finalizedContent.inputChecksum = await computeCoverLetterRevisionChecksum({
      coverLetterCompositionVersionId: finalizedContent.coverLetterCompositionVersionId,
      predecessorRevisionId: finalizedContent.predecessorRevisionId,
      contentChecksum: finalizedContent.contentChecksum
    });
    const finalizedRecord = await buildCoverLetterRevisionRecord({
      content: finalizedContent,
      predecessor: rebuiltRecord.content,
      userNotes: rebuiltRecord.userNotes
    });

    await createRevisionRow({
      transaction,
      workspaceId,
      record: finalizedRecord
    });
    await transaction.coverLetterRevisionVersion.update({
      where: { id: revision.id },
      data: {
        status: CoverLetterRevisionVersionStatus.SUPERSEDED,
        supersededAt: new Date(finalizedAt)
      }
    });

    return getCoverLetterRevisionVersionById(workspaceId, finalizedContent.revisionId, transaction);
  });
}
