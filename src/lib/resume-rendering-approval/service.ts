import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compareResumeSources } from "@/lib/resume-comparison/service";
import type { ResumeComparisonDiagnostic } from "@/lib/resume-comparison/contract";
import {
  RENDERING_APPROVAL_CONFIGURATION_VERSION,
  RENDERING_APPROVAL_CONTRACT_VERSION,
  RENDERING_APPROVAL_ENGINE_VERSION,
  RENDERING_WARNING_ACKNOWLEDGEMENT
} from "@/lib/resume-rendering-approval/config";
import {
  approvedResumeForRenderingSchema,
  resumeRenderingApprovalCreateRequestSchema,
  resumeRenderingApprovalEligibilitySchema,
  resumeRenderingApprovalRecordSchema,
  resumeRenderingApprovalRevokeRequestSchema,
  type ResumeRenderingApprovalCreateRequest,
  type ResumeRenderingApprovalEligibility,
  type ResumeRenderingApprovalRecord,
  type ResumeRenderingApprovalRevokeRequest
} from "@/lib/resume-rendering-approval/contract";
import { getResumeAuditRunById, parseStoredResumeAuditRun } from "@/lib/resume-audit/service";
import { getResumeCompositionVersionById, parseStoredResumeCompositionVersion } from "@/lib/resume-composition/service";
import { projectResumeRevisionToCompositionContent } from "@/lib/resume-revision/engine";
import { getResumeRevisionVersionById, parseStoredResumeRevisionVersion } from "@/lib/resume-revision/service";

type TransactionClient = Prisma.TransactionClient;
type SourceType = "BASE_COMPOSITION" | "FINALIZED_REVISION";
type ApprovalStatus = "APPROVED" | "REVOKED" | "SUPERSEDED";

type ApprovalSource = {
  sourceType: SourceType;
  sourceId: string;
  resumeCompositionVersionId: string;
  resumeRevisionVersionId: string | null;
  structuredResumeVersionId: string;
  careerProfileVersionId: string;
  matchReportRunId: string;
  requirementAnalysisId: string;
  jobDescriptionVersionId: string;
  applicationId: string | null;
  contentChecksum: string;
};

type RenderingGateResult = {
  approval: ResumeRenderingApprovalRecord;
  auditId: string;
  sourceType: SourceType;
  sourceId: string;
  contentChecksum: string;
  renderingReadiness: "READY_FOR_RENDERING" | "READY_WITH_WARNINGS";
  content: Awaited<ReturnType<typeof parseStoredResumeCompositionVersion>>["content"];
  audit: Awaited<ReturnType<typeof parseStoredResumeAuditRun>>["result"];
};

export class ResumeRenderingApprovalServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly diagnostics?: ResumeComparisonDiagnostic[];

  constructor(args: {
    code: string;
    message: string;
    status: number;
    name: string;
    diagnostics?: ResumeComparisonDiagnostic[];
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
  diagnostics?: ResumeComparisonDiagnostic[];
}) {
  return new ResumeRenderingApprovalServiceError(args);
}

function mapDiagnostic(
  code: string,
  severity: "ERROR" | "WARNING" | "INFORMATION",
  message: string,
  blocking = severity === "ERROR"
): ResumeComparisonDiagnostic {
  return {
    code,
    severity,
    message,
    blocking
  };
}

