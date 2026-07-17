import { z } from "zod";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";
import { canonicalCareerKnowledgeContractSchema } from "@/lib/career/contracts";
import {
  structuredResumePlanSchema,
  structuredResumeVersionStatusSchema
} from "@/lib/structured-resume/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const resumeCompositionVersionStatusSchema = z.enum([
  "PENDING",
  "READY",
  "READY_WITH_WARNINGS",
  "NEEDS_REVIEW",
  "FAILED",
  "SUPERSEDED"
]);
export type ResumeCompositionVersionStatus = z.infer<typeof resumeCompositionVersionStatusSchema>;

export const truthfulnessClassificationSchema = z.enum([
  "VERIFIED_SOURCE",
  "VERIFIED_COMPOSITE",
  "QUALIFIED",
  "NEEDS_REVIEW",
  "PROHIBITED"
]);

export const statementProvenanceSchema = z.object({
  statementId: z.string().min(1),
  sourceEvidenceIds: z.array(z.string().min(1)),
  sourceCareerRecordIds: z.array(z.string().min(1)),
  requirementIds: z.array(z.string().min(1)),
  templateId: z.string().min(1),
  transformations: z.array(z.string().min(1)),
  metricReferences: z.array(z.string().min(1)),
  technologies: z.array(z.string().min(1)),
  restrictions: z.array(z.string().min(1)),
  recordKinds: z.array(z.string().min(1)),
  confirmationStates: z.array(z.string().min(1)),
  truthfulnessClassification: truthfulnessClassificationSchema,
  claimsToAvoidChecked: z.array(z.string().min(1))
});
export type StatementProvenance = z.infer<typeof statementProvenanceSchema>;

export const headerEntrySchema = z.object({
  field: z.enum([
    "NAME",
    "EMAIL",
    "PHONE",
    "LOCATION",
    "LINKEDIN",
    "GITHUB",
    "PORTFOLIO",
    "WORK_AUTHORIZATION"
  ]),
  label: z.string().min(1),
  value: z.string().nullable(),
  included: z.boolean(),
  reason: z.string().min(1),
  provenance: statementProvenanceSchema.nullable()
});

export const summarySentenceSchema = z.object({
  statementId: z.string().min(1),
  text: z.string().min(1),
  templateId: z.string().min(1),
  provenance: statementProvenanceSchema
});

export const summarySectionSchema = z.object({
  sentences: z.array(summarySentenceSchema),
  text: z.string().min(1),
  sentenceCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1))
});

export const skillEntrySchema = z.object({
  canonicalValue: z.string().min(1),
  displayValue: z.string().min(1),
  supportingEvidenceIds: z.array(z.string().min(1)),
  requirementIds: z.array(z.string().min(1)),
  professionalUse: z.boolean(),
  projectUse: z.boolean(),
  recency: z.string().min(1),
  qualificationText: z.string().nullable(),
  inclusionReason: z.string().min(1),
  provenance: statementProvenanceSchema
});

export const skillGroupSchema = z.object({
  groupId: z.string().min(1),
  groupLabel: z.string().min(1),
  order: z.number().int().nonnegative(),
  estimatedLineCount: z.number().int().nonnegative(),
  skills: z.array(skillEntrySchema)
});

export const composedBulletSchema = z.object({
  statementId: z.string().min(1),
  text: z.string().min(1),
  templateId: z.string().min(1),
  estimatedLineCount: z.number().int().positive(),
  provenance: statementProvenanceSchema
});

export const experienceEntrySchema = z.object({
  roleId: z.string().min(1),
  employer: z.string().nullable(),
  roleTitle: z.string().nullable(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  workArrangement: z.string().nullable(),
  employmentType: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  sectionPosition: z.number().int().nonnegative(),
  estimatedLineCount: z.number().int().nonnegative(),
  bullets: z.array(composedBulletSchema),
  provenance: statementProvenanceSchema
});

export const projectEntrySchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  contextLabel: z.string().min(1),
  role: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  projectOnlyDisclosure: z.string().nullable(),
  sectionPosition: z.number().int().nonnegative(),
  estimatedLineCount: z.number().int().nonnegative(),
  bullets: z.array(composedBulletSchema),
  provenance: statementProvenanceSchema
});

export const educationEntrySchema = z.object({
  educationId: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  completionDate: z.string().nullable(),
  status: z.string().nullable(),
  provenance: statementProvenanceSchema
});

export const certificationEntrySchema = z.object({
  certificationId: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().nullable(),
  date: z.string().nullable(),
  expirationDate: z.string().nullable(),
  currentDisplay: z.string().min(1),
  inclusionReason: z.string().min(1),
  provenance: statementProvenanceSchema
});

export const sectionEstimateSchema = z.object({
  sectionType: z.string().min(1),
  estimatedLines: z.number().int().nonnegative()
});

export const resumeCompositionSummarySchema = z.object({
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  targetRoleFamily: z.string().min(1),
  stackFamily: z.string().min(1),
  sectionCount: z.number().int().nonnegative(),
  summaryWordCount: z.number().int().nonnegative(),
  skillCount: z.number().int().nonnegative(),
  includedRoleCount: z.number().int().nonnegative(),
  includedProjectCount: z.number().int().nonnegative(),
  bulletCount: z.number().int().nonnegative(),
  verifiedSourceStatementCount: z.number().int().nonnegative(),
  verifiedCompositeStatementCount: z.number().int().nonnegative(),
  qualifiedStatementCount: z.number().int().nonnegative(),
  prohibitedStatementCount: z.number().int().nonnegative(),
  estimatedLineCount: z.number().int().nonnegative(),
  estimatedPageCount: z.number().positive(),
  pageBudgetStatus: z.enum(["WITHIN_TARGET", "AT_RISK", "OVER_BUDGET"]),
  diagnosticErrorCount: z.number().int().nonnegative(),
  diagnosticWarningCount: z.number().int().nonnegative(),
  diagnosticInfoCount: z.number().int().nonnegative()
});

export const resumeCompositionContentSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  structuredResumeVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  resumeCompositionContractVersion: semanticVersionSchema,
  resumeCompositionEngineVersion: semanticVersionSchema,
  resumeCompositionConfigurationVersion: semanticVersionSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1),
  status: resumeCompositionVersionStatusSchema,
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  targetRoleFamily: z.string().min(1),
  stackFamily: z.string().min(1),
  pageTarget: z.number().int().positive(),
  diagnostics: z.array(evidenceDiagnosticSchema),
  header: z.array(headerEntrySchema),
  professionalSummary: summarySectionSchema,
  skillsGroups: z.array(skillGroupSchema),
  professionalExperience: z.array(experienceEntrySchema),
  selectedProjects: z.array(projectEntrySchema),
  education: z.array(educationEntrySchema),
  certifications: z.array(certificationEntrySchema),
  finalSectionOrder: z.array(z.string().min(1)),
  sectionEstimates: z.array(sectionEstimateSchema),
  summary: resumeCompositionSummarySchema
});
export type ResumeCompositionContent = z.infer<typeof resumeCompositionContentSchema>;

export const resumeCompositionInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  structuredResumeVersionId: z.string().min(1),
  structuredResumePlan: structuredResumePlanSchema,
  careerProfileVersionId: z.string().min(1),
  careerProfileSourceChecksum: z.string().min(1),
  careerProfileContent: canonicalCareerKnowledgeContractSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1)
});
export type ResumeCompositionInput = z.infer<typeof resumeCompositionInputSchema>;

export const compositionReadinessSchema = structuredResumeVersionStatusSchema;
