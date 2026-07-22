import { z } from "zod";
import { jsonValueSchema } from "@/lib/career/contracts";
import {
  requirementAnalysisReviewStatusSchema,
  requirementCategorySchema,
  requirementKindSchema
} from "@/lib/job-descriptions/requirement-analysis-contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const EVIDENCE_RETRIEVAL_CONTRACT_VERSION = "1.0.0";
export const EVIDENCE_RETRIEVAL_ENGINE_VERSION = "m4.1.0";

export const evidenceRetrievalRunStatusSchema = z.enum([
  "PENDING",
  "SUCCESS",
  "SUCCESS_WITH_WARNINGS",
  "FAILED"
]);
export type EvidenceRetrievalRunStatus = z.infer<typeof evidenceRetrievalRunStatusSchema>;

export const evidenceCoverageStateSchema = z.enum([
  "CANDIDATES_FOUND",
  "LIMITED_CANDIDATES",
  "NO_CANDIDATES",
  "EXCLUDED",
  "NOT_APPLICABLE"
]);
export type EvidenceCoverageState = z.infer<typeof evidenceCoverageStateSchema>;

export const evidenceEligibilityStateSchema = z.enum([
  "ELIGIBLE",
  "ELIGIBLE_WITH_RESTRICTIONS",
  "INELIGIBLE"
]);
export type EvidenceEligibilityState = z.infer<typeof evidenceEligibilityStateSchema>;

export const evidenceContextSchema = z.enum([
  "PROFESSIONAL",
  "PROJECT",
  "EDUCATION",
  "CERTIFICATION",
  "OTHER"
]);
export type EvidenceContext = z.infer<typeof evidenceContextSchema>;

export const evidenceTypeSchema = z.enum([
  "ROLE",
  "RESPONSIBILITY",
  "ACCOMPLISHMENT",
  "PROJECT",
  "PROJECT_RESPONSIBILITY",
  "PROJECT_ACCOMPLISHMENT",
  "SKILL",
  "TECHNOLOGY_USAGE",
  "METRIC",
  "EDUCATION",
  "CERTIFICATION",
  "INTERVIEW_STORY",
  "LEADERSHIP",
  "ARCHITECTURE",
  "DOMAIN",
  "OTHER"
]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const evidenceRecencySchema = z.enum([
  "CURRENT",
  "RECENT",
  "OLDER",
  "STALE",
  "UNKNOWN"
]);
export type EvidenceRecency = z.infer<typeof evidenceRecencySchema>;

export const evidenceRestrictionCodeSchema = z.enum([
  "STALE_SKILL",
  "PROJECT_ONLY",
  "EXPIRED_CERTIFICATION",
  "UNVERIFIED_METRIC",
  "DERIVED_ONLY",
  "UNCONFIRMED",
  "AI_SUGGESTION",
  "INTERMITTENT_USE",
  "NO_DIRECT_REQUIREMENT_LINK",
  "MISSING_DATE"
]);
export type EvidenceRestrictionCode = z.infer<typeof evidenceRestrictionCodeSchema>;

export const evidenceReasonCodeSchema = z.enum([
  "EXACT_TECHNOLOGY_MATCH",
  "TECHNOLOGY_ALIAS_MATCH",
  "SKILL_EVIDENCE_LINK",
  "ROLE_RESPONSIBILITY_MATCH",
  "PROJECT_RESPONSIBILITY_MATCH",
  "ARCHITECTURE_CONCEPT_MATCH",
  "COMMUNICATION_MATCH",
  "COLLABORATION_MATCH",
  "DATA_MATCH",
  "AI_ML_MATCH",
  "DOMAIN_MATCH",
  "LEADERSHIP_MATCH",
  "EDUCATION_MATCH",
  "CERTIFICATION_MATCH",
  "EXPERIENCE_CONTEXT_MATCH",
  "DIRECT_EVIDENCE_REFERENCE",
  "USER_CONFIRMED_RELATIONSHIP"
]);
export type EvidenceReasonCode = z.infer<typeof evidenceReasonCodeSchema>;

export const evidenceDiagnosticSeveritySchema = z.enum(["ERROR", "WARNING", "INFO"]);
export type EvidenceDiagnosticSeverity = z.infer<typeof evidenceDiagnosticSeveritySchema>;

export const retrievalReasonSchema = z.object({
  code: evidenceReasonCodeSchema,
  explanation: z.string().min(1),
  sourceRequirementConcept: z.string().nullable(),
  sourceCareerField: z.string().nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  matchingRule: z.string().min(1)
});
export type RetrievalReason = z.infer<typeof retrievalReasonSchema>;

export const evidenceRestrictionSchema = z.object({
  code: evidenceRestrictionCodeSchema,
  explanation: z.string().min(1)
});
export type EvidenceRestriction = z.infer<typeof evidenceRestrictionSchema>;

export const evidenceDiagnosticSchema = z.object({
  severity: evidenceDiagnosticSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  relatedRequirementId: z.string().nullable(),
  relatedCandidateId: z.string().nullable()
});
export type EvidenceDiagnostic = z.infer<typeof evidenceDiagnosticSchema>;

export const evidenceDateMetadataSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  lastUsedDate: z.string().nullable(),
  datePrecision: z.enum(["YEAR", "MONTH", "DATE", "UNKNOWN"]).nullable()
});
export type EvidenceDateMetadata = z.infer<typeof evidenceDateMetadataSchema>;

