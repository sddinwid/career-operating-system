import { randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  ResumeRevisionVersionStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  RESUME_REVISION_CONFIGURATION_VERSION,
  RESUME_REVISION_CONTRACT_VERSION,
  RESUME_REVISION_ENGINE_VERSION
} from "@/lib/resume-revision/config";
import {
  computeResumeRevisionChecksum,
  createResumeRevisionDraftFromComposition,
  buildResumeRevisionRecord
} from "@/lib/resume-revision/engine";
import {
  resumeRevisionContentSchema,
  resumeRevisionRecordSchema,
  resumeRevisionSavePayloadSchema,
  type ResumeRevisionContent,
  type ResumeRevisionRecord,
  type ResumeRevisionReviewNote,
  type ResumeRevisionSavePayload
} from "@/lib/resume-revision/contract";
import { getResumeAuditRunById, getLatestReusableResumeAuditRun } from "@/lib/resume-audit/service";
import {
  getLatestResumeCompositionVersionForJobDescription,
  getResumeCompositionContext,
  parseStoredResumeCompositionVersion
} from "@/lib/resume-composition/service";

type TransactionClient = Prisma.TransactionClient;

export class ResumeRevisionServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(args: { code: string; message: string; status: number; name: string }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.name = args.name;
  }
}

