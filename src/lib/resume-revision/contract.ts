import { z } from "zod";
import {
  composedBulletSchema,
  educationEntrySchema,
  experienceEntrySchema,
  headerEntrySchema,
  projectEntrySchema,
  resumeCompositionContentSchema,
  sectionEstimateSchema,
  skillGroupSchema,
  statementProvenanceSchema,
  summarySentenceSchema
} from "@/lib/resume-composition/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const resumeRevisionVersionStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_AUDIT",
  "AUDITED",
  "NEEDS_REVIEW",
  "SUPERSEDED",
  "FAILED"
]);

export const resumeRevisionValidationStateSchema = z.enum([
  "VALID",
  "VALID_WITH_WARNINGS",
  "NEEDS_REVIEW",
  "BLOCKED"
]);

export const resumeRevisionChangeTypeSchema = z.enum([
  "TEXT_EDIT",
  "INCLUDE",
  "EXCLUDE",
  "REORDER",
  "QUALIFY",
  "RESTORE",
  "SECTION_PROFILE_CHANGE",
  "NOTE"
]);

export const resumeRevisionSectionTypeSchema = z.enum([
  "HEADER",
  "PROFESSIONAL_SUMMARY",
  "CORE_SKILLS",
  "PROFESSIONAL_EXPERIENCE",
  "SELECTED_PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS"
]);

export const resumeRevisionSectionProfileSchema = z.enum([
  "STANDARD_ENGINEERING",
  "PROJECT_FORWARD_AI"
]);

export const resumeRevisionResolutionStateSchema = z.enum([
  "UNRESOLVED",
  "POTENTIALLY_RESOLVED",
  "RESOLVED_BY_REMOVAL",
  "RESOLVED_BY_QUALIFICATION",
  "RESOLVED_BY_EDIT",
  "NOT_APPLICABLE"
]);

export const resumeRevisionEditClassificationSchema = z.enum([
  "UNCHANGED",
  "USER_EDITED_VERIFIED",
  "USER_EDITED_QUALIFIED",
  "USER_EDITED_NEEDS_REVIEW"
]);

export const resumeRevisionDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["ERROR", "WARNING", "INFORMATION"]),
  message: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  statementId: z.string().nullable(),
  section: resumeRevisionSectionTypeSchema.nullable()
});

export const resumeRevisionFindingResolutionSchema = z.object({
  findingId: z.string().min(1),
  resolutionState: resumeRevisionResolutionStateSchema,
  inferredFromChangeIds: z.array(z.string().min(1))
});

export const resumeRevisionUserEditProvenanceSchema = z.object({
  editedAt: z.string().datetime().nullable(),
  changeReason: z.string().nullable(),
  classification: resumeRevisionEditClassificationSchema,
  validationState: resumeRevisionValidationStateSchema,
  changeIds: z.array(z.string().min(1)),
  priorAuditFindingIds: z.array(z.string().min(1)),
  addressedAuditFindingIds: z.array(z.string().min(1)),
  mayIntroduceNewFindings: z.boolean()
});

export const resumeRevisionSectionControlSchema = z.object({
  sectionType: resumeRevisionSectionTypeSchema,
  enabled: z.boolean(),
  required: z.boolean()
});

export const resumeRevisionSummarySentenceSchema = summarySentenceSchema.extend({
  originalText: z.string().min(1),
  currentText: z.string().min(1),
  included: z.boolean(),
  order: z.number().int().nonnegative(),
  userEdit: resumeRevisionUserEditProvenanceSchema
});

export const resumeRevisionSummarySectionSchema = z.object({
  enabled: z.boolean(),
  originalText: z.string().min(1),
  currentText: z.string().min(1),
  sentences: z.array(resumeRevisionSummarySentenceSchema),
  noteId: z.string().nullable()
});

export const resumeRevisionSkillEntrySchema = z.object({
  canonicalValue: z.string().min(1),
  displayValue: z.string().min(1),
  originalGroupId: z.string().min(1),
  groupId: z.string().min(1),
  originalOrder: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  included: z.boolean(),
  supportingEvidenceIds: z.array(z.string().min(1)),
  requirementIds: z.array(z.string().min(1)),
  professionalUse: z.boolean(),
  projectUse: z.boolean(),
  recency: z.string().min(1),
  originalQualificationText: z.string().nullable(),
  qualificationText: z.string().nullable(),
  inclusionReason: z.string().min(1),
  provenance: statementProvenanceSchema,
  userEdit: resumeRevisionUserEditProvenanceSchema
});

export const resumeRevisionSkillGroupSchema = skillGroupSchema.extend({
  skills: z.array(resumeRevisionSkillEntrySchema)
});

export const resumeRevisionBulletSchema = composedBulletSchema.extend({
  originalText: z.string().min(1),
  currentText: z.string().min(1),
  originalOrder: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  included: z.boolean(),
  roleOrProjectId: z.string().min(1),
  noteId: z.string().nullable(),
  userEdit: resumeRevisionUserEditProvenanceSchema
});

export const resumeRevisionExperienceEntrySchema = experienceEntrySchema.extend({
  included: z.boolean(),
  displayMode: z.enum(["DETAILED", "CONDENSED", "HEADER_ONLY"]),
  bullets: z.array(resumeRevisionBulletSchema),
  noteId: z.string().nullable()
});

