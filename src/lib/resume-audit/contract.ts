import { z } from "zod";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";
import { resumeCompositionContentSchema } from "@/lib/resume-composition/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const resumeAuditRunStatusSchema = z.enum([
  "PENDING",
  "PASSED",
  "PASSED_WITH_WARNINGS",
  "FAILED",
  "NEEDS_REVIEW"
]);

export const renderingReadinessSchema = z.enum([
  "READY_FOR_RENDERING",
  "READY_WITH_WARNINGS",
  "NEEDS_REVIEW",
  "BLOCKED"
]);

export const auditFindingSeveritySchema = z.enum(["ERROR", "WARNING", "INFORMATION"]);
export const auditFindingCategorySchema = z.enum([
  "CONTRACT",
  "PROVENANCE",
  "TRUTHFULNESS",
  "EXPERIENCE",
  "METRIC",
  "RECENCY",
  "PROJECT_CONTEXT",
  "CERTIFICATION",
  "RELEVANCE",
  "KEYWORD",
  "DUPLICATION",
  "ATS",
  "SEVEN_SECOND_SCAN",
  "PAGE_BUDGET",
  "STYLE",
  "PRIVACY",
  "OTHER"
]);

export const auditSectionTypeSchema = z.enum([
  "HEADER",
  "PROFESSIONAL_SUMMARY",
  "CORE_SKILLS",
  "PROFESSIONAL_EXPERIENCE",
  "SELECTED_PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS"
]);

export const auditFindingSchema = z.object({
  findingId: z.string().min(1),
  ruleId: z.string().min(1),
  severity: auditFindingSeveritySchema,
  category: auditFindingCategorySchema,
  message: z.string().min(1),
  statementId: z.string().nullable(),
  section: auditSectionTypeSchema.nullable(),
  sourceEvidenceIds: z.array(z.string().min(1)),
  sourceCareerRecordIds: z.array(z.string().min(1)),
  requirementIds: z.array(z.string().min(1)),
  actualValue: z.string().nullable(),
  expectedCondition: z.string().nullable(),
  renderingImpact: z.string().min(1),
  suggestedHandling: z.string().min(1),
  provenance: z.object({
    templateId: z.string().nullable(),
    sourcePath: z.string().nullable()
  }),
  blocksRendering: z.boolean(),
  userReviewable: z.boolean()
});

export const auditStatementResultSchema = z.object({
  statementId: z.string().min(1),
  section: auditSectionTypeSchema,
  auditState: z.enum(["VERIFIED", "QUALIFIED", "NEEDS_REVIEW", "BLOCKED"]),
  provenanceStatus: z.enum(["VALID", "MISSING", "INVALID"]),
  truthfulnessStatus: z.enum([
    "VERIFIED_SOURCE",
    "VERIFIED_COMPOSITE",
    "QUALIFIED",
    "NEEDS_REVIEW",
    "PROHIBITED",
    "UNKNOWN"
  ]),
  renderingEligibility: z.enum(["ELIGIBLE", "WARN", "NEEDS_REVIEW", "BLOCKED"]),
  findingIds: z.array(z.string().min(1))
});

export const auditSectionResultSchema = z.object({
  sectionType: auditSectionTypeSchema,
  renderingReadiness: renderingReadinessSchema,
  passedChecks: z.array(z.string().min(1)),
  warningFindingIds: z.array(z.string().min(1)),
  errorFindingIds: z.array(z.string().min(1))
});

export const resumeAuditSummarySchema = z.object({
  auditStatus: resumeAuditRunStatusSchema,
  renderingReadiness: renderingReadinessSchema,
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  informationCount: z.number().int().nonnegative(),
  statementsAudited: z.number().int().nonnegative(),
  statementsVerified: z.number().int().nonnegative(),
  statementsQualified: z.number().int().nonnegative(),
  statementsNeedingReview: z.number().int().nonnegative(),
  statementsProhibited: z.number().int().nonnegative(),
  unsupportedClaimCount: z.number().int().nonnegative(),
  missingProvenanceCount: z.number().int().nonnegative(),
  experienceViolationCount: z.number().int().nonnegative(),
  metricViolationCount: z.number().int().nonnegative(),
  projectContextViolationCount: z.number().int().nonnegative(),
  certificationViolationCount: z.number().int().nonnegative(),
  atsBlockerCount: z.number().int().nonnegative(),
  sevenSecondScanWarningCount: z.number().int().nonnegative(),
  duplicationFindingCount: z.number().int().nonnegative(),
  pageBudgetStatus: z.enum(["WITHIN_TARGET", "AT_RISK", "OVER_BUDGET"])
});

export const resumeAuditResultSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  resumeCompositionVersionId: z.string().min(1),
  structuredResumeVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  resumeAuditContractVersion: semanticVersionSchema,
  resumeAuditEngineVersion: semanticVersionSchema,
  resumeAuditConfigurationVersion: semanticVersionSchema,
  resumeCompositionInputChecksum: z.string().min(1),
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  status: resumeAuditRunStatusSchema,
  renderingReadiness: renderingReadinessSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: resumeAuditSummarySchema,
  sectionResults: z.array(auditSectionResultSchema),
  statementResults: z.array(auditStatementResultSchema),
  findings: z.array(auditFindingSchema)
});

export const resumeAuditInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  resumeCompositionVersionId: z.string().min(1),
  resumeCompositionInputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1),
  resumeComposition: resumeCompositionContentSchema,
  matchReportClaimsToAvoid: z.array(z.string().min(1)),
  maximumRequestedExperienceYears: z.number().int().nonnegative().nullable()
});

export type ResumeAuditResult = z.infer<typeof resumeAuditResultSchema>;
export type ResumeAuditInput = z.infer<typeof resumeAuditInputSchema>;
