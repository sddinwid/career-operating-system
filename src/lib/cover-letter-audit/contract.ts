import { z } from "zod";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const coverLetterAuditRunStatusSchema = z.enum([
  "PENDING",
  "SUCCESS",
  "SUCCESS_WITH_WARNINGS",
  "FAILED"
]);

export const coverLetterRenderingReadinessSchema = z.enum([
  "READY_FOR_RENDERING",
  "READY_WITH_WARNINGS",
  "NEEDS_REVIEW",
  "BLOCKED"
]);

export const coverLetterAuditSourceTypeSchema = z.enum([
  "BASE_COMPOSITION",
  "FINALIZED_REVISION"
]);

export const coverLetterAuditFindingSeveritySchema = z.enum([
  "ERROR",
  "WARNING",
  "INFORMATION"
]);

export const coverLetterAuditFindingSchema = z.object({
  findingId: z.string().min(1),
  ruleId: z.string().min(1),
  severity: coverLetterAuditFindingSeveritySchema,
  message: z.string().min(1),
  paragraphId: z.string().nullable(),
  blocksFinalization: z.boolean(),
  sourceEvidenceIds: z.array(z.string().min(1)),
  sourceRequirementIds: z.array(z.string().min(1))
});

export const coverLetterAuditSummarySchema = z.object({
  auditStatus: coverLetterAuditRunStatusSchema,
  renderingReadiness: coverLetterRenderingReadinessSchema,
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  informationCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
  blockingFindingCount: z.number().int().nonnegative()
});

export const coverLetterAuditResultSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceType: coverLetterAuditSourceTypeSchema,
  coverLetterRevisionVersionId: z.string().min(1).nullable(),
  coverLetterCompositionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  jobOpportunityId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  coverLetterAuditContractVersion: semanticVersionSchema,
  coverLetterAuditEngineVersion: semanticVersionSchema,
  coverLetterAuditConfigurationVersion: semanticVersionSchema,
  contentChecksum: z.string().min(1),
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  status: coverLetterAuditRunStatusSchema,
  renderingReadiness: coverLetterRenderingReadinessSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: coverLetterAuditSummarySchema,
  findings: z.array(coverLetterAuditFindingSchema)
});

export type CoverLetterAuditResult = z.infer<typeof coverLetterAuditResultSchema>;