function toApprovalRecord(
  approval: {
    id: string;
    workspaceId: string;
    resumeArtifactType: "RESUME";
    sourceType: SourceType;
    resumeCompositionVersionId: string | null;
    resumeRevisionVersionId: string | null;
    resumeAuditRunId: string;
    structuredResumeVersionId: string;
    careerProfileVersionId: string;
    matchReportRunId: string;
    requirementAnalysisId: string;
    jobDescriptionVersionId: string;
    applicationId: string | null;
    predecessorApprovalId: string | null;
    approverType: "WORKSPACE_OWNER";
    contractVersion: string;
    engineVersion: string;
    configurationVersion: string;
    contentChecksum: string;
    auditInputChecksum: string;
    status: ApprovalStatus;
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
  }
): ResumeRenderingApprovalRecord {
  return resumeRenderingApprovalRecordSchema.parse({
    approvalId: approval.id,
    workspaceId: approval.workspaceId,
    resumeArtifactType: approval.resumeArtifactType,
    sourceType: approval.sourceType,
    sourceId: approval.resumeRevisionVersionId ?? approval.resumeCompositionVersionId,
    resumeCompositionVersionId: approval.resumeCompositionVersionId,
    resumeRevisionVersionId: approval.resumeRevisionVersionId,
    resumeAuditRunId: approval.resumeAuditRunId,
    structuredResumeVersionId: approval.structuredResumeVersionId,
    careerProfileVersionId: approval.careerProfileVersionId,
    matchReportRunId: approval.matchReportRunId,
    requirementAnalysisId: approval.requirementAnalysisId,
    jobDescriptionVersionId: approval.jobDescriptionVersionId,
    applicationId: approval.applicationId,
    predecessorApprovalId: approval.predecessorApprovalId,
    approverType: approval.approverType,
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

function approvalDelegate(prismaClient: PrismaClient | TransactionClient) {
  return (prismaClient as PrismaClient & {
    resumeRenderingApproval: {
      findFirst: (...args: any[]) => Promise<any>;
      findMany: (...args: any[]) => Promise<any[]>;
      create: (...args: any[]) => Promise<any>;
      update: (...args: any[]) => Promise<any>;
    };
  }).resumeRenderingApproval;
}

async function resolveApprovalSource(
  workspaceId: string,
  sourceType: SourceType,
  sourceId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
): Promise<ApprovalSource> {
  if (sourceType === "BASE_COMPOSITION") {
    const version = await getResumeCompositionVersionById(workspaceId, sourceId, prismaClient);
    if (!version) {
      throw createServiceError({
        code: "SOURCE_NOT_FOUND",
        message: "Resume composition source was not found.",
        status: 404,
        name: "ResumeRenderingApprovalSourceNotFoundError"
      });
    }

    return {
      sourceType,
      sourceId: version.id,
      resumeCompositionVersionId: version.id,
      resumeRevisionVersionId: null,
      structuredResumeVersionId: version.structuredResumeVersionId,
      careerProfileVersionId: version.careerProfileVersionId,
      matchReportRunId: version.matchReportRunId,
      requirementAnalysisId: version.requirementAnalysisId,
      jobDescriptionVersionId: version.jobDescriptionVersionId,
      applicationId: version.applicationId,
      contentChecksum: version.inputChecksum
    };
  }

  const revision = await getResumeRevisionVersionById(workspaceId, sourceId, prismaClient);
  if (!revision) {
    throw createServiceError({
      code: "SOURCE_NOT_FOUND",
      message: "Resume revision source was not found.",
      status: 404,
      name: "ResumeRenderingApprovalSourceNotFoundError"
    });
  }

  if (!["READY_FOR_AUDIT", "AUDITED", "NEEDS_REVIEW"].includes(revision.status)) {
    throw createServiceError({
      code: "MUTABLE_DRAFT",
      message: "Mutable draft revisions cannot be approved for rendering.",
      status: 422,
      name: "ResumeRenderingApprovalMutableDraftError"
    });
  }

  return {
    sourceType,
    sourceId: revision.id,
    resumeCompositionVersionId: revision.baseResumeCompositionVersionId,
    resumeRevisionVersionId: revision.id,
    structuredResumeVersionId: revision.structuredResumeVersionId,
    careerProfileVersionId: revision.careerProfileVersionId,
    matchReportRunId: revision.matchReportRunId,
    requirementAnalysisId: revision.requirementAnalysisId,
    jobDescriptionVersionId: revision.jobDescriptionVersionId,
    applicationId: revision.applicationId,
    contentChecksum: revision.inputChecksum
  };
}

async function resolveContentAndAudit(args: {
  workspaceId: string;
  sourceType: SourceType;
  sourceId: string;
  resumeAuditRunId: string;
  prismaClient?: PrismaClient | TransactionClient;
}) {
  const prismaClient = args.prismaClient ?? prisma;
  const source = await resolveApprovalSource(
    args.workspaceId,
    args.sourceType,
    args.sourceId,
    prismaClient
  );
  const auditRun = await getResumeAuditRunById(args.workspaceId, args.resumeAuditRunId, prismaClient);

  if (!auditRun) {
    throw createServiceError({
      code: "MISSING_AUDIT",
      message: "A matching resume audit is required before rendering approval.",
      status: 422,
      name: "ResumeRenderingApprovalMissingAuditError"
    });
  }

  const audit = await parseStoredResumeAuditRun(args.workspaceId, args.resumeAuditRunId, prismaClient);
  const exactSourceMatch =
    source.sourceType === "BASE_COMPOSITION"
      ? audit.run.resumeCompositionVersionId === source.resumeCompositionVersionId &&
        audit.run.resumeRevisionVersionId === null
      : audit.run.resumeRevisionVersionId === source.resumeRevisionVersionId;

  return {
    source,
    auditRun,
    audit,
    exactSourceMatch
  };
}

export async function getActiveResumeRenderingApproval(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const approval = await approvalDelegate(prismaClient).findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null,
      resumeArtifactType: "RESUME",
      status: "APPROVED"
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  return approval ? toApprovalRecord(approval as never) : null;
}

export async function listResumeRenderingApprovalHistory(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const approvals = await approvalDelegate(prismaClient).findMany({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null,
      resumeArtifactType: "RESUME"
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  return approvals.map((approval) => toApprovalRecord(approval as never));
}

export async function getResumeRenderingApprovalEligibility(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
    sourceType: SourceType;
    sourceId: string;
    resumeAuditRunId: string;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
): Promise<ResumeRenderingApprovalEligibility> {
  const diagnostics: ResumeComparisonDiagnostic[] = [];
  const { source, audit, exactSourceMatch } = await resolveContentAndAudit({
    workspaceId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    resumeAuditRunId: args.resumeAuditRunId,
    prismaClient
  });

  if (source.jobDescriptionVersionId !== args.jobDescriptionVersionId) {
    diagnostics.push(
      mapDiagnostic(
        "approval.job-description-lineage-mismatch",
        "ERROR",
        "The proposed content source does not belong to this job-description lineage."
      )
    );
  }

  if (
    source.applicationId !== null &&
    (args.applicationId ?? null) !== null &&
    source.applicationId !== args.applicationId
  ) {
    diagnostics.push(
      mapDiagnostic(
        "approval.application-mismatch",
        "ERROR",
        "The proposed content source does not match the selected application linkage."
      )
    );
  }

  if (!exactSourceMatch) {
    diagnostics.push(
      mapDiagnostic(
        "approval.audit-content-mismatch",
        "ERROR",
        "The selected audit does not reference this exact immutable resume source."
      )
    );
  }

  if (audit.run.jobDescriptionVersionId !== source.jobDescriptionVersionId) {
    diagnostics.push(
      mapDiagnostic(
        "approval.audit-lineage-mismatch",
        "ERROR",
        "The selected audit belongs to a different job-description lineage."
      )
    );
  }

  const blockingCount = audit.result.findings.filter((finding) => finding.blocksRendering).length;
  const warningCount = audit.result.findings.filter((finding) => finding.severity === "WARNING").length;

  if (audit.result.renderingReadiness === "BLOCKED") {
    diagnostics.push(
      mapDiagnostic(
        "approval.audit-blocked",
        "ERROR",
        "Rendering approval is blocked because the audit still contains blocking findings."
      )
    );
  }

  if (audit.result.renderingReadiness === "NEEDS_REVIEW") {
    diagnostics.push(
      mapDiagnostic(
        "approval.audit-needs-review",
        "ERROR",
        "Rendering approval is blocked because the audit still needs review."
      )
    );
  }

  if (blockingCount > 0) {
    diagnostics.push(
      mapDiagnostic(
        "approval.blocking-findings-remain",
        "ERROR",
        "Rendering approval is blocked until all blocking audit findings are resolved."
      )
    );
  }

  if (source.sourceType === "FINALIZED_REVISION" && source.resumeRevisionVersionId) {
    const comparisonLeft = await compareResumeSources(
      workspaceId,
      {
        comparisonMode: "BASE_VS_REVISION",
        leftSourceType: "BASE_COMPOSITION",
        leftSourceId: source.resumeCompositionVersionId,
        rightSourceType: "FINALIZED_REVISION",
        rightSourceId: source.resumeRevisionVersionId,
        jobDescriptionVersionId: source.jobDescriptionVersionId
      },
      prismaClient as PrismaClient
    );
    diagnostics.push(
      ...comparisonLeft.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: diagnostic.severity === "ERROR" ? "WARNING" : diagnostic.severity,
        blocking: false
      }))
    );
  }

  const activeApproval = await getActiveResumeRenderingApproval(
    workspaceId,
    {
      jobDescriptionVersionId: source.jobDescriptionVersionId,
      applicationId: source.applicationId
    },
    prismaClient
  );

  if (activeApproval?.sourceType === source.sourceType && activeApproval.sourceId === source.sourceId) {
    diagnostics.push(
      mapDiagnostic(
        "approval.already-active",
        "INFORMATION",
        "The proposed content is already the active approved resume for rendering.",
        false
      )
    );
  } else if (activeApproval) {
    diagnostics.push(
      mapDiagnostic(
        "approval.will-supersede-active",
        "INFORMATION",
        "Approving this content will supersede the currently active rendering approval.",
        false
      )
    );
  } else {
    diagnostics.push(
      mapDiagnostic(
        "approval.no-active-approval",
        "INFORMATION",
        "No active rendering approval exists yet for this application and job description.",
        false
      )
    );
  }

  const eligible =
    diagnostics.every((diagnostic) => !diagnostic.blocking) &&
    (audit.result.renderingReadiness === "READY_FOR_RENDERING" ||
      audit.result.renderingReadiness === "READY_WITH_WARNINGS");

  return resumeRenderingApprovalEligibilitySchema.parse({
    eligible,
    eligibleWithWarnings: eligible && audit.result.renderingReadiness === "READY_WITH_WARNINGS",
    warningAcknowledgementRequired:
      audit.result.renderingReadiness === "READY_WITH_WARNINGS" && warningCount > 0,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    resumeAuditRunId: audit.run.id,
    renderingReadiness: audit.result.renderingReadiness,
    warningCount,
    blockingCount,
    contentChecksum: source.contentChecksum,
    diagnostics
  });
}

export async function approveResumeForRendering(
  workspaceId: string,
  request: ResumeRenderingApprovalCreateRequest,
  prismaClient: PrismaClient = prisma
) {
  const parsed = resumeRenderingApprovalCreateRequestSchema.parse(request);

  return prismaClient.$transaction(async (transaction) => {
    const { source, auditRun, audit } = await resolveContentAndAudit({
      workspaceId,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      resumeAuditRunId: parsed.resumeAuditRunId,
      prismaClient: transaction
    });
    const eligibility = await getResumeRenderingApprovalEligibility(
      workspaceId,
      {
        jobDescriptionVersionId: parsed.jobDescriptionVersionId,
        applicationId: parsed.applicationId ?? null,
        sourceType: parsed.sourceType,
        sourceId: parsed.sourceId,
        resumeAuditRunId: parsed.resumeAuditRunId
      },
      transaction
    );

    if (!eligibility.eligible) {
      throw createServiceError({
        code: "APPROVAL_BLOCKED",
        message: "Rendering approval is not eligible for this content source.",
        status: 422,
        name: "ResumeRenderingApprovalBlockedError",
        diagnostics: eligibility.diagnostics
      });
    }

    if ((eligibility.contentChecksum ?? null) !== parsed.expectedContentChecksum) {
      throw createServiceError({
        code: "CONTENT_CHECKSUM_MISMATCH",
        message: "The content changed before approval could be recorded.",
        status: 409,
        name: "ResumeRenderingApprovalConflictError"
      });
    }

    if (
      eligibility.warningAcknowledgementRequired &&
      (!parsed.warningAcknowledged ||
        parsed.warningAcknowledgement !== RENDERING_WARNING_ACKNOWLEDGEMENT)
    ) {
      throw createServiceError({
        code: "MISSING_WARNING_ACKNOWLEDGEMENT",
        message: "Approval with non-blocking warnings requires the exact acknowledgement text.",
        status: 422,
        name: "ResumeRenderingApprovalWarningAcknowledgementError"
      });
    }

    const activeApproval = await approvalDelegate(transaction).findFirst({
      where: {
        workspaceId,
        jobDescriptionVersionId: source.jobDescriptionVersionId,
        applicationId: source.applicationId,
        resumeArtifactType: "RESUME",
        status: "APPROVED"
      },
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
    });

    if ((parsed.expectedCurrentApprovalId ?? null) !== (activeApproval?.id ?? null)) {
      throw createServiceError({
        code: "STALE_ACTIVE_APPROVAL",
        message: "Another rendering approval became active before this submission completed.",
        status: 409,
        name: "ResumeRenderingApprovalConflictError"
      });
    }

    if (
      activeApproval &&
      activeApproval.sourceType === source.sourceType &&
      activeApproval.resumeAuditRunId === audit.run.id &&
      activeApproval.contentChecksum === source.contentChecksum &&
      activeApproval.warningAcknowledged === parsed.warningAcknowledged &&
      activeApproval.contractVersion === RENDERING_APPROVAL_CONTRACT_VERSION &&
      activeApproval.engineVersion === RENDERING_APPROVAL_ENGINE_VERSION &&
      activeApproval.configurationVersion === RENDERING_APPROVAL_CONFIGURATION_VERSION
    ) {
      return {
        approval: toApprovalRecord(activeApproval as never),
        duplicate: true
      };
    }

    const now = new Date();
    if (activeApproval) {
      await approvalDelegate(transaction).update({
        where: { id: activeApproval.id },
        data: {
          status: "SUPERSEDED",
          supersededAt: now
        }
      });
    }

    const created = await approvalDelegate(transaction).create({
      data: {
        workspaceId,
        resumeArtifactType: "RESUME",
        sourceType: source.sourceType,
        resumeCompositionVersionId:
          source.sourceType === "BASE_COMPOSITION" ? source.resumeCompositionVersionId : null,
        resumeRevisionVersionId:
          source.sourceType === "FINALIZED_REVISION" ? source.resumeRevisionVersionId : null,
        resumeAuditRunId: audit.run.id,
        structuredResumeVersionId: source.structuredResumeVersionId,
        careerProfileVersionId: source.careerProfileVersionId,
        matchReportRunId: source.matchReportRunId,
        requirementAnalysisId: source.requirementAnalysisId,
        jobDescriptionVersionId: source.jobDescriptionVersionId,
        applicationId: source.applicationId,
        predecessorApprovalId: activeApproval?.id ?? null,
        approverType: "WORKSPACE_OWNER",
        contractVersion: RENDERING_APPROVAL_CONTRACT_VERSION,
        engineVersion: RENDERING_APPROVAL_ENGINE_VERSION,
        configurationVersion: RENDERING_APPROVAL_CONFIGURATION_VERSION,
        contentChecksum: source.contentChecksum,
        auditInputChecksum: auditRun.inputChecksum,
        status: "APPROVED",
        renderingReadiness: audit.result.renderingReadiness,
        warningAcknowledged: parsed.warningAcknowledged,
        warningCount: eligibility.warningCount,
        blockingCount: eligibility.blockingCount,
        approvalNote: parsed.approvalNote ?? null,
        warningAcknowledgement: parsed.warningAcknowledgement ?? null,
        approvedAt: now
      }
    });

    return {
      approval: toApprovalRecord(created as never),
      duplicate: false
    };
  });
}

export async function revokeResumeRenderingApproval(
  workspaceId: string,
  request: ResumeRenderingApprovalRevokeRequest,
  prismaClient: PrismaClient = prisma
) {
  const parsed = resumeRenderingApprovalRevokeRequestSchema.parse(request);

  return prismaClient.$transaction(async (transaction) => {
    const approval = await approvalDelegate(transaction).findFirst({
      where: {
        id: parsed.approvalId,
        workspaceId
      }
    });

    if (!approval) {
      throw createServiceError({
        code: "APPROVAL_NOT_FOUND",
        message: "Rendering approval was not found.",
        status: 404,
        name: "ResumeRenderingApprovalNotFoundError"
      });
    }

    if (approval.status !== "APPROVED") {
      throw createServiceError({
        code: approval.status === "REVOKED" ? "APPROVAL_REVOKED" : "PRIOR_APPROVAL_SUPERSEDED",
        message:
          approval.status === "REVOKED"
            ? "This rendering approval has already been revoked."
            : "Only the current active rendering approval can be revoked.",
        status: 409,
        name: "ResumeRenderingApprovalConflictError"
      });
    }

    if ((parsed.expectedActiveApprovalId ?? null) !== approval.id) {
      throw createServiceError({
        code: "STALE_ACTIVE_APPROVAL",
        message: "Another rendering approval change happened before this revoke request completed.",
        status: 409,
        name: "ResumeRenderingApprovalConflictError"
      });
    }

    const revoked = await approvalDelegate(transaction).update({
      where: { id: approval.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revocationReason: parsed.reason ?? null
      }
    });

    return toApprovalRecord(revoked as never);
  });
}

export async function getApprovedResumeForRendering(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
): Promise<RenderingGateResult> {
  const approval = await approvalDelegate(prismaClient).findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null,
      resumeArtifactType: "RESUME",
      status: "APPROVED"
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  if (!approval) {
    throw createServiceError({
      code: "MISSING_APPROVAL",
      message: "No active rendering approval exists for this resume.",
      status: 404,
      name: "ResumeRenderingApprovalMissingError"
    });
  }

  const sourceType = approval.sourceType;
  const sourceId = approval.resumeRevisionVersionId ?? approval.resumeCompositionVersionId;

  if (!sourceId) {
    throw createServiceError({
      code: "CONTENT_MISMATCH",
      message: "The active rendering approval no longer points to a valid immutable source.",
      status: 409,
      name: "ResumeRenderingApprovalMismatchError"
    });
  }

  const source = await resolveApprovalSource(workspaceId, sourceType, sourceId, prismaClient);
  if (source.contentChecksum !== approval.contentChecksum) {
    throw createServiceError({
      code: "CONTENT_MISMATCH",
      message: "The active rendering approval no longer matches the current immutable content checksum.",
      status: 409,
      name: "ResumeRenderingApprovalMismatchError"
    });
  }

  const audit = await parseStoredResumeAuditRun(workspaceId, approval.resumeAuditRunId, prismaClient);
  const exactSourceMatch =
    sourceType === "BASE_COMPOSITION"
      ? audit.run.resumeCompositionVersionId === source.resumeCompositionVersionId &&
        audit.run.resumeRevisionVersionId === null
      : audit.run.resumeRevisionVersionId === source.resumeRevisionVersionId;

  if (!exactSourceMatch || audit.run.inputChecksum !== approval.auditInputChecksum) {
    throw createServiceError({
      code: "AUDIT_CHECKSUM_MISMATCH",
      message: "The active rendering approval no longer matches the exact audited resume source.",
      status: 409,
      name: "ResumeRenderingApprovalMismatchError"
    });
  }

  if (
    audit.result.renderingReadiness !== "READY_FOR_RENDERING" &&
    audit.result.renderingReadiness !== "READY_WITH_WARNINGS"
  ) {
    throw createServiceError({
      code: "AUDIT_BLOCKED",
      message: "The approved rendering source is no longer eligible for rendering.",
      status: 409,
      name: "ResumeRenderingApprovalMismatchError"
    });
  }

  const content =
    sourceType === "BASE_COMPOSITION"
      ? (await parseStoredResumeCompositionVersion(workspaceId, source.resumeCompositionVersionId, prismaClient)).content
      : projectResumeRevisionToCompositionContent({
          content: (
            await parseStoredResumeRevisionVersion(workspaceId, source.resumeRevisionVersionId!, prismaClient)
          ).record.content
        });

  return {
    approval: toApprovalRecord(approval as never),
    auditId: audit.run.id,
    sourceType,
    sourceId,
    contentChecksum: source.contentChecksum,
    renderingReadiness: approvedResumeForRenderingSchema.parse({
      approval: toApprovalRecord(approval as never),
      auditId: audit.run.id,
      sourceType,
      sourceId,
      contentChecksum: source.contentChecksum,
      renderingReadiness: audit.result.renderingReadiness
    }).renderingReadiness as "READY_FOR_RENDERING" | "READY_WITH_WARNINGS",
    content,
    audit: audit.result
  };
}
