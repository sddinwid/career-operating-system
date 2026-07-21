import { z } from "zod";
import {
  coverLetterAuditSourceTypeSchema,
  coverLetterRenderingReadinessSchema
} from "@/lib/cover-letter-audit/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const coverLetterApprovalStatusSchema = z.enum([
  "APPROVED",
  "REVOKED",
  "SUPERSEDED"
]);

export const coverLetterApprovalDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["ERROR", "WARNING", "INFORMATION"]),
  message: z.string().min(1),
  blocking: z.boolean()
});

export const coverLetterApprovalRecordSchema = z.object({
  approvalId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceType: coverLetterAuditSourceTypeSchema,
  sourceId: z.string().min(1),
  coverLetterCompositionVersionId: z.string().min(1),
  coverLetterRevisionVersionId: z.string().nullable(),
  coverLetterAuditRunId: z.string().min(1),
  applicationId: z.string().nullable(),
  jobOpportunityId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  predecessorApprovalId: z.string().nullable(),
  contractVersion: semanticVersionSchema,
  engineVersion: semanticVersionSchema,
  configurationVersion: semanticVersionSchema,
  contentChecksum: z.string().min(1),
  auditInputChecksum: z.string().min(1),
  status: coverLetterApprovalStatusSchema,
  renderingReadiness: coverLetterRenderingReadinessSchema,
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

export const coverLetterApprovalEligibilitySchema = z.object({
  eligible: z.boolean(),
  eligibleWithWarnings: z.boolean(),
  warningAcknowledgementRequired: z.boolean(),
  sourceType: coverLetterAuditSourceTypeSchema,
  sourceId: z.string().min(1),
  coverLetterCompositionVersionId: z.string().min(1),
  coverLetterRevisionVersionId: z.string().nullable(),
  coverLetterAuditRunId: z.string().nullable(),
  contentChecksum: z.string().nullable(),
  renderingReadiness: coverLetterRenderingReadinessSchema.nullable(),
  warningCount: z.number().int().nonnegative(),
  blockingCount: z.number().int().nonnegative(),
  diagnostics: z.array(coverLetterApprovalDiagnosticSchema)
});

export const coverLetterApprovalCreateRequestSchema = z.object({
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable().optional(),
  sourceType: coverLetterAuditSourceTypeSchema,
  sourceId: z.string().min(1),
  coverLetterAuditRunId: z.string().min(1),
  expectedContentChecksum: z.string().min(1),
  expectedCurrentApprovalId: z.string().nullable().optional(),
  warningAcknowledged: z.boolean().default(false),
  warningAcknowledgement: z.string().nullable().optional(),
  approvalNote: z.string().trim().max(500).nullable().optional()
});

export const coverLetterApprovalRevokeRequestSchema = z.object({
  approvalId: z.string().min(1),
  expectedActiveApprovalId: z.string().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional()
});

export type CoverLetterApprovalRecord = z.infer<typeof coverLetterApprovalRecordSchema>;
export type CoverLetterApprovalEligibility = z.infer<typeof coverLetterApprovalEligibilitySchema>;
export type CoverLetterApprovalCreateRequest = z.infer<typeof coverLetterApprovalCreateRequestSchema>;
export type CoverLetterApprovalRevokeRequest = z.infer<typeof coverLetterApprovalRevokeRequestSchema>;
export type CoverLetterApprovalDiagnostic = z.infer<typeof coverLetterApprovalDiagnosticSchema>;