export const candidateEvidenceSchema = z.object({
  candidateId: z.string().min(1),
  careerEvidenceId: z.string().min(1),
  evidenceType: evidenceTypeSchema,
  displayTitle: z.string().min(1),
  claimText: z.string().min(1),
  employer: z.string().nullable(),
  role: z.string().nullable(),
  project: z.string().nullable(),
  skill: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  dateMetadata: evidenceDateMetadataSchema,
  recency: evidenceRecencySchema,
  context: evidenceContextSchema,
  confirmationState: z.string().min(1),
  recordKind: z.string().min(1),
  metric: jsonValueSchema.nullable(),
  metricVerificationState: z.string().nullable(),
  sourceProvenance: z.object({
    sourceSection: z.string().min(1),
    sourceId: z.string().nullable(),
    sourcePath: z.string().min(1)
  }),
  retrievalReasons: z.array(retrievalReasonSchema),
  matchedRequirementKinds: z.array(requirementKindSchema),
  matchedTechnologies: z.array(z.string().min(1)),
  restrictions: z.array(evidenceRestrictionSchema),
  eligibility: evidenceEligibilityStateSchema
});
export type CandidateEvidence = z.infer<typeof candidateEvidenceSchema>;

export const retrievedRequirementRecordSchema = z.object({
  requirementId: z.string().min(1),
  itemType: z.enum(["REQUIREMENT", "RESPONSIBILITY"]),
  category: requirementCategorySchema.or(z.literal("RESPONSIBILITY")),
  reviewStatus: requirementAnalysisReviewStatusSchema,
  kinds: z.array(requirementKindSchema),
  originalText: z.string().min(1),
  correctedDisplayText: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  experienceText: z.string().nullable(),
  sourceProvenance: z.object({
    sourceSectionId: z.string().nullable(),
    parserStatementId: z.string().nullable(),
    parserResponsibilityId: z.string().nullable()
  }),
  retrievalStatus: z.enum([
    "ELIGIBLE",
    "EXCLUDED",
    "MALFORMED",
    "SKIPPED_NOISE",
    "NOT_APPLICABLE"
  ]),
  candidateEvidence: z.array(candidateEvidenceSchema),
  excludedEvidence: z.array(candidateEvidenceSchema),
  diagnostics: z.array(evidenceDiagnosticSchema),
  coverageState: evidenceCoverageStateSchema
});
export type RetrievedRequirementRecord = z.infer<typeof retrievedRequirementRecordSchema>;

export const evidenceRetrievalSummarySchema = z.object({
  totalRequirements: z.number().int().nonnegative(),
  includedRequirements: z.number().int().nonnegative(),
  excludedRequirements: z.number().int().nonnegative(),
  requiredWithCandidates: z.number().int().nonnegative(),
  preferredWithCandidates: z.number().int().nonnegative(),
  contextualWithCandidates: z.number().int().nonnegative(),
  responsibilitiesWithCandidates: z.number().int().nonnegative(),
  noCandidateCount: z.number().int().nonnegative(),
  limitedCandidateCount: z.number().int().nonnegative(),
  restrictedCandidateCount: z.number().int().nonnegative(),
  professionalCandidateCount: z.number().int().nonnegative(),
  projectCandidateCount: z.number().int().nonnegative(),
  educationCandidateCount: z.number().int().nonnegative(),
  certificationCandidateCount: z.number().int().nonnegative(),
  diagnosticErrorCount: z.number().int().nonnegative(),
  diagnosticWarningCount: z.number().int().nonnegative(),
  diagnosticInfoCount: z.number().int().nonnegative()
});
export type EvidenceRetrievalSummary = z.infer<typeof evidenceRetrievalSummarySchema>;

export const evidenceRetrievalResultSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  retrievalContractVersion: semanticVersionSchema,
  retrievalEngineVersion: semanticVersionSchema,
  careerSourceChecksum: z.string().min(1),
  requirementSourceChecksum: z.string().min(1),
  inputChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  status: evidenceRetrievalRunStatusSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: evidenceRetrievalSummarySchema,
  requirementResults: z.array(retrievedRequirementRecordSchema),
  recencyPolicy: z.object({
    currentYears: z.number().positive(),
    recentYears: z.number().positive(),
    olderYears: z.number().positive(),
    evaluatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
});
export type EvidenceRetrievalResult = z.infer<typeof evidenceRetrievalResultSchema>;
