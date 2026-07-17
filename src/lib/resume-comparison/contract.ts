import { z } from "zod";
import {
  auditFindingCategorySchema,
  auditFindingSeveritySchema,
  auditSectionTypeSchema,
  renderingReadinessSchema
} from "@/lib/resume-audit/contract";
import { resumeRevisionChangeTypeSchema } from "@/lib/resume-revision/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const resumeComparisonModeSchema = z.enum([
  "BASE_VS_REVISION",
  "PREDECESSOR_VS_REVISION",
  "CURRENT_APPROVAL_VS_PROPOSED"
]);

export const resumeComparisonSourceTypeSchema = z.enum([
  "BASE_COMPOSITION",
  "FINALIZED_REVISION"
]);

export const resumeComparisonChangeStateSchema = z.enum([
  "UNCHANGED",
  "ADDED",
  "REMOVED",
  "MODIFIED",
  "REORDERED"
]);

export const resumeComparisonItemTypeSchema = z.enum([
  "HEADER",
  "SUMMARY_SENTENCE",
  "SKILL",
  "ROLE",
  "ROLE_BULLET",
  "PROJECT",
  "PROJECT_BULLET",
  "EDUCATION",
  "CERTIFICATION",
  "REVIEW_NOTE"
]);

export const resumeComparisonDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["ERROR", "WARNING", "INFORMATION"]),
  message: z.string().min(1),
  blocking: z.boolean()
});

export const resumeComparisonTokenSchema = z.object({
  value: z.string(),
  state: z.enum(["UNCHANGED", "ADDED", "REMOVED"])
});

export const resumeComparisonTextDiffSchema = z.object({
  leftTokens: z.array(resumeComparisonTokenSchema),
  rightTokens: z.array(resumeComparisonTokenSchema)
});

export const resumeComparisonStatementSchema = z.object({
  stableId: z.string().min(1),
  itemType: resumeComparisonItemTypeSchema,
  statementId: z.string().nullable(),
  baseStatementId: z.string().nullable(),
  section: auditSectionTypeSchema,
  parentId: z.string().nullable(),
  leftText: z.string().nullable(),
  rightText: z.string().nullable(),
  changeState: resumeComparisonChangeStateSchema,
  normalizedEqual: z.boolean(),
  provenancePreserved: z.boolean(),
  sourceEvidenceChanged: z.boolean(),
  requirementReferenceChanged: z.boolean(),
  metricReferenceChanged: z.boolean(),
  truthfulnessClassificationChanged: z.boolean(),
  restrictionsChanged: z.boolean(),
  associatedChangeIds: z.array(z.string().min(1)),
  auditFindingChanges: z.array(z.string().min(1)),
  textDiff: resumeComparisonTextDiffSchema
});

export const resumeComparisonSectionSchema = z.object({
  sectionType: auditSectionTypeSchema,
  leftPresent: z.boolean(),
  rightPresent: z.boolean(),
  changeState: resumeComparisonChangeStateSchema,
  leftOrder: z.number().int().nullable(),
  rightOrder: z.number().int().nullable(),
  orderChanged: z.boolean(),
  contentChanges: z.number().int().nonnegative(),
  itemAdditions: z.number().int().nonnegative(),
  itemRemovals: z.number().int().nonnegative(),
  itemReorderings: z.number().int().nonnegative(),
  auditImpactSummary: z.object({
    resolved: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    introduced: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative()
  }),
  statements: z.array(resumeComparisonStatementSchema)
});

export const resumeComparisonFindingChangeSchema = z.object({
  comparisonState: z.enum(["RESOLVED", "REMAINING", "NEW", "CHANGED", "NOT_APPLICABLE"]),
  comparisonKey: z.string().min(1),
  ruleId: z.string().min(1),
  statementId: z.string().nullable(),
  section: auditSectionTypeSchema.nullable(),
  category: auditFindingCategorySchema,
  leftSeverity: auditFindingSeveritySchema.nullable(),
  rightSeverity: auditFindingSeveritySchema.nullable(),
  leftBlocksRendering: z.boolean(),
  rightBlocksRendering: z.boolean(),
  leftMessage: z.string().nullable(),
  rightMessage: z.string().nullable(),
  leftActualValue: z.string().nullable(),
  rightActualValue: z.string().nullable()
});

