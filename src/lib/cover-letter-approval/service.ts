import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COVER_LETTER_APPROVAL_CONFIGURATION_VERSION,
  COVER_LETTER_APPROVAL_CONTRACT_VERSION,
  COVER_LETTER_APPROVAL_ENGINE_VERSION,
  COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT
} from "@/lib/cover-letter-approval/config";
import {
  coverLetterApprovalCreateRequestSchema,
  coverLetterApprovalEligibilitySchema,
  coverLetterApprovalRecordSchema,
  coverLetterApprovalRevokeRequestSchema,
  type CoverLetterApprovalCreateRequest,
  type CoverLetterApprovalDiagnostic,
  type CoverLetterApprovalEligibility,
  type CoverLetterApprovalRecord,
  type CoverLetterApprovalRevokeRequest
} from "@/lib/cover-letter-approval/contract";
import { getCoverLetterAuditRunById, parseStoredCoverLetterAuditRun } from "@/lib/cover-letter-audit/service";
import { parseStoredCoverLetterCompositionVersion } from "@/lib/cover-letter-composition/service";
import { createCoverLetterRevisionDraftFromComposition } from "@/lib/cover-letter-revision/engine";
import { getCoverLetterRevisionVersionById } from "@/lib/cover-letter-revision/service";

type TransactionClient = Prisma.TransactionClient;
type SourceType = "BASE_COMPOSITION" | "FINALIZED_REVISION";

export class CoverLetterApprovalServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly diagnostics?: CoverLetterApprovalDiagnostic[];

  constructor(args: {
    code: string;
    message: string;
    status: number;
    name: string;
    diagnostics?: CoverLetterApprovalDiagnostic[];
  }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.name = args.name;
    this.diagnostics = args.diagnostics;
  }
}

function createServiceError(args: {
  code: string;
  message: string;
  status: number;
  name: string;
  diagnostics?: CoverLetterApprovalDiagnostic[];
}) {
  return new CoverLetterApprovalServiceError(args);
}

function toDiagnostic(
  code: string,
  severity: "ERROR" | "WARNING" | "INFORMATION",
  message: string,
  blocking = severity === "ERROR"
): CoverLetterApprovalDiagnostic {
  return { code, severity, message, blocking };
}

function delegate(prismaClient: PrismaClient | TransactionClient) {
  return (prismaClient as PrismaClient & {
    coverLetterApproval: {
      findFirst: (...args: any[]) => Promise<any>;
      findMany: (...args: any[]) => Promise<any[]>;
      create: (...args: any[]) => Promise<any>;
      update: (...args: any[]) => Promise<any>;
    };
  }).coverLetterApproval;
}

function toRecord(approval: {
  id: string;
  workspaceId: string;
  sourceType: SourceType;
  coverLetterCompositionVersionId: string;
  coverLetterRevisionVersionId: string | null;
  coverLetterAuditRunId: string;
  applicationId: string | null;
  jobOpportunityId: string;
  jobDescriptionVersionId: string;
  predecessorApprovalId: string | null;
  contractVersion: string;
  engineVersion: string;
  configurationVersion: string;
  contentChecksum: string;
  auditInputChecksum: string;
  status: "APPROVED" | "REVOKED" | "SUPERSEDED";
  renderingReadiness: string;
  warningAcknowledged: boolean;
  warningCount: number;
  blockingCount: number;
  approvalNote: string | null;
  warningAcknowledgement: string | null;
  revocationReason: string | null;
  approvedAt: Date;
  revokedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}) {
  return coverLetterApprovalRecordSchema.parse({
    approvalId: approval.id,
    workspaceId: approval.workspaceId,
    sourceType: approval.sourceType,
    sourceId: approval.coverLetterRevisionVersionId ?? approval.coverLetterCompositionVersionId,
    coverLetterCompositionVersionId: approval.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: approval.coverLetterRevisionVersionId,
    coverLetterAuditRunId: approval.coverLetterAuditRunId,
    applicationId: approval.applicationId,
    jobOpportunityId: approval.jobOpportunityId,
    jobDescriptionVersionId: approval.jobDescriptionVersionId,
    predecessorApprovalId: approval.predecessorApprovalId,
    contractVersion: approval.contractVersion,
    engineVersion: approval.engineVersion,
    configurationVersion: approval.configurationVersion,
    contentChecksum: approval.contentChecksum,
    auditInputChecksum: approval.auditInputChecksum,
    status: approval.status,
    renderingReadiness: approval.renderingReadiness,
    warningAcknowledged: approval.warningAcknowledged,
    warningCount: approval.warningCount,
    blockingCount: approval.blockingCount,
    approvalNote: approval.approvalNote,
    warningAcknowledgement: approval.warningAcknowledgement,
    revocationReason: approval.revocationReason,
    approvedAt: approval.approvedAt.toISOString(),
    revokedAt: approval.revokedAt?.toISOString() ?? null,
    supersededAt: approval.supersededAt?.toISOString() ?? null,
    createdAt: approval.createdAt.toISOString()
  });
}

