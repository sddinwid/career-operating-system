import { z } from "zod";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";
import {
  evidenceCandidateStrengthBandSchema,
  evidenceScoringResultSchema,
  evidenceScoringRunStatusSchema,
  requirementEvidenceStrengthStateSchema
} from "@/lib/evidence-scoring/contract";
import { requirementKindSchema } from "@/lib/job-descriptions/requirement-analysis-contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const matchReportRunStatusSchema = evidenceScoringRunStatusSchema;
export type MatchReportRunStatus = z.infer<typeof matchReportRunStatusSchema>;

export const matchTierSchema = z.enum([
  "STRONG_ALIGNMENT",
  "GOOD_ALIGNMENT",
  "PARTIAL_ALIGNMENT",
  "WEAK_ALIGNMENT",
  "INSUFFICIENT_EVIDENCE"
]);
export type MatchTier = z.infer<typeof matchTierSchema>;

export const pursuitRecommendationSchema = z.enum([
  "PRIORITIZE",
  "APPLY",
  "CONSIDER",
  "LOW_PRIORITY",
  "DO_NOT_RECOMMEND_YET"
]);
export type PursuitRecommendation = z.infer<typeof pursuitRecommendationSchema>;

export const resumeReadinessStateSchema = z.enum([
  "READY",
  "READY_WITH_LIMITATIONS",
  "NEEDS_REVIEW",
  "NOT_READY"
]);
export type ResumeReadinessState = z.infer<typeof resumeReadinessStateSchema>;

export const gapTypeSchema = z.enum([
  "NONE",
  "NO_EVIDENCE",
  "WEAK_EVIDENCE",
  "PROJECT_ONLY",
  "STALE_EVIDENCE",
  "RESTRICTED_ONLY",
  "EXPIRED_CERTIFICATION",
  "MISSING_CURRENT_CERTIFICATION",
  "MISSING_EDUCATION",
  "MISSING_CLEARANCE",
  "MISSING_WORK_AUTHORIZATION",
  "MISSING_RECENT_EXPERIENCE",
  "INDIRECT_EVIDENCE_ONLY",
  "UNRESOLVED"
]);
export type GapType = z.infer<typeof gapTypeSchema>;

export const criticalitySchema = z.enum(["CRITICAL", "MATERIAL", "MINOR", "NONE"]);
export type Criticality = z.infer<typeof criticalitySchema>;

export const conclusionCodeSchema = z.enum([
  "CORE_STRENGTH",
  "SUPPORTED_REQUIREMENT",
  "TRANSFERABLE_STRENGTH",
  "PROJECT_SUPPORTED",
  "STALE_SUPPORT",
  "RESTRICTED_SUPPORT",
  "LIMITED_SUPPORT",
  "NO_SUPPORT",
  "CRITICAL_GAP",
  "MATERIAL_GAP",
  "OPTIONAL_GAP",
  "CONTEXT_ONLY"
]);
export type ConclusionCode = z.infer<typeof conclusionCodeSchema>;

export const claimHandlingCategorySchema = z.enum([
  "OMIT",
  "QUALIFY",
  "PROJECT_ONLY",
  "EXPIRED",
  "NEEDS_USER_CONFIRMATION"
]);

export const componentSupportStateSchema = z.enum([
  "STRONG_DIRECT_SUPPORT",
  "GOOD_DIRECT_SUPPORT",
  "LIMITED_DIRECT_SUPPORT",
  "RESTRICTED_DIRECT_SUPPORT",
  "RELATED_SUPPORT",
  "RESTRICTED_RELATED_SUPPORT",
  "NO_QUALIFYING_EVIDENCE",
  "NO_RETRIEVABLE_EVIDENCE"
]);
export type ComponentSupportState = z.infer<typeof componentSupportStateSchema>;

export const reportComponentConclusionSchema = z.object({
  componentId: z.string().min(1),
  label: z.string().min(1),
  competencyId: z.string().min(1).nullable(),
  competencyName: z.string().min(1).nullable(),
  supportState: componentSupportStateSchema,
  gapStatus: z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "RESTRICTED"]),
  strongestEvidenceLabel: z.string().min(1).nullable(),
  strongestEvidenceClusterId: z.string().min(1).nullable(),
  strongestEvidenceCandidateId: z.string().min(1).nullable(),
  restrictionLabels: z.array(z.string().min(1)),
  resumeGuidance: z.string().min(1)
});
export type ReportComponentConclusion = z.infer<typeof reportComponentConclusionSchema>;

