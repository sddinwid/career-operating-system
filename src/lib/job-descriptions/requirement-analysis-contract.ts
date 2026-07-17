import { z } from "zod";
import {
  confidenceLevelSchema,
  diagnosticSeveritySchema,
  extractionRuleSchema,
  requirementLabelSchema,
  sourceLocationSchema
} from "@/lib/job-descriptions/parser-contract";

export const JOB_REQUIREMENT_ANALYSIS_CONTRACT_VERSION = "1.0.0";
export const JOB_REQUIREMENT_CLASSIFIER_VERSION = "m3.3.0";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const requirementCategorySchema = z.enum([
  "REQUIRED",
  "PREFERRED",
  "CONTEXTUAL",
  "NOISE"
]);
export type RequirementCategory = z.infer<typeof requirementCategorySchema>;

export const requirementKindSchema = z.enum([
  "TECHNOLOGY",
  "EXPERIENCE",
  "RESPONSIBILITY",
  "EDUCATION",
  "CERTIFICATION",
  "LEADERSHIP",
  "ARCHITECTURE",
  "CLOUD",
  "DATA",
  "AI_ML",
  "SECURITY",
  "DOMAIN",
  "COMMUNICATION",
  "COLLABORATION",
  "WORK_AUTHORIZATION",
  "CLEARANCE",
  "LOCATION",
  "TRAVEL",
  "EMPLOYMENT",
  "OTHER"
]);
export type RequirementKind = z.infer<typeof requirementKindSchema>;

export const responsibilityRelevanceSchema = z.enum(["INCLUDED", "NOISE"]);
export type ResponsibilityRelevance = z.infer<typeof responsibilityRelevanceSchema>;

export const requirementAnalysisReviewStatusSchema = z.enum([
  "DRAFT",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "SUPERSEDED",
  "FAILED"
]);
export type RequirementAnalysisReviewStatus = z.infer<
  typeof requirementAnalysisReviewStatusSchema
>;

export const itemConfirmationStateSchema = z.enum(["UNCONFIRMED", "CONFIRMED"]);
export type ItemConfirmationState = z.infer<typeof itemConfirmationStateSchema>;

export const analysisDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: diagnosticSeveritySchema,
  message: z.string().min(1),
  rule: extractionRuleSchema,
  location: sourceLocationSchema.nullable(),
  relatedItemIds: z.array(z.string().min(1)).default([])
});
export type AnalysisDiagnostic = z.infer<typeof analysisDiagnosticSchema>;

export const parserProvenanceSchema = z.object({
  parseId: z.string().min(1),
  parserVersion: semanticVersionSchema,
  parserStatementId: z.string().min(1).nullable(),
  parserResponsibilityId: z.string().min(1).nullable(),
  sourceSectionId: z.string().min(1).nullable()
});
export type ParserProvenance = z.infer<typeof parserProvenanceSchema>;

export const userOverrideStateSchema = z.object({
  categoryChanged: z.boolean(),
  kindsChanged: z.boolean(),
  exclusionChanged: z.boolean(),
  noteChanged: z.boolean(),
  displayTextChanged: z.boolean(),
  confirmationChanged: z.boolean()
});
export type UserOverrideState = z.infer<typeof userOverrideStateSchema>;

export const analyzedRequirementSchema = z.object({
  id: z.string().min(1),
  parserStatementId: z.string().min(1).nullable(),
  originalText: z.string().min(1),
  normalizedText: z.string().min(1),
  correctedDisplayText: z.string().min(1).nullable(),
  category: requirementCategorySchema,
  kinds: z.array(requirementKindSchema).min(1),
  explicitSourceLabel: requirementLabelSchema.nullable(),
  sourceSectionId: z.string().min(1).nullable(),
  sourceSectionType: z.string().min(1).nullable(),
  sourceLocation: sourceLocationSchema.nullable(),
  technologies: z.array(z.string().min(1)),
  experienceText: z.string().min(1).nullable(),
  degreeRequirement: z.string().min(1).nullable(),
  certificationRequirement: z.string().min(1).nullable(),
  domainReferences: z.array(z.string().min(1)),
  leadershipReferences: z.array(z.string().min(1)),
  confidence: confidenceLevelSchema,
  classificationRule: extractionRuleSchema,
  parserProvenance: parserProvenanceSchema,
  userOverrideState: userOverrideStateSchema,
  userAdded: z.boolean(),
  excluded: z.boolean(),
  reviewNote: z.string().min(1).nullable(),
  confirmationState: itemConfirmationStateSchema
});
export type AnalyzedRequirement = z.infer<typeof analyzedRequirementSchema>;

export const analyzedResponsibilitySchema = z.object({
  id: z.string().min(1),
  parserResponsibilityId: z.string().min(1).nullable(),
  originalText: z.string().min(1),
  normalizedText: z.string().min(1),
  correctedDisplayText: z.string().min(1).nullable(),
  relevance: responsibilityRelevanceSchema,
  kinds: z.array(requirementKindSchema),
  technologies: z.array(z.string().min(1)),
  sourceLocation: sourceLocationSchema,
  confidence: confidenceLevelSchema,
  classificationRule: extractionRuleSchema,
  parserProvenance: parserProvenanceSchema,
  userOverrideState: userOverrideStateSchema,
  excluded: z.boolean(),
  reviewNote: z.string().min(1).nullable(),
  confirmationState: itemConfirmationStateSchema
});
export type AnalyzedResponsibility = z.infer<typeof analyzedResponsibilitySchema>;

export const requirementAnalysisSummarySchema = z.object({
  requiredCount: z.number().int().nonnegative(),
  preferredCount: z.number().int().nonnegative(),
  contextualCount: z.number().int().nonnegative(),
  noiseCount: z.number().int().nonnegative(),
  includedResponsibilitiesCount: z.number().int().nonnegative(),
  excludedResponsibilitiesCount: z.number().int().nonnegative(),
  technologiesCount: z.number().int().nonnegative(),
  experienceRequirementsCount: z.number().int().nonnegative(),
  educationRequirementsCount: z.number().int().nonnegative(),
  certificationRequirementsCount: z.number().int().nonnegative(),
  leadershipRequirementsCount: z.number().int().nonnegative(),
  domainRequirementsCount: z.number().int().nonnegative(),
  userOverridesCount: z.number().int().nonnegative(),
  userAddedRequirementsCount: z.number().int().nonnegative(),
  unresolvedReviewItemsCount: z.number().int().nonnegative(),
  lowConfidenceCount: z.number().int().nonnegative(),
  excludedRequirementsCount: z.number().int().nonnegative()
});
export type RequirementAnalysisSummary = z.infer<typeof requirementAnalysisSummarySchema>;

export const jobRequirementAnalysisContractSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  parseId: z.string().min(1),
  contractVersion: semanticVersionSchema,
  classifierVersion: semanticVersionSchema,
  createdAt: z.string().datetime(),
  reviewStatus: requirementAnalysisReviewStatusSchema,
  sourceChecksum: z.string().min(1),
  parserVersion: semanticVersionSchema,
  requirements: z.array(analyzedRequirementSchema),
  responsibilities: z.array(analyzedResponsibilitySchema),
  summary: requirementAnalysisSummarySchema,
  lowConfidenceAcknowledged: z.boolean(),
  diagnostics: z.array(analysisDiagnosticSchema)
});
export type JobRequirementAnalysisContract = z.infer<
  typeof jobRequirementAnalysisContractSchema
>;