async function resolveApprovalSource(
  workspaceId: string,
  sourceType: SourceType,
  sourceId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  if (sourceType === "BASE_COMPOSITION") {
    const version = await parseStoredCoverLetterCompositionVersion(workspaceId, sourceId, prismaClient);
    const projected = await createCoverLetterRevisionDraftFromComposition({
      composition: version.content,
      predecessor: null,
      revisionId: version.version.id,
      createdAt: version.content.createdAt,
      status: "FINALIZED"
    });

    return {
      sourceType,
      sourceId: version.version.id,
      coverLetterCompositionVersionId: version.version.id,
      coverLetterRevisionVersionId: null,
      applicationId: version.version.applicationId,
      jobOpportunityId: version.version.jobOpportunityId,
      jobDescriptionVersionId: version.version.jobDescriptionVersionId,
      contentChecksum: projected.contentChecksum
    };
  }

  const revision = await getCoverLetterRevisionVersionById(workspaceId, sourceId, prismaClient);
  if (!revision) {
    throw createServiceError({
      code: "SOURCE_NOT_FOUND",
      message: "Cover-letter revision source was not found.",
      status: 404,
      name: "CoverLetterApprovalSourceNotFoundError"
    });
  }

  if (revision.status !== "FINALIZED") {
    throw createServiceError({
      code: "FINALIZED_REVISION_REQUIRED",
      message: "Only finalized cover-letter revisions can be approved.",
      status: 422,
      name: "CoverLetterApprovalMutableDraftError"
    });
  }

  return {
    sourceType,
    sourceId: revision.id,
    coverLetterCompositionVersionId: revision.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: revision.id,
    applicationId: revision.applicationId,
    jobOpportunityId: revision.jobOpportunityId,
    jobDescriptionVersionId: revision.jobDescriptionVersionId,
    contentChecksum: revision.contentChecksum
  };
}

export async function getActiveCoverLetterApproval(
  workspaceId: string,
  args: { jobDescriptionVersionId: string; applicationId?: string | null },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const approval = await delegate(prismaClient).findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null,
      status: "APPROVED"
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  return approval ? toRecord(approval as never) : null;
}