export const reportEvidenceClusterSchema = z.object({
  clusterId: z.string().min(1),
  primaryCandidateId: z.string().min(1),
  primaryLabel: z.string().min(1),
  evidenceType: z.string().min(1),
  context: z.enum(["PROFESSIONAL", "PROJECT", "EDUCATION", "CERTIFICATION", "OTHER"]),
  employer: z.string().nullable(),
  role: z.string().nullable(),
  project: z.string().nullable(),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  technologies: z.array(z.string().min(1)),
  relatedRepresentationIds: z.array(z.string().min(1)),
  relatedRepresentationLabels: z.array(z.string().min(1)),
  restrictionLabels: z.array(z.string().min(1))
});
export type ReportEvidenceCluster = z.infer<typeof reportEvidenceClusterSchema>;

export const requirementConclusionSchema = z.object({
  requirementId: z.string().min(1),
  requirementText: z.string().min(1),
  category: z.enum(["REQUIRED", "PREFERRED", "CONTEXTUAL", "RESPONSIBILITY"]),
  kinds: z.array(requirementKindSchema),
  evidenceStrengthState: requirementEvidenceStrengthStateSchema,
  highestCandidateScore: z.number().int().nullable(),
  highestCandidateStrengthBand: evidenceCandidateStrengthBandSchema.nullable(),
  topCandidateIds: z.array(z.string().min(1)),
  professionalEvidenceCount: z.number().int().nonnegative(),
  projectEvidenceCount: z.number().int().nonnegative(),
  restrictedEvidenceCount: z.number().int().nonnegative(),
  gapTypes: z.array(gapTypeSchema),
  criticality: criticalitySchema,
  conclusionCode: conclusionCodeSchema,
  strongestAlignmentLabel: z.string().min(1).nullable().optional(),
  componentConclusions: z.array(reportComponentConclusionSchema).optional(),
  topEvidenceClusters: z.array(reportEvidenceClusterSchema).optional(),
  explanation: z.string().min(1),
  resumeUseGuidance: z.string().min(1),
  provenance: z.object({
    scoringRequirementId: z.string().min(1),
    evidenceScoringRunId: z.string().min(1)
  })
});
export type RequirementConclusion = z.infer<typeof requirementConclusionSchema>;

export const reportStrengthSchema = z.object({
  strengthId: z.string().min(1),
  requirementIds: z.array(z.string().min(1)),
  strengthCategory: z.string().min(1),
  explanation: z.string().min(1),
  supportingEvidenceIds: z.array(z.string().min(1)),
  supportingEvidenceLabels: z.array(z.string().min(1)).optional(),
  supportingEvidenceClusterIds: z.array(z.string().min(1)).optional(),
  evidenceContext: z.enum(["PROFESSIONAL", "PROJECT", "MIXED"]),
  technologies: z.array(z.string().min(1)),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  resumeRelevance: z.enum(["PRIMARY", "SECONDARY"])
});

export const reportRiskSchema = z.object({
  riskId: z.string().min(1),
  requirementIds: z.array(z.string().min(1)),
  requirementText: z.string().min(1).optional(),
  gapType: gapTypeSchema,
  severity: criticalitySchema,
  explanation: z.string().min(1),
  strongestRelatedEvidenceLabels: z.array(z.string().min(1)).optional(),
  componentConclusions: z.array(reportComponentConclusionSchema).optional(),
  availableRestrictedEvidence: z.array(z.string().min(1)),
  availableProjectEvidence: z.array(z.string().min(1)),
  availableStaleEvidence: z.array(z.string().min(1)),
  resumeWarning: z.string().min(1),
  interviewWarning: z.string().min(1),
  provenance: z.object({
    evidenceScoringRunId: z.string().min(1),
    scoringRequirementIds: z.array(z.string().min(1))
  })
});

export const reportThemeSchema = z.object({
  themeId: z.string().min(1),
  label: z.string().min(1),
  supportingRequirementIds: z.array(z.string().min(1)),
  supportingEvidenceIds: z.array(z.string().min(1)),
  strength: z.enum(["STRONG", "GOOD", "LIMITED"]),
  professionalSupportCount: z.number().int().nonnegative(),
  projectSupportCount: z.number().int().nonnegative()
});

