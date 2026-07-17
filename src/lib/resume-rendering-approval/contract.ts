import { z } from "zod";
import { renderingReadinessSchema } from "@/lib/resume-audit/contract";
import { resumeComparisonDiagnosticSchema, resumeComparisonSourceTypeSchema } from "@/lib/resume-comparison/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const resumeRenderingApprovalStatusSchema = z.enum([
  "APPROVED",
  "REVOKED",
  "SUPERSEDED"
]);

export const resumeRenderingArtifactTypeSchema = z.enum(["RESUME"]);
export const resumeRenderingApproverTypeSchema = z.enum(["WORKSPACE_OWNER"]);

export const resumeRenderingApprovalRecordSchema = z.object({
  approvalId: z.string().min(1),
  workspaceId: z.string().min(1),
  resumeArtifactType: resumeRenderingArtifactTypeSchema,
  sourceType: resumeComparisonSourceTypeSchema,
  sourceId: z.string().min(1),
  resumeCompositionVersionId: z.string().nullable(),
  resumeRevisionVersionId: z.string().nullable(),
  resumeAuditRunId: z.string().min(1),
  structuredResumeVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  predecessorApprovalId: z.string().nullable(),
  approverType: resumeRenderingApproverTypeSchema,
  contractVersion: semanticVersionSchema,
  engineVersion: semanticVersionSchema,
  configurationVersion: semanticVersionSchema,
  contentChecksum: z.string().min(1),
  auditInputChecksum: z.string().min(1),
  status: resumeRenderingApprovalStatusSchema,
  renderingReadiness: renderingReadinessSchema,
  warningAcknowledged: z.boolean(),
  warningCount: z.number().int().nonnegative(),
  blockingCount: z.number().int().nonnegative(),
  approvalNote: z.string().nullable(),
  warningAcknowledgement: z.string().nullable(),
  revocationReason: z.string().nullable(),
  approvedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  supersededAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
});

export const resumeRenderingApprovalEligibilitySchema = z.object({
  eligible: z.boolean(),
  eligibleWithWarnings: z.boolean(),
  warningAcknowledgementRequired: z.boolean(),
  sourceType: resumeComparisonSourceTypeSchema,
  sourceId: z.string().min(1),
  resumeAuditRunId: z.string().nullable(),
  renderingReadiness: renderingReadinessSchema.nullable(),
  warningCount: z.number().int().nonnegative(),
  blockingCount: z.number().int().nonnegative(),
  contentChecksum: z.string().nullable(),
  diagnostics: z.array(resumeComparisonDiagnosticSchema)
});

export const resumeRenderingApprovalCreateRequestSchema = z.object({
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable().optional(),
  sourceType: resumeComparisonSourceTypeSchema,
  sourceId: z.string().min(1),
  resumeAuditRunId: z.string().min(1),
  expectedContentChecksum: z.string().min(1),
  expectedCurrentApprovalId: z.string().nullable().optional(),
  warningAcknowledged: z.boolean().default(false),
  warningAcknowledgement: z.string().nullable().optional(),
  approvalNote: z.string().trim().max(500).nullable().optional()
});

export const resumeRenderingApprovalRevokeRequestSchema = z.object({
  approvalId: z.string().min(1),
  expectedActiveApprovalId: z.string().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional()
});

export const approvedResumeForRenderingSchema = z.object({
  approval: resumeRenderingApprovalRecordSchema,
  auditId: z.string().min(1),
  sourceType: resumeComparisonSourceTypeSchema,
  sourceId: z.string().min(1),
  contentChecksum: z.string().min(1),
  renderingReadiness: renderingReadinessSchema
});

export type ResumeRenderingApprovalRecord = z.infer<typeof resumeRenderingApprovalRecordSchema>;
export type ResumeRenderingApprovalEligibility = z.infer<typeof resumeRenderingApprovalEligibilitySchema>;
export type ResumeRenderingApprovalCreateRequest = z.infer<typeof resumeRenderingApprovalCreateRequestSchema>;
export type ResumeRenderingApprovalRevokeRequest = z.infer<typeof resumeRenderingApprovalRevokeRequestSchema>;