export const resumeRevisionProjectEntrySchema = projectEntrySchema.extend({
  included: z.boolean(),
  bullets: z.array(resumeRevisionBulletSchema),
  noteId: z.string().nullable()
});

export const resumeRevisionSectionOrderSchema = z.object({
  profile: resumeRevisionSectionProfileSchema,
  reason: z.string().nullable()
});

export const resumeRevisionReviewNoteSchema = z.object({
  noteId: z.string().min(1),
  targetType: z.enum(["REVISION", "SECTION", "STATEMENT"]),
  targetId: z.string().min(1),
  section: resumeRevisionSectionTypeSchema.nullable(),
  body: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const resumeRevisionContentSchema = z.object({
  revisionId: z.string().min(1),
  workspaceId: z.string().min(1),
  baseResumeCompositionVersionId: z.string().min(1),
  predecessorRevisionId: z.string().nullable(),
  structuredResumeVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  resumeRevisionContractVersion: semanticVersionSchema,
  resumeRevisionEngineVersion: semanticVersionSchema,
  resumeRevisionConfigurationVersion: semanticVersionSchema,
  sourceInputChecksum: z.string().min(1),
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: resumeRevisionVersionStatusSchema,
  validationState: resumeRevisionValidationStateSchema,
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  targetRoleFamily: z.string().min(1),
  stackFamily: z.string().min(1),
  pageTarget: z.number().int().positive(),
  header: z.array(headerEntrySchema),
  sectionControls: z.array(resumeRevisionSectionControlSchema),
  sectionOrder: resumeRevisionSectionOrderSchema,
  professionalSummary: resumeRevisionSummarySectionSchema,
  skillsGroups: z.array(resumeRevisionSkillGroupSchema),
  professionalExperience: z.array(resumeRevisionExperienceEntrySchema),
  selectedProjects: z.array(resumeRevisionProjectEntrySchema),
  education: z.array(educationEntrySchema),
  certifications: z.array(
    z.object({
      certificationId: z.string().min(1),
      name: z.string().min(1),
      issuer: z.string().nullable(),
      date: z.string().nullable(),
      expirationDate: z.string().nullable(),
      currentDisplay: z.string().min(1),
      inclusionReason: z.string().min(1),
      included: z.boolean(),
      provenance: statementProvenanceSchema
    })
  ),
  sectionEstimates: z.array(sectionEstimateSchema)
});

export const resumeRevisionChangeSchema = z.object({
  changeId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  statementId: z.string().nullable(),
  field: z.string().min(1),
  originalValue: z.string().nullable(),
  revisedValue: z.string().nullable(),
  changeType: resumeRevisionChangeTypeSchema,
  changeReason: z.string().nullable(),
  validationResult: resumeRevisionValidationStateSchema,
  provenancePreserved: z.boolean(),
  auditRequired: z.boolean(),
  timestamp: z.string().datetime()
});

export const resumeRevisionSummarySchema = z.object({
  baseResumeCompositionVersionId: z.string().min(1),
  predecessorRevisionId: z.string().nullable(),
  revisionStatus: resumeRevisionVersionStatusSchema,
  editedSummarySentenceCount: z.number().int().nonnegative(),
  editedBulletCount: z.number().int().nonnegative(),
  includedSkillChanges: z.number().int().nonnegative(),
  excludedSkillChanges: z.number().int().nonnegative(),
  includedRoleChanges: z.number().int().nonnegative(),
  includedProjectChanges: z.number().int().nonnegative(),
  reorderedItemCount: z.number().int().nonnegative(),
  qualificationCount: z.number().int().nonnegative(),
  reviewNoteCount: z.number().int().nonnegative(),
  unresolvedFindingCount: z.number().int().nonnegative(),
  estimatedPageCount: z.number().positive(),
  localValidationState: resumeRevisionValidationStateSchema,
  latestAuditStatus: z.string().nullable(),
  changeCount: z.number().int().nonnegative()
});

export const resumeRevisionRecordSchema = z.object({
  content: resumeRevisionContentSchema,
  changeSet: z.array(resumeRevisionChangeSchema),
  summary: resumeRevisionSummarySchema,
  diagnostics: z.array(resumeRevisionDiagnosticSchema),
  reviewNotes: z.array(resumeRevisionReviewNoteSchema),
  findingResolutions: z.array(resumeRevisionFindingResolutionSchema)
});

export const resumeRevisionSavePayloadSchema = z.object({
  revisionId: z.string().min(1),
  updatedAt: z.string().datetime(),
  content: resumeRevisionContentSchema,
  reviewNotes: z.array(resumeRevisionReviewNoteSchema)
});

export const resumeRevisionAuditProjectionSchema = resumeCompositionContentSchema;

export type ResumeRevisionContent = z.infer<typeof resumeRevisionContentSchema>;
export type ResumeRevisionChange = z.infer<typeof resumeRevisionChangeSchema>;
export type ResumeRevisionDiagnostic = z.infer<typeof resumeRevisionDiagnosticSchema>;
export type ResumeRevisionRecord = z.infer<typeof resumeRevisionRecordSchema>;
export type ResumeRevisionReviewNote = z.infer<typeof resumeRevisionReviewNoteSchema>;
export type ResumeRevisionSummary = z.infer<typeof resumeRevisionSummarySchema>;
export type ResumeRevisionSavePayload = z.infer<typeof resumeRevisionSavePayloadSchema>;