export const reportTechnologyPrioritySchema = z.object({
  technology: z.string().min(1),
  requirementImportance: z.number(),
  evidenceStrengthState: requirementEvidenceStrengthStateSchema,
  professionalEvidenceCount: z.number().int().nonnegative(),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  guidance: z.enum(["INCLUDE", "QUALIFY", "OMIT"])
});

export const reportRoleEmphasisSchema = z.object({
  roleId: z.string().min(1),
  employer: z.string().nullable(),
  roleTitle: z.string().nullable(),
  displayLabel: z.string().min(1).optional(),
  recencyLabel: z.string().min(1).optional(),
  supportedRequirementIds: z.array(z.string().min(1)),
  strongEvidenceCount: z.number().int().nonnegative(),
  relevantTechnologies: z.array(z.string().min(1)),
  relevantAccomplishments: z.array(z.string().min(1)),
  emphasisReason: z.string().min(1)
});

export const reportProjectConsiderationSchema = z.object({
  projectId: z.string().min(1),
  supportedRequirementIds: z.array(z.string().min(1)),
  strongestRelevance: z.enum(["STRONG", "GOOD", "LIMITED"]),
  technologies: z.array(z.string().min(1)),
  projectOnlyWarning: z.string().nullable()
});

export const reportClaimToAvoidSchema = z.object({
  concept: z.string().min(1),
  reason: z.string().min(1),
  missingOrRestrictedEvidenceIds: z.array(z.string().min(1)),
  truthfulnessRule: z.string().min(1),
  handling: claimHandlingCategorySchema
});

export const reportResumeGuidanceSchema = z.object({
  priorityEvidenceThemes: z.array(reportThemeSchema),
  priorityTechnologies: z.array(reportTechnologyPrioritySchema),
  rolesToEmphasize: z.array(reportRoleEmphasisSchema),
  projectsToConsider: z.array(reportProjectConsiderationSchema),
  claimsToAvoid: z.array(reportClaimToAvoidSchema)
});

export const matchReportSummarySchema = z.object({
  matchTier: matchTierSchema,
  pursuitRecommendation: pursuitRecommendationSchema,
  resumeReadinessState: resumeReadinessStateSchema,
  alignmentIndex: z.number().int().min(0).max(100).nullable(),
  requiredRequirementCount: z.number().int().nonnegative(),
  preferredRequirementCount: z.number().int().nonnegative(),
  responsibilityCount: z.number().int().nonnegative(),
  strongRequiredCount: z.number().int().nonnegative(),
  goodRequiredCount: z.number().int().nonnegative(),
  limitedRequiredCount: z.number().int().nonnegative(),
  weakRequiredCount: z.number().int().nonnegative(),
  requiredNoEvidenceCount: z.number().int().nonnegative(),
  requiredRestrictedOnlyCount: z.number().int().nonnegative(),
  criticalRequiredGapCount: z.number().int().nonnegative(),
  materialRequiredGapCount: z.number().int().nonnegative(),
  professionalCoreSupportCount: z.number().int().nonnegative(),
  projectOnlySupportCount: z.number().int().nonnegative(),
  staleSupportCount: z.number().int().nonnegative(),
  diagnosticErrorCount: z.number().int().nonnegative(),
  diagnosticWarningCount: z.number().int().nonnegative(),
  diagnosticInfoCount: z.number().int().nonnegative()
});

export const matchReportResultSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  scoringInputChecksum: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  matchReportContractVersion: semanticVersionSchema,
  matchReportEngineVersion: semanticVersionSchema,
  matchReportConfigurationVersion: semanticVersionSchema,
  scoringContractVersion: semanticVersionSchema,
  scoringEngineVersion: semanticVersionSchema,
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  status: matchReportRunStatusSchema,
  scoringStatus: evidenceScoringRunStatusSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: matchReportSummarySchema,
  reportConfiguration: z.record(z.string(), z.unknown()),
  requirementConclusions: z.array(requirementConclusionSchema),
  strengths: z.array(reportStrengthSchema),
  risksAndGaps: z.array(reportRiskSchema),
  resumeGuidance: reportResumeGuidanceSchema
});
export type MatchReportResult = z.infer<typeof matchReportResultSchema>;

export const matchReportInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  scoringResult: evidenceScoringResultSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1)
});
export type MatchReportInput = z.infer<typeof matchReportInputSchema>;
