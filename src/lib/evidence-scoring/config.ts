export const EVIDENCE_SCORING_CONTRACT_VERSION = "1.0.0";
export const EVIDENCE_SCORING_ENGINE_VERSION = "m4.2.0";
export const EVIDENCE_SCORING_CONFIGURATION_VERSION = "scott-v1";

export type RequirementImportanceKey =
  | "REQUIRED"
  | "PREFERRED"
  | "CONTEXTUAL"
  | "RESPONSIBILITY";

export type EvidenceContextKey =
  | "PROFESSIONAL"
  | "PROJECT"
  | "EDUCATION"
  | "CERTIFICATION"
  | "OTHER";

export const evidenceScoringConfiguration = {
  version: EVIDENCE_SCORING_CONFIGURATION_VERSION,
  scoreBounds: {
    minimum: 0,
    maximum: 100
  },
  requirementImportance: {
    REQUIRED: 1,
    PREFERRED: 0.75,
    CONTEXTUAL: 0.45,
    RESPONSIBILITY: 0.65
  } satisfies Record<RequirementImportanceKey, number>,
  evidenceContextWeights: {
    PROFESSIONAL: 15,
    PROJECT: 8,
    EDUCATION: 2,
    CERTIFICATION: 2,
    OTHER: 2
  } satisfies Record<EvidenceContextKey, number>,
  contextRequirementOverrides: {
    EDUCATION: 10,
    CERTIFICATION: 10
  },
  recencyWeights: {
    CURRENT: 12,
    RECENT: 8,
    OLDER: 3,
    STALE: -8,
    UNKNOWN: 0
  },
  recordKindWeights: {
    SOURCE_FACT: 10,
    USER_CONFIRMED: 10,
    DERIVED: 0
  },
  confirmationStateWeights: {
    USER_CONFIRMED: 10,
    VERIFIED: 8,
    PROJECT_VERIFIED: 6,
    SOURCE_PROVIDED: 6,
    EXPIRED_REFERENCE: 2
  },
  factorWeights: {
    EXACT_TECHNOLOGY_MATCH: 22,
    TECHNOLOGY_ALIAS_MATCH: 18,
    DIRECT_EVIDENCE_REFERENCE: 24,
    SKILL_EVIDENCE_LINK: 20,
    ROLE_RESPONSIBILITY_MATCH: 18,
    PROJECT_RESPONSIBILITY_MATCH: 13,
    ARCHITECTURE_CONCEPT_MATCH: 16,
    LEADERSHIP_MATCH: 16,
    DOMAIN_MATCH: 10,
    CLOUD_PLATFORM_ALIGNMENT: 12,
    EDUCATION_MATCH: 18,
    CERTIFICATION_MATCH: 18,
    EXPERIENCE_CONTEXT_MATCH: 12,
    USER_CONFIRMED_RELATIONSHIP: 20
  },
  penaltyWeights: {
    STALE_SKILL: -12,
    PROJECT_ONLY: -5,
    EXPIRED_CERTIFICATION: -30,
    UNVERIFIED_METRIC: -4,
    DERIVED_ONLY: -8,
    UNCONFIRMED: -15,
    INTERMITTENT_USE: -5,
    NO_DIRECT_REQUIREMENT_LINK: -10,
    MISSING_DATE: -3,
    FACTOR_FAMILY_CAP: -2
  },
  metricWeights: {
    VERIFIED: 8,
    PROJECT_VERIFIED: 8,
    USER_CONFIRMED: 8,
    UNVERIFIED: 2
  },
  strengthBands: {
    STRONG: { minimum: 75, maximum: 100 },
    GOOD: { minimum: 55, maximum: 74 },
    LIMITED: { minimum: 30, maximum: 54 },
    WEAK: { minimum: 1, maximum: 29 }
  },
  familyCaps: {
    TECHNOLOGY: 22,
    EXPLICIT_RELATIONSHIP: 24,
    RESPONSIBILITY: 18,
    CONCEPTUAL_ALIGNMENT: 16
  },
  tieBreaking: [
    "eligibility",
    "finalScore",
    "directRelationshipStrength",
    "professionalContext",
    "recency",
    "verifiedMetric",
    "candidateId"
  ] as const
} as const;

