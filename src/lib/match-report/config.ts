export const MATCH_REPORT_CONTRACT_VERSION = "1.0.0";
export const MATCH_REPORT_ENGINE_VERSION = "m4.3.1";
export const MATCH_REPORT_CONFIGURATION_VERSION = "scott-v1";

export const matchReportConfiguration = {
  version: MATCH_REPORT_CONFIGURATION_VERSION,
  requirementImportance: {
    REQUIRED: 1,
    PREFERRED: 0.55,
    CONTEXTUAL: 0.3,
    RESPONSIBILITY: 0.45
  },
  evidenceStrengthValues: {
    STRONG_EVIDENCE: 1,
    GOOD_EVIDENCE: 0.8,
    LIMITED_EVIDENCE: 0.5,
    WEAK_EVIDENCE: 0.25,
    NO_EVIDENCE: 0,
    RESTRICTED_ONLY: 0.15
  },
  criticalGapCaps: {
    centralTechnologyMissingMaxTier: "PARTIAL_ALIGNMENT",
    multipleCriticalGapsMaxTier: "WEAK_ALIGNMENT",
    requiredCurrentCertificationMissingMaxTier: "PARTIAL_ALIGNMENT"
  },
  matchTierThresholds: {
    STRONG_ALIGNMENT: 80,
    GOOD_ALIGNMENT: 62,
    PARTIAL_ALIGNMENT: 40,
    WEAK_ALIGNMENT: 20
  },
  resumeReadiness: {
    readyMaxCriticalGaps: 0,
    readyWithLimitationsMaxMaterialGaps: 2
  },
  topCandidatesPerRequirement: 3
} as const;