export async function listCoverLetterApprovalHistory(
  workspaceId: string,
  args: { jobDescriptionVersionId: string; applicationId?: string | null },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const approvals = await delegate(prismaClient).findMany({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  return approvals.map((approval) => toRecord(approval as never));
}

export async function getCoverLetterApprovalContext(
  workspaceId: string,
  args: { jobDescriptionVersionId: string; applicationId?: string | null },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const [activeApproval, history] = await Promise.all([
    getActiveCoverLetterApproval(workspaceId, args, prismaClient),
    listCoverLetterApprovalHistory(workspaceId, args, prismaClient)
  ]);

  return {
    activeApproval,
    history
  };
}

export async function getCoverLetterApprovalEligibility(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
    sourceType: SourceType;
    sourceId: string;
    coverLetterAuditRunId: string;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
): Promise<CoverLetterApprovalEligibility> {
  const source = await resolveApprovalSource(workspaceId, args.sourceType, args.sourceId, prismaClient);
  const diagnostics: CoverLetterApprovalDiagnostic[] = [];

  if (source.jobDescriptionVersionId !== args.jobDescriptionVersionId) {
    diagnostics.push(
      toDiagnostic(
        "JOB_DESCRIPTION_LINEAGE_MISMATCH",
        "ERROR",
        "The proposed cover-letter source does not belong to this job-description lineage."
      )
    );
  }

  if (
    source.applicationId !== null &&
    (args.applicationId ?? null) !== null &&
    source.applicationId !== args.applicationId
  ) {
    diagnostics.push(
      toDiagnostic(
        "APPLICATION_LINKAGE_MISMATCH",
        "ERROR",
        "The proposed cover-letter source does not match the selected application linkage."
      )
    );
  }

  const auditRun = await getCoverLetterAuditRunById(workspaceId, args.coverLetterAuditRunId, prismaClient);
  if (!auditRun) {
    diagnostics.push(
      toDiagnostic("MISSING_AUDIT", "ERROR", "A matching cover-letter audit is required before approval.")
    );
  }

  const parsedAudit = auditRun
    ? await parseStoredCoverLetterAuditRun(workspaceId, auditRun.id, prismaClient)
    : null;

  const exactSourceMatch =
    source.sourceType === "BASE_COMPOSITION"
      ? auditRun?.sourceType === "BASE_COMPOSITION" &&
        auditRun.coverLetterCompositionVersionId === source.coverLetterCompositionVersionId &&
        auditRun.coverLetterRevisionVersionId === null
      : auditRun?.sourceType === "FINALIZED_REVISION" &&
        auditRun.coverLetterRevisionVersionId === source.coverLetterRevisionVersionId;

  if (auditRun && !exactSourceMatch) {
    diagnostics.push(
      toDiagnostic("AUDIT_SOURCE_MISMATCH", "ERROR", "The audit does not match the proposed cover-letter source.")
    );
  }

  if (auditRun && auditRun.jobDescriptionVersionId !== source.jobDescriptionVersionId) {
    diagnostics.push(
      toDiagnostic("AUDIT_LINEAGE_MISMATCH", "ERROR", "The audit belongs to a different job-description lineage.")
    );
  }

  const blockingCount = parsedAudit?.result.summary.blockingFindingCount ?? 0;
  const warningCount = parsedAudit?.result.summary.warningCount ?? 0;

  if (auditRun && auditRun.contentChecksum !== source.contentChecksum) {
    diagnostics.push(
      toDiagnostic("CHECKSUM_MISMATCH", "ERROR", "The audit checksum does not match the proposed cover-letter source.")
    );
  }

  if (
    parsedAudit?.result.renderingReadiness === "BLOCKED" ||
    parsedAudit?.result.renderingReadiness === "NEEDS_REVIEW"
  ) {
    diagnostics.push(
      toDiagnostic("AUDIT_BLOCKED", "ERROR", "Resolve the current cover-letter audit findings before approval.")
    );
  }

  if (blockingCount > 0) {
    diagnostics.push(
      toDiagnostic("BLOCKING_FINDINGS", "ERROR", "Resolve blocking cover-letter audit findings before approval.")
    );
  }

  const activeApproval = await getActiveCoverLetterApproval(
    workspaceId,
    {
      jobDescriptionVersionId: source.jobDescriptionVersionId,
      applicationId: source.applicationId
    },
    prismaClient
  );

  if (activeApproval?.sourceType === source.sourceType && activeApproval.sourceId === source.sourceId) {
    diagnostics.push(
      toDiagnostic(
        "APPROVAL_ALREADY_ACTIVE",
        "INFORMATION",
        "The proposed cover letter is already the active approved source.",
        false
      )
    );
  } else if (activeApproval) {
    diagnostics.push(
      toDiagnostic(
        "APPROVAL_WILL_SUPERSEDE_ACTIVE",
        "INFORMATION",
        "Approving this cover letter will supersede the current active approval.",
        false
      )
    );
  }

  const eligible = diagnostics.every((diagnostic) => !diagnostic.blocking);
  const eligibleWithWarnings = eligible && warningCount > 0;

  return coverLetterApprovalEligibilitySchema.parse({
    eligible,
    eligibleWithWarnings,
    warningAcknowledgementRequired: eligibleWithWarnings,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    coverLetterCompositionVersionId: source.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: source.coverLetterRevisionVersionId,
    coverLetterAuditRunId: auditRun?.id ?? null,
    contentChecksum: source.contentChecksum,
    renderingReadiness: parsedAudit?.result.renderingReadiness ?? null,
    warningCount,
    blockingCount,
    diagnostics
  });
}

export async function approveCoverLetterRevision(
  workspaceId: string,
  request: CoverLetterApprovalCreateRequest,
  prismaClient: PrismaClient = prisma
) {
  const parsedRequest = coverLetterApprovalCreateRequestSchema.parse(request);

  return prismaClient.$transaction(async (transaction) => {
    const source = await resolveApprovalSource(
      workspaceId,
      parsedRequest.sourceType,
      parsedRequest.sourceId,
      transaction
    );

    const eligibility = await getCoverLetterApprovalEligibility(
      workspaceId,
      {
        jobDescriptionVersionId: parsedRequest.jobDescriptionVersionId,
        applicationId: parsedRequest.applicationId ?? null,
        sourceType: parsedRequest.sourceType,
        sourceId: parsedRequest.sourceId,
        coverLetterAuditRunId: parsedRequest.coverLetterAuditRunId
      },
      transaction
    );

    if (!eligibility.eligible) {
      throw createServiceError({
        code: "NOT_ELIGIBLE",
        message: "This cover letter is not eligible for approval.",
        status: 422,
        name: "CoverLetterApprovalEligibilityError",
        diagnostics: eligibility.diagnostics
      });
    }

    if (source.contentChecksum !== parsedRequest.expectedContentChecksum) {
      throw createServiceError({
        code: "CHECKSUM_MISMATCH",
        message: "The cover-letter content changed before approval.",
        status: 409,
        name: "CoverLetterApprovalChecksumMismatchError"
      });
    }

    if (
      eligibility.warningAcknowledgementRequired &&
      (!parsedRequest.warningAcknowledged ||
        parsedRequest.warningAcknowledgement !== COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT)
    ) {
      throw createServiceError({
        code: "WARNING_ACKNOWLEDGEMENT_REQUIRED",
        message: "Approving with warnings requires the exact acknowledgement phrase.",
        status: 422,
        name: "CoverLetterApprovalWarningAcknowledgementError"
      });
    }

    const activeApproval = await getActiveCoverLetterApproval(
      workspaceId,
      {
        jobDescriptionVersionId: source.jobDescriptionVersionId,
        applicationId: source.applicationId
      },
      transaction
    );

    if ((activeApproval?.approvalId ?? null) !== (parsedRequest.expectedCurrentApprovalId ?? null)) {
      throw createServiceError({
        code: "ACTIVE_APPROVAL_CHANGED",
        message: "The active cover-letter approval changed before this request completed.",
        status: 409,
        name: "CoverLetterApprovalConflictError"
      });
    }

    if (
      activeApproval &&
      activeApproval.sourceType === source.sourceType &&
      activeApproval.sourceId === source.sourceId &&
      activeApproval.coverLetterAuditRunId === parsedRequest.coverLetterAuditRunId &&
      activeApproval.contentChecksum === source.contentChecksum
    ) {
      return {
        approval: activeApproval,
        duplicate: true
      };
    }

    if (activeApproval) {
      await delegate(transaction).update({
        where: { id: activeApproval.approvalId },
        data: {
          status: "SUPERSEDED",
          supersededAt: new Date()
        }
      });
    }

    const auditRun = await getCoverLetterAuditRunById(workspaceId, parsedRequest.coverLetterAuditRunId, transaction);
    const approval = await delegate(transaction).create({
      data: {
        workspaceId,
        sourceType: source.sourceType,
        coverLetterCompositionVersionId: source.coverLetterCompositionVersionId,
        coverLetterRevisionVersionId: source.coverLetterRevisionVersionId,
        coverLetterAuditRunId: parsedRequest.coverLetterAuditRunId,
        applicationId: source.applicationId,
        jobOpportunityId: source.jobOpportunityId,
        jobDescriptionVersionId: source.jobDescriptionVersionId,
        predecessorApprovalId: activeApproval?.approvalId ?? null,
        contractVersion: COVER_LETTER_APPROVAL_CONTRACT_VERSION,
        engineVersion: COVER_LETTER_APPROVAL_ENGINE_VERSION,
        configurationVersion: COVER_LETTER_APPROVAL_CONFIGURATION_VERSION,
        contentChecksum: source.contentChecksum,
        auditInputChecksum: auditRun?.inputChecksum ?? "",
        renderingReadiness: eligibility.renderingReadiness ?? "READY_FOR_RENDERING",
        warningAcknowledged: parsedRequest.warningAcknowledged,
        warningCount: eligibility.warningCount,
        blockingCount: eligibility.blockingCount,
        approvalNote: parsedRequest.approvalNote ?? null,
        warningAcknowledgement: parsedRequest.warningAcknowledgement ?? null
      }
    });

    return {
      approval: toRecord(approval as never),
      duplicate: false
    };
  });
}

export async function revokeCoverLetterApproval(
  workspaceId: string,
  request: CoverLetterApprovalRevokeRequest,
  prismaClient: PrismaClient = prisma
) {
  const parsedRequest = coverLetterApprovalRevokeRequestSchema.parse(request);

  return prismaClient.$transaction(async (transaction) => {
    const approval = await delegate(transaction).findFirst({
      where: {
        id: parsedRequest.approvalId,
        workspaceId
      }
    });

    if (!approval) {
      throw createServiceError({
        code: "APPROVAL_NOT_FOUND",
        message: "Cover-letter approval was not found.",
        status: 404,
        name: "CoverLetterApprovalNotFoundError"
      });
    }

    if ((parsedRequest.expectedActiveApprovalId ?? null) !== approval.id) {
      throw createServiceError({
        code: "ACTIVE_APPROVAL_CHANGED",
        message: "The active cover-letter approval changed before this request completed.",
        status: 409,
        name: "CoverLetterApprovalConflictError"
      });
    }

    if (approval.status !== "APPROVED") {
      throw createServiceError({
        code: approval.status === "REVOKED" ? "APPROVAL_REVOKED" : "PRIOR_APPROVAL_SUPERSEDED",
        message:
          approval.status === "REVOKED"
            ? "This cover-letter approval has already been revoked."
            : "Only the current active cover-letter approval can be revoked.",
        status: 409,
        name: "CoverLetterApprovalConflictError"
      });
    }

    const revoked = await delegate(transaction).update({
      where: { id: approval.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revocationReason: parsedRequest.reason ?? null
      }
    });

    return toRecord(revoked as never);
  });
}