function createResumeRevisionServiceError(args: {
  code: string;
  message: string;
  status: number;
  name: string;
}) {
  return new ResumeRevisionServiceError(args);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseStoredRecord(version: {
  content: Prisma.JsonValue | null;
  changeSet: Prisma.JsonValue | null;
  summary: Prisma.JsonValue | null;
  diagnostics: Prisma.JsonValue | null;
  reviewNotes: Prisma.JsonValue | null;
}) {
  return resumeRevisionRecordSchema.parse({
    content: version.content,
    changeSet: version.changeSet ?? [],
    summary: version.summary,
    diagnostics: version.diagnostics ?? [],
    reviewNotes: version.reviewNotes ?? [],
    findingResolutions: []
  });
}

export async function getResumeRevisionVersionById(
  workspaceId: string,
  revisionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeRevisionVersion.findFirst({
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
      baseResumeCompositionVersion: true,
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
      predecessorRevision: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          finalizedAt: true
        }
      },
      requirementAnalysis: true,
      resumeAuditRuns: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5
      },
      structuredResumeVersion: true,
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

export async function parseStoredResumeRevisionVersion(
  workspaceId: string,
  revisionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getResumeRevisionVersionById(workspaceId, revisionId, prismaClient);

  if (!version) {
    throw new Error("Resume revision version not found.");
  }

  if (!version.content || !version.summary) {
    throw new Error("Stored resume revision content is missing.");
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

export async function getLatestDraftResumeRevision(
  workspaceId: string,
  baseResumeCompositionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeRevisionVersion.findFirst({
    where: {
      workspaceId,
      baseResumeCompositionVersionId,
      status: ResumeRevisionVersionStatus.DRAFT,
      supersededAt: null
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestFinalizedResumeRevisionForJobDescription(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.resumeRevisionVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        in: [
          ResumeRevisionVersionStatus.READY_FOR_AUDIT,
          ResumeRevisionVersionStatus.AUDITED,
          ResumeRevisionVersionStatus.NEEDS_REVIEW
        ]
      }
    },
    orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });
}

async function createDraftFromExistingContent(args: {
  transaction: TransactionClient;
  workspaceId: string;
  baseResumeCompositionVersionId: string;
  predecessorRevisionId: string | null;
  sourceInputChecksum: string;
  content: ResumeRevisionContent;
  reviewNotes: ResumeRevisionReviewNote[];
  createdAt: string;
}) {
  const content = clone(args.content);
  content.revisionId = randomUUID();
  content.baseResumeCompositionVersionId = args.baseResumeCompositionVersionId;
  content.predecessorRevisionId = args.predecessorRevisionId;
  content.sourceInputChecksum = args.sourceInputChecksum;
  content.createdAt = args.createdAt;
  content.updatedAt = args.createdAt;
  content.status = "DRAFT";
  content.inputChecksum = await computeResumeRevisionChecksum({
    sourceInputChecksum: args.sourceInputChecksum,
    content,
    reviewNotes: args.reviewNotes
  });

  const record = buildResumeRevisionRecord({
    content,
    reviewNotes: args.reviewNotes,
    latestAudit: null,
    latestAuditStatus: null
  });
  record.content.status = "DRAFT";

  const version = await args.transaction.resumeRevisionVersion.create({
    data: {
      id: content.revisionId,
      workspaceId: args.workspaceId,
      baseResumeCompositionVersionId: args.baseResumeCompositionVersionId,
      predecessorRevisionId: args.predecessorRevisionId,
      structuredResumeVersionId: content.structuredResumeVersionId,
      careerProfileVersionId: content.careerProfileVersionId,
      matchReportRunId: content.matchReportRunId,
      requirementAnalysisId: content.requirementAnalysisId,
      jobDescriptionVersionId: content.jobDescriptionVersionId,
      applicationId: content.applicationId,
      contractVersion: RESUME_REVISION_CONTRACT_VERSION,
      engineVersion: RESUME_REVISION_ENGINE_VERSION,
      configurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
      sourceInputChecksum: args.sourceInputChecksum,
      inputChecksum: record.content.inputChecksum,
      status: ResumeRevisionVersionStatus.DRAFT,
      content: record.content as Prisma.InputJsonValue,
      changeSet: record.changeSet as Prisma.InputJsonValue,
      summary: record.summary as Prisma.InputJsonValue,
      diagnostics: record.diagnostics as Prisma.InputJsonValue,
      reviewNotes: record.reviewNotes as Prisma.InputJsonValue
    }
  });

  return getResumeRevisionVersionById(args.workspaceId, version.id, args.transaction);
}

export async function getResumeRevisionContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const compositionContext = await getResumeCompositionContext(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );

  if (!compositionContext?.reusableResumeCompositionVersion) {
    return null;
  }

  const baseCompositionVersion = compositionContext.reusableResumeCompositionVersion;
  const latestDraft = await getLatestDraftResumeRevision(
    workspaceId,
    baseCompositionVersion.id,
    prismaClient
  );
  const latestFinalizedRevision = await getLatestFinalizedResumeRevisionForJobDescription(
    workspaceId,
    jobDescriptionVersionId,
    prismaClient
  );
  const latestRevisionAudit = latestFinalizedRevision
    ? await prismaClient.resumeAuditRun.findFirst({
        where: {
          workspaceId,
          resumeRevisionVersionId: latestFinalizedRevision.id
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      })
    : null;

  return {
    ...compositionContext,
    baseCompositionVersion,
    latestDraft,
    latestFinalizedRevision,
    latestRevisionAudit
  };
}

export async function openResumeStudio(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma,
  options?: {
    createSuccessorDraft?: boolean;
  }
) {
  const context = await getResumeRevisionContext(workspaceId, jobDescriptionVersionId, prismaClient);
  if (!context) {
    throw new Error("Resume Studio requires a composed resume.");
  }

  if (context.latestDraft && !options?.createSuccessorDraft) {
    return {
      mode: "draft" as const,
      revision: await getResumeRevisionVersionById(workspaceId, context.latestDraft.id, prismaClient)
    };
  }

  if (context.latestFinalizedRevision && !options?.createSuccessorDraft) {
    return {
      mode: "finalized" as const,
      revision: await getResumeRevisionVersionById(
        workspaceId,
        context.latestFinalizedRevision.id,
        prismaClient
      )
    };
  }

  return prismaClient.$transaction(async (transaction) => {
    const freshContext = await getResumeRevisionContext(
      workspaceId,
      jobDescriptionVersionId,
      transaction as PrismaClient
    );

    if (!freshContext?.baseCompositionVersion) {
      throw new Error("Resume Studio requires a composed resume.");
    }

    const draft = await getLatestDraftResumeRevision(
      workspaceId,
      freshContext.baseCompositionVersion.id,
      transaction
    );

    if (draft && !options?.createSuccessorDraft) {
      return {
        mode: "draft" as const,
        revision: await getResumeRevisionVersionById(workspaceId, draft.id, transaction)
      };
    }

    if (options?.createSuccessorDraft && freshContext.latestFinalizedRevision) {
      const parsedRevision = await parseStoredResumeRevisionVersion(
        workspaceId,
        freshContext.latestFinalizedRevision.id,
        transaction
      );

      return {
        mode: "draft" as const,
        revision: await createDraftFromExistingContent({
          transaction,
          workspaceId,
          baseResumeCompositionVersionId: freshContext.baseCompositionVersion.id,
          predecessorRevisionId: freshContext.latestFinalizedRevision.id,
          sourceInputChecksum: parsedRevision.version.inputChecksum,
          content: parsedRevision.record.content,
          reviewNotes: parsedRevision.record.reviewNotes,
          createdAt: new Date().toISOString()
        })
      };
    }

    const parsedComposition = await parseStoredResumeCompositionVersion(
      workspaceId,
      freshContext.baseCompositionVersion.id,
      transaction
    );
    const createdAt = new Date().toISOString();
    const draftContent = await createResumeRevisionDraftFromComposition({
      revisionId: randomUUID(),
      workspaceId,
      baseResumeCompositionVersionId: freshContext.baseCompositionVersion.id,
      predecessorRevisionId: null,
      sourceInputChecksum: freshContext.baseCompositionVersion.inputChecksum,
      composition: parsedComposition.content,
      createdAt
    });
    const record = buildResumeRevisionRecord({
      content: draftContent,
      reviewNotes: [],
      latestAudit: null,
      latestAuditStatus: null
    });
    record.content.status = "DRAFT";

    await transaction.resumeRevisionVersion.create({
      data: {
        id: draftContent.revisionId,
        workspaceId,
        baseResumeCompositionVersionId: freshContext.baseCompositionVersion.id,
        predecessorRevisionId: null,
        structuredResumeVersionId: draftContent.structuredResumeVersionId,
        careerProfileVersionId: draftContent.careerProfileVersionId,
        matchReportRunId: draftContent.matchReportRunId,
        requirementAnalysisId: draftContent.requirementAnalysisId,
        jobDescriptionVersionId: draftContent.jobDescriptionVersionId,
        applicationId: draftContent.applicationId,
        contractVersion: RESUME_REVISION_CONTRACT_VERSION,
        engineVersion: RESUME_REVISION_ENGINE_VERSION,
        configurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
        sourceInputChecksum: freshContext.baseCompositionVersion.inputChecksum,
        inputChecksum: record.content.inputChecksum,
        status: ResumeRevisionVersionStatus.DRAFT,
        content: record.content as Prisma.InputJsonValue,
        changeSet: record.changeSet as Prisma.InputJsonValue,
        summary: record.summary as Prisma.InputJsonValue,
        diagnostics: record.diagnostics as Prisma.InputJsonValue,
        reviewNotes: [] as Prisma.InputJsonValue
      }
    });

    return {
      mode: "draft" as const,
      revision: await getResumeRevisionVersionById(
        workspaceId,
        draftContent.revisionId,
        transaction
      )
    };
  });
}

export async function saveResumeRevisionDraft(
  workspaceId: string,
  payload: ResumeRevisionSavePayload,
  prismaClient: PrismaClient = prisma
) {
  const parsedPayload = resumeRevisionSavePayloadSchema.parse(payload);

  return prismaClient.$transaction(async (transaction) => {
    const existing = await getResumeRevisionVersionById(
      workspaceId,
      parsedPayload.revisionId,
      transaction
    );

    if (!existing) {
      throw createResumeRevisionServiceError({
        code: "REVISION_NOT_FOUND",
        message: "Resume revision draft not found.",
        status: 404,
        name: "ResumeRevisionNotFoundError"
      });
    }

    if (existing.status !== ResumeRevisionVersionStatus.DRAFT) {
      throw createResumeRevisionServiceError({
        code: "INVALID_STATE",
        message: "Only mutable draft revisions can be saved.",
        status: 409,
        name: "ResumeRevisionInvalidStateError"
      });
    }

    if (existing.updatedAt.toISOString() !== parsedPayload.updatedAt) {
      throw createResumeRevisionServiceError({
        code: "STALE_DRAFT",
        message: "Resume revision draft is stale.",
        status: 409,
        name: "ResumeRevisionConflictError"
      });
    }

    const updatedAt = new Date().toISOString();
    const content = clone(resumeRevisionContentSchema.parse(parsedPayload.content));
    content.updatedAt = updatedAt;
    content.status = "DRAFT";
    content.inputChecksum = await computeResumeRevisionChecksum({
      sourceInputChecksum: existing.sourceInputChecksum,
      content,
      reviewNotes: parsedPayload.reviewNotes
    });

    const latestAudit =
      existing.resumeAuditRuns[0]
        ? await getResumeAuditRunById(workspaceId, existing.resumeAuditRuns[0].id, transaction)
        : null;

    const record = buildResumeRevisionRecord({
      content,
      reviewNotes: parsedPayload.reviewNotes,
      latestAudit: latestAudit?.result ? (latestAudit.result as never) : null,
      latestAuditStatus: latestAudit?.status ?? null
    });
    record.content.status = "DRAFT";

    const updated = await transaction.resumeRevisionVersion.update({
      where: {
        id: existing.id
      },
      data: {
        inputChecksum: record.content.inputChecksum,
        content: record.content as Prisma.InputJsonValue,
        changeSet: record.changeSet as Prisma.InputJsonValue,
        summary: record.summary as Prisma.InputJsonValue,
        diagnostics: record.diagnostics as Prisma.InputJsonValue,
        reviewNotes: record.reviewNotes as Prisma.InputJsonValue,
        status: ResumeRevisionVersionStatus.DRAFT
      }
    });

    return getResumeRevisionVersionById(workspaceId, updated.id, transaction);
  });
}

export async function finalizeResumeRevision(
  workspaceId: string,
  args: {
    revisionId: string;
    updatedAt: string;
  },
  prismaClient: PrismaClient = prisma
) {
  const finalizedStatuses = new Set<ResumeRevisionVersionStatus>([
    ResumeRevisionVersionStatus.READY_FOR_AUDIT,
    ResumeRevisionVersionStatus.AUDITED,
    ResumeRevisionVersionStatus.NEEDS_REVIEW
  ]);

  return prismaClient.$transaction(async (transaction) => {
    const existing = await getResumeRevisionVersionById(workspaceId, args.revisionId, transaction);

    if (!existing) {
      throw createResumeRevisionServiceError({
        code: "REVISION_NOT_FOUND",
        message: "Resume revision draft not found.",
        status: 404,
        name: "ResumeRevisionNotFoundError"
      });
    }

    if (existing.status !== ResumeRevisionVersionStatus.DRAFT) {
      if (
        existing.status === ResumeRevisionVersionStatus.SUPERSEDED &&
        existing.successorRevisions.length > 0
      ) {
        const finalizedSuccessor = existing.successorRevisions.find((revision) =>
          finalizedStatuses.has(revision.status)
        );

        if (finalizedSuccessor) {
          return getResumeRevisionVersionById(workspaceId, finalizedSuccessor.id, transaction);
        }
      }

      if (finalizedStatuses.has(existing.status)) {
        return existing;
      }

      throw createResumeRevisionServiceError({
        code: "INVALID_STATE",
        message: "Only mutable draft revisions can be finalized.",
        status: 409,
        name: "ResumeRevisionInvalidStateError"
      });
    }

    if (existing.updatedAt.toISOString() !== args.updatedAt) {
      throw createResumeRevisionServiceError({
        code: "STALE_DRAFT",
        message: "Resume revision draft is stale.",
        status: 409,
        name: "ResumeRevisionConflictError"
      });
    }

    const record = parseStoredRecord(existing);
    const rebuilt = buildResumeRevisionRecord({
      content: {
        ...record.content,
        updatedAt: new Date().toISOString()
      },
      reviewNotes: record.reviewNotes,
      latestAudit: null,
      latestAuditStatus: null
    });

    if (rebuilt.summary.localValidationState === "BLOCKED") {
      throw createResumeRevisionServiceError({
        code: "BLOCKED_VALIDATION",
        message: "Resume revision contains blocking validation findings.",
        status: 422,
        name: "ResumeRevisionValidationError"
      });
    }

    const finalizedId = randomUUID();
    const finalizedAt = new Date().toISOString();
    const finalizedStatus =
      rebuilt.summary.localValidationState === "NEEDS_REVIEW"
        ? ResumeRevisionVersionStatus.NEEDS_REVIEW
        : ResumeRevisionVersionStatus.READY_FOR_AUDIT;

    rebuilt.content.revisionId = finalizedId;
    rebuilt.content.createdAt = finalizedAt;
    rebuilt.content.updatedAt = finalizedAt;
    rebuilt.content.status =
      finalizedStatus === ResumeRevisionVersionStatus.NEEDS_REVIEW
        ? "NEEDS_REVIEW"
        : "READY_FOR_AUDIT";
    rebuilt.content.predecessorRevisionId = existing.id;
    rebuilt.content.inputChecksum = await computeResumeRevisionChecksum({
      sourceInputChecksum: existing.sourceInputChecksum,
      content: rebuilt.content,
      reviewNotes: rebuilt.reviewNotes
    });

    const finalizedRecord = buildResumeRevisionRecord({
      content: rebuilt.content,
      reviewNotes: rebuilt.reviewNotes,
      latestAudit: null,
      latestAuditStatus: null
    });
    finalizedRecord.content.status =
      finalizedStatus === ResumeRevisionVersionStatus.NEEDS_REVIEW
        ? "NEEDS_REVIEW"
        : "READY_FOR_AUDIT";
    finalizedRecord.summary.revisionStatus = finalizedRecord.content.status;

    await transaction.resumeRevisionVersion.create({
      data: {
        id: finalizedId,
        workspaceId,
        baseResumeCompositionVersionId: existing.baseResumeCompositionVersionId,
        predecessorRevisionId: existing.id,
        structuredResumeVersionId: existing.structuredResumeVersionId,
        careerProfileVersionId: existing.careerProfileVersionId,
        matchReportRunId: existing.matchReportRunId,
        requirementAnalysisId: existing.requirementAnalysisId,
        jobDescriptionVersionId: existing.jobDescriptionVersionId,
        applicationId: existing.applicationId,
        contractVersion: RESUME_REVISION_CONTRACT_VERSION,
        engineVersion: RESUME_REVISION_ENGINE_VERSION,
        configurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
        sourceInputChecksum: existing.sourceInputChecksum,
        inputChecksum: finalizedRecord.content.inputChecksum,
        status: finalizedStatus,
        content: finalizedRecord.content as Prisma.InputJsonValue,
        changeSet: finalizedRecord.changeSet as Prisma.InputJsonValue,
        summary: finalizedRecord.summary as Prisma.InputJsonValue,
        diagnostics: finalizedRecord.diagnostics as Prisma.InputJsonValue,
        reviewNotes: finalizedRecord.reviewNotes as Prisma.InputJsonValue,
        finalizedAt: new Date(finalizedAt)
      }
    });

    await transaction.resumeRevisionVersion.update({
      where: {
        id: existing.id
      },
      data: {
        status: ResumeRevisionVersionStatus.SUPERSEDED,
        supersededAt: new Date(finalizedAt)
      }
    });

    return getResumeRevisionVersionById(workspaceId, finalizedId, transaction);
  });
}

export async function markResumeRevisionAudited(args: {
  workspaceId: string;
  revisionId: string;
  auditStatus: "AUDITED" | "NEEDS_REVIEW";
  prismaClient?: PrismaClient | TransactionClient;
}) {
  const prismaClient = args.prismaClient ?? prisma;
  return prismaClient.resumeRevisionVersion.update({
    where: {
      id: args.revisionId
    },
    data: {
      status:
        args.auditStatus === "AUDITED"
          ? ResumeRevisionVersionStatus.AUDITED
          : ResumeRevisionVersionStatus.NEEDS_REVIEW
    }
  });
}
