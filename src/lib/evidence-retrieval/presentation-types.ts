export const requirementSupportStateValues = [
  "STRONG_SUPPORT",
  "GOOD_SUPPORT",
  "LIMITED_SUPPORT",
  "RESTRICTED_SUPPORT_ONLY",
  "RELATED_EVIDENCE_ONLY",
  "NO_QUALIFYING_EVIDENCE",
  "EXCLUDED"
] as const;

export type RequirementSupportState = (typeof requirementSupportStateValues)[number];

export type TechnologyCoverageStatus = "SUPPORTED" | "RESTRICTED" | "UNSUPPORTED";

export type TechnologyCoverageView = {
  technology: string;
  status: TechnologyCoverageStatus;
};

export type EvidenceCandidateClusterView = {
  clusterId: string;
  title: string;
  summaryLabel: string;
  evidenceTypeLabel: string;
  contextLabel: string;
  recencyLabel: string;
  eligibilityLabel: string;
  claimText: string;
  technologies: string[];
  matchedTechnologies: string[];
  whyMatched: string[];
  restrictionLabels: string[];
  restrictionCodes: string[];
  provenanceLabel: string;
  primaryCandidateId: string;
  relatedVariantCount: number;
  score: number;
};

export type EvidenceRequirementView = {
  requirementId: string;
  title: string;
  categoryLabel: string;
  supportState: RequirementSupportState;
  supportStateLabel: string;
  supportExplanation: string;
  conciseExplanation: string;
  kinds: string[];
  technologies: string[];
  primaryTechnologies: string[];
  strongestEvidenceCount: number;
  restrictedEvidenceCount: number;
  relatedEvidenceCount: number;
  topCandidates: EvidenceCandidateClusterView[];
  remainingCandidates: EvidenceCandidateClusterView[];
  defaultVisibleCount: number;
  diagnostics: string[];
  bundleCoverage: TechnologyCoverageView[];
  retrievalStatusLabel: string;
};

export type EvidenceRequirementSectionView = {
  id: string;
  title: string;
  description: string;
  items: EvidenceRequirementView[];
};

export type EvidenceSummaryView = {
  totalRequired: number;
  strongRequired: number;
  goodRequired: number;
  limitedRequired: number;
  restrictedOnlyRequired: number;
  unmatchedRequired: number;
  supportedPreferred: number;
  partialPreferred: number;
  unmatchedPreferred: number;
  responsibilityCoverageCount: number;
  restrictedCandidateCount: number;
  retrievalStatusLabel: string;
};

export type EvidenceOverviewItem = {
  label: string;
  detail: string;
};

export type EvidenceTechnicalDetailsView = {
  runId: string;
  careerProfileVersionId: string;
  requirementAnalysisId: string;
  retrievalEngineVersion: string;
  retrievalContractVersion: string;
  careerSourceChecksum: string;
  requirementSourceChecksum: string;
  inputChecksum: string;
  recencyPolicyLabel: string;
};

export type EvidencePageViewModel = {
  summary: EvidenceSummaryView;
  strongestAreas: EvidenceOverviewItem[];
  largestGaps: EvidenceOverviewItem[];
  required: EvidenceRequirementView[];
  preferred: EvidenceRequirementView[];
  contextual: EvidenceRequirementView[];
  responsibilities: EvidenceRequirementView[];
  excluded: EvidenceRequirementView[];
  sections: EvidenceRequirementSectionView[];
  technicalDetails: EvidenceTechnicalDetailsView;
};
