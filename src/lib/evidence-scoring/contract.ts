import { z } from "zod";
import {
  matchedCompetencySchema,
  requirementCompetencyComponentSchema
} from "@/lib/competencies/contract";
import {
  candidateEvidenceSchema,
  evidenceDiagnosticSchema,
  evidenceEligibilityStateSchema,
  evidenceRestrictionSchema,
  evidenceRetrievalResultSchema,
  evidenceRetrievalRunStatusSchema,
  evidenceTypeSchema,
  retrievalReasonSchema
} from "@/lib/evidence-retrieval/contract";
import { requirementKindSchema } from "@/lib/job-descriptions/requirement-analysis-contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const evidenceScoringRunStatusSchema = evidenceRetrievalRunStatusSchema;
export type EvidenceScoringRunStatus = z.infer<typeof evidenceScoringRunStatusSchema>;

export const evidenceCandidateStrengthBandSchema = z.enum([
  "STRONG",
  "GOOD",
  "LIMITED",
  "WEAK",
  "INELIGIBLE"
]);
export type EvidenceCandidateStrengthBand = z.infer<typeof evidenceCandidateStrengthBandSchema>;

export const requirementEvidenceStrengthStateSchema = z.enum([
  "STRONG_EVIDENCE",
  "GOOD_EVIDENCE",
  "LIMITED_EVIDENCE",
  "WEAK_EVIDENCE",
  "NO_EVIDENCE",
  "RESTRICTED_ONLY",
  "EXCLUDED"
]);
export type RequirementEvidenceStrengthState = z.infer<
  typeof requirementEvidenceStrengthStateSchema
>;

export const scoreContributionSchema = z.object({
  factorCode: z.string().min(1),
  label: z.string().min(1),
  value: z.number().int(),
  explanation: z.string().min(1),
  sourceRelationship: z.string().min(1),
  configurationWeight: z.number(),
  capped: z.boolean(),
  ruleIdentifier: z.string().min(1)
});
export type ScoreContribution = z.infer<typeof scoreContributionSchema>;

export const rankedCandidateScoreSchema = z.object({
  candidateId: z.string().min(1),
  careerEvidenceId: z.string().min(1),
  displayTitle: z.string().min(1),
  claimText: z.string().min(1),
  evidenceType: evidenceTypeSchema,
  context: candidateEvidenceSchema.shape.context,
  recency: candidateEvidenceSchema.shape.recency,
  recordKind: z.string().min(1),
  confirmationState: z.string().min(1),
  metricVerificationState: z.string().nullable(),
  employer: z.string().nullable(),
  role: z.string().nullable(),
  project: z.string().nullable(),
  skill: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  matchedTechnologies: z.array(z.string().min(1)),
  matchedRequirementKinds: z.array(requirementKindSchema),
  dateMetadata: candidateEvidenceSchema.shape.dateMetadata,
  sourceProvenance: candidateEvidenceSchema.shape.sourceProvenance,
  evidenceClusterId: z.string().min(1).optional(),
  evidenceClusterMemberIds: z.array(z.string().min(1)).optional(),
  retrievalReasons: z.array(retrievalReasonSchema),
  matchedCompetencies: z.array(matchedCompetencySchema).optional(),
  restrictions: z.array(evidenceRestrictionSchema),
  eligibility: evidenceEligibilityStateSchema,
  visibleForDiagnostics: z.boolean(),
  exclusionReasons: z.array(z.string().min(1)),
  finalScore: z.number().int().nullable(),
  unclampedScore: z.number().int().nullable(),
  strengthBand: evidenceCandidateStrengthBandSchema,
  rank: z.number().int().positive().nullable(),
  directRelationshipStrength: z.number().int(),
  factorContributions: z.array(scoreContributionSchema),
  penaltyContributions: z.array(scoreContributionSchema)
});
export type RankedCandidateScore = z.infer<typeof rankedCandidateScoreSchema>;

export const scoredRequirementRecordSchema = z.object({
  requirementId: z.string().min(1),
  itemType: z.enum(["REQUIREMENT", "RESPONSIBILITY"]),
  category: z.enum(["REQUIRED", "PREFERRED", "CONTEXTUAL", "RESPONSIBILITY"]),
  requirementImportance: z.number(),
  kinds: z.array(requirementKindSchema),
  originalText: z.string().min(1),
  correctedDisplayText: z.string().nullable(),
  mappedCompetencies: z.array(matchedCompetencySchema).optional(),
  competencyComponents: z.array(requirementCompetencyComponentSchema).optional(),
  evidenceStrengthState: requirementEvidenceStrengthStateSchema,
  highestCandidateScore: z.number().int().nullable(),
  eligibleCandidateCount: z.number().int().nonnegative(),
  restrictedCandidateCount: z.number().int().nonnegative(),
  ineligibleCandidateCount: z.number().int().nonnegative(),
  rankedCandidates: z.array(rankedCandidateScoreSchema),
  diagnostics: z.array(evidenceDiagnosticSchema)
});
export type ScoredRequirementRecord = z.infer<typeof scoredRequirementRecordSchema>;

export const evidenceScoringSummarySchema = z.object({
  requirementsScored: z.number().int().nonnegative(),
  requiredStrongEvidenceCount: z.number().int().nonnegative(),
  requiredGoodEvidenceCount: z.number().int().nonnegative(),
  requiredLimitedOrWeakEvidenceCount: z.number().int().nonnegative(),
  requiredNoEvidenceCount: z.number().int().nonnegative(),
  preferredStrongOrGoodEvidenceCount: z.number().int().nonnegative(),
  restrictedOnlyRequirementCount: z.number().int().nonnegative(),
  noEvidenceRequirementCount: z.number().int().nonnegative(),
  averageEligibleCandidateScore: z.number().nullable(),
  diagnosticErrorCount: z.number().int().nonnegative(),
  diagnosticWarningCount: z.number().int().nonnegative(),
  diagnosticInfoCount: z.number().int().nonnegative()
});
export type EvidenceScoringSummary = z.infer<typeof evidenceScoringSummarySchema>;

export const evidenceScoringResultSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  evidenceRetrievalInputChecksum: z.string().min(1),
  competencyCatalogVersion: semanticVersionSchema.optional(),
  competencyCatalogChecksum: z.string().min(1).optional(),
  competencyMappingEngineVersion: semanticVersionSchema.optional(),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  retrievalContractVersion: semanticVersionSchema,
  scoringContractVersion: semanticVersionSchema,
  scoringEngineVersion: semanticVersionSchema,
  scoringConfigurationVersion: semanticVersionSchema,
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  status: evidenceScoringRunStatusSchema,
  retrievalStatus: evidenceRetrievalRunStatusSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: evidenceScoringSummarySchema,
  scoringConfiguration: z.record(z.string(), z.unknown()),
  requirementScores: z.array(scoredRequirementRecordSchema)
});
export type EvidenceScoringResult = z.infer<typeof evidenceScoringResultSchema>;

export const evidenceScoringInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  retrievalResult: evidenceRetrievalResultSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1)
});
export type EvidenceScoringInput = z.infer<typeof evidenceScoringInputSchema>;