export const resumeComparisonChangeSetReconciliationSchema = z.object({
  recordedChangeId: z.string().min(1).nullable(),
  state: z.enum([
    "RECORDED_AND_REFLECTED",
    "RECORDED_BUT_NOT_REFLECTED",
    "UNRECORDED_CONTENT_CHANGE",
    "MISSING_CHANGE_REFERENCE",
    "RESTORED_TO_BASE",
    "REORDER_MATCHED"
  ]),
  blocking: z.boolean(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  statementId: z.string().nullable(),
  field: z.string().min(1),
  message: z.string().min(1)
});

export const resumeComparisonSourceSummarySchema = z.object({
  sourceType: resumeComparisonSourceTypeSchema,
  sourceId: z.string().min(1),
  contentChecksum: z.string().min(1),
  auditId: z.string().nullable(),
  auditStatus: z.string().nullable(),
  renderingReadiness: renderingReadinessSchema.nullable(),
  label: z.string().min(1)
});

export const resumeComparisonSummarySchema = z.object({
  sectionsChanged: z.number().int().nonnegative(),
  statementsChanged: z.number().int().nonnegative(),
  statementsAdded: z.number().int().nonnegative(),
  statementsRemoved: z.number().int().nonnegative(),
  skillsAdded: z.number().int().nonnegative(),
  skillsRemoved: z.number().int().nonnegative(),
  skillsReordered: z.number().int().nonnegative(),
  rolesChanged: z.number().int().nonnegative(),
  projectsChanged: z.number().int().nonnegative(),
  bulletsChanged: z.number().int().nonnegative(),
  notesAdded: z.number().int().nonnegative(),
  provenanceChanges: z.number().int().nonnegative(),
  resolvedBlockingFindings: z.number().int().nonnegative(),
  remainingBlockingFindings: z.number().int().nonnegative(),
  newBlockingFindings: z.number().int().nonnegative(),
  warningChanges: z.number().int().nonnegative(),
  pageEstimateChange: z.number(),
  renderingReadinessChanged: z.boolean(),
  eligibleForApproval: z.boolean()
});

export const resumeComparisonResultSchema = z.object({
  comparisonMode: resumeComparisonModeSchema,
  workspaceId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  contractVersion: semanticVersionSchema,
  engineVersion: semanticVersionSchema,
  generatedAt: z.string().datetime(),
  left: resumeComparisonSourceSummarySchema,
  right: resumeComparisonSourceSummarySchema,
  summary: resumeComparisonSummarySchema,
  sections: z.array(resumeComparisonSectionSchema),
  findingChanges: z.array(resumeComparisonFindingChangeSchema),
  changeSetReconciliation: z.array(resumeComparisonChangeSetReconciliationSchema),
  diagnostics: z.array(resumeComparisonDiagnosticSchema)
});

export const resumeComparisonRequestSchema = z.object({
  comparisonMode: resumeComparisonModeSchema,
  jobDescriptionVersionId: z.string().min(1),
  leftSourceType: resumeComparisonSourceTypeSchema,
  leftSourceId: z.string().min(1),
  rightSourceType: resumeComparisonSourceTypeSchema,
  rightSourceId: z.string().min(1)
});

export type ResumeComparisonResult = z.infer<typeof resumeComparisonResultSchema>;
export type ResumeComparisonRequest = z.infer<typeof resumeComparisonRequestSchema>;
export type ResumeComparisonMode = z.infer<typeof resumeComparisonModeSchema>;
export type ResumeComparisonChangeState = z.infer<typeof resumeComparisonChangeStateSchema>;
export type ResumeComparisonDiagnostic = z.infer<typeof resumeComparisonDiagnosticSchema>;
export type ResumeComparisonChangeSetReconciliation = z.infer<
  typeof resumeComparisonChangeSetReconciliationSchema
>;
export type ResumeComparisonFindingChange = z.infer<typeof resumeComparisonFindingChangeSchema>;
export type ResumeComparisonSection = z.infer<typeof resumeComparisonSectionSchema>;
