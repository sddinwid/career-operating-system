import type {
  CandidateEvidence,
  EvidenceRetrievalResult,
  RetrievedRequirementRecord
} from "@/lib/evidence-retrieval/contract";
import type {
  EvidenceCandidateClusterView,
  EvidenceOverviewItem,
  EvidencePageViewModel,
  EvidenceRequirementSectionView,
  EvidenceRequirementView,
  EvidenceSummaryView,
  RequirementSupportState,
  TechnologyCoverageView
} from "@/lib/evidence-retrieval/presentation-types";

type RankedCandidate = {
  candidate: CandidateEvidence;
  score: number;
  directStrength: number;
  contextPriority: number;
  typePriority: number;
};

const restrictionLabels: Record<string, string> = {
  PROJECT_ONLY: "Project evidence",
  MISSING_DATE: "Date not recorded",
  STALE_SKILL: "Older experience",
  EXPIRED_CERTIFICATION: "Expired certification",
  UNVERIFIED_METRIC: "Unverified metric",
  DERIVED_ONLY: "Derived evidence",
  UNCONFIRMED: "Needs confirmation",
  INTERMITTENT_USE: "Intermittent use",
  NO_DIRECT_REQUIREMENT_LINK: "Indirect relationship only",
  AI_SUGGESTION: "AI suggestion"
};

const reasonPriority: Record<string, number> = {
  DIRECT_EVIDENCE_REFERENCE: 6,
  SKILL_EVIDENCE_LINK: 5,
  EXACT_TECHNOLOGY_MATCH: 4,
  TECHNOLOGY_ALIAS_MATCH: 3,
  ROLE_RESPONSIBILITY_MATCH: 4,
  PROJECT_RESPONSIBILITY_MATCH: 3,
  ARCHITECTURE_CONCEPT_MATCH: 3,
  COMMUNICATION_MATCH: 3,
  COLLABORATION_MATCH: 3,
  DATA_MATCH: 4,
  AI_ML_MATCH: 4,
  LEADERSHIP_MATCH: 4,
  DOMAIN_MATCH: 2,
  EDUCATION_MATCH: 5,
  CERTIFICATION_MATCH: 5,
  EXPERIENCE_CONTEXT_MATCH: 3,
  USER_CONFIRMED_RELATIONSHIP: 4
};

function humanizeCode(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRestrictionLabel(code: string) {
  return restrictionLabels[code] ?? humanizeCode(code);
}

function formatRequirementTitle(item: RetrievedRequirementRecord) {
  return item.correctedDisplayText ?? item.originalText;
}

function getRequirementFocus(item: RetrievedRequirementRecord) {
  if (item.kinds.includes("CERTIFICATION")) {
    return "CERTIFICATION";
  }
  if (item.kinds.includes("EDUCATION")) {
    return "EDUCATION";
  }
  if (item.kinds.includes("LEADERSHIP")) {
    return "LEADERSHIP";
  }
  if (item.kinds.includes("AI_ML")) {
    return "AI_ML";
  }
  if (item.kinds.includes("DATA")) {
    return "DATA";
  }
  if (item.kinds.includes("COMMUNICATION")) {
    return "COMMUNICATION";
  }
  if (item.kinds.includes("COLLABORATION")) {
    return "COLLABORATION";
  }
  if (item.kinds.includes("TECHNOLOGY")) {
    return "TECHNOLOGY";
  }
  if (item.kinds.includes("RESPONSIBILITY")) {
    return "RESPONSIBILITY";
  }
  if (item.kinds.includes("ARCHITECTURE")) {
    return "ARCHITECTURE";
  }
  return "GENERAL";
}

function getDirectStrength(candidate: CandidateEvidence) {
  return candidate.retrievalReasons.reduce((highest, reason) => {
    return Math.max(highest, reasonPriority[reason.code] ?? 1);
  }, 0);
}

function getContextPriority(candidate: CandidateEvidence) {
  return (
    {
      PROFESSIONAL: 4,
      PROJECT: 3,
      EDUCATION: 2,
      CERTIFICATION: 2,
      OTHER: 1
    } as const
  )[candidate.context];
}

function getTypePriority(focus: string, candidate: CandidateEvidence) {
  const scoreByType = (pairs: Array<[CandidateEvidence["evidenceType"], number]>, fallback = 1) => {
    return pairs.find(([value]) => value === candidate.evidenceType)?.[1] ?? fallback;
  };

  switch (focus) {
    case "TECHNOLOGY":
      return scoreByType(
        [
          ["RESPONSIBILITY", 7],
          ["ACCOMPLISHMENT", 7],
          ["METRIC", 6],
          ["ROLE", 5],
          ["PROJECT_ACCOMPLISHMENT", 5],
          ["PROJECT_RESPONSIBILITY", 5],
          ["ARCHITECTURE", 4],
          ["TECHNOLOGY_USAGE", 4],
          ["SKILL", 2]
        ],
        3
      );
    case "LEADERSHIP":
      return scoreByType(
        [
          ["LEADERSHIP", 7],
          ["RESPONSIBILITY", 6],
          ["ROLE", 5],
          ["INTERVIEW_STORY", 4]
        ],
        2
      );
    case "DATA":
    case "AI_ML":
    case "ARCHITECTURE":
      return scoreByType(
        [
          ["ARCHITECTURE", 7],
          ["RESPONSIBILITY", 6],
          ["ACCOMPLISHMENT", 6],
          ["PROJECT", 5],
          ["PROJECT_ACCOMPLISHMENT", 5],
          ["INTERVIEW_STORY", 4],
          ["SKILL", 2]
        ],
        3
      );
    case "EDUCATION":
      return scoreByType([["EDUCATION", 7]], 1);
    case "CERTIFICATION":
      return scoreByType([["CERTIFICATION", 7]], 1);
    default:
      return scoreByType(
        [
          ["RESPONSIBILITY", 6],
          ["ACCOMPLISHMENT", 6],
          ["ROLE", 5],
          ["LEADERSHIP", 5],
          ["INTERVIEW_STORY", 4],
          ["ARCHITECTURE", 4],
          ["SKILL", 2]
        ],
        3
      );
  }
}

function getRecencyPriority(candidate: CandidateEvidence) {
  return (
    {
      CURRENT: 5,
      RECENT: 4,
      OLDER: 3,
      UNKNOWN: 2,
      STALE: 1
    } as const
  )[candidate.recency];
}

function rankCandidates(item: RetrievedRequirementRecord) {
  const focus = getRequirementFocus(item);

  return [...item.candidateEvidence, ...item.excludedEvidence]
    .map<RankedCandidate>((candidate) => {
      const directStrength = getDirectStrength(candidate);
      const contextPriority = getContextPriority(candidate);
      const typePriority = getTypePriority(focus, candidate);
      const restrictionPenalty =
        candidate.restrictions.length * 5 +
        (candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY") ? 6 : 0) +
        (candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL") ? 6 : 0);
      const eligibilityScore =
        candidate.eligibility === "ELIGIBLE"
          ? 38
          : candidate.eligibility === "ELIGIBLE_WITH_RESTRICTIONS"
            ? 22
            : 0;
      const score =
        eligibilityScore +
        directStrength * 9 +
        contextPriority * 6 +
        typePriority * 5 +
        getRecencyPriority(candidate) * 3 -
        restrictionPenalty;

      return {
        candidate,
        score,
        directStrength,
        contextPriority,
        typePriority
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.directStrength !== left.directStrength) {
        return right.directStrength - left.directStrength;
      }
      if (right.contextPriority !== left.contextPriority) {
        return right.contextPriority - left.contextPriority;
      }
      if (right.typePriority !== left.typePriority) {
        return right.typePriority - left.typePriority;
      }
      return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
    });
}

function buildClusterKey(candidate: CandidateEvidence) {
  return [
    candidate.displayTitle,
    candidate.claimText,
    candidate.context,
    candidate.employer ?? "",
    candidate.role ?? "",
    candidate.project ?? "",
    [...candidate.matchedTechnologies].sort().join("|")
  ].join("::");
}

function buildSummaryLabel(candidate: CandidateEvidence) {
  return [candidate.employer, candidate.role, candidate.project].filter(Boolean).join(" • ") || "Supporting evidence";
}

function buildClusterView(rankedCandidates: RankedCandidate[]) {
  const groups = new Map<string, RankedCandidate[]>();

  for (const ranked of rankedCandidates) {
    const key = buildClusterKey(ranked.candidate);
    groups.set(key, [...(groups.get(key) ?? []), ranked]);
  }

  return [...groups.entries()]
    .map<EvidenceCandidateClusterView>(([clusterId, members]) => {
      const primary = members[0]!;
      const candidate = primary.candidate;
      return {
        clusterId,
        title: candidate.displayTitle,
        summaryLabel: buildSummaryLabel(candidate),
        evidenceTypeLabel: humanizeCode(candidate.evidenceType),
        contextLabel: humanizeCode(candidate.context),
        recencyLabel: humanizeCode(candidate.recency),
        eligibilityLabel: humanizeCode(candidate.eligibility),
        claimText: candidate.claimText,
        technologies: candidate.technologies,
        matchedTechnologies: candidate.matchedTechnologies,
        whyMatched: candidate.retrievalReasons.map((reason) => reason.explanation),
        restrictionLabels: candidate.restrictions.map((restriction) => getRestrictionLabel(restriction.code)),
        restrictionCodes: candidate.restrictions.map((restriction) => restriction.code),
        provenanceLabel: `${candidate.sourceProvenance.sourceSection} • ${candidate.sourceProvenance.sourcePath}`,
        primaryCandidateId: candidate.candidateId,
        relatedVariantCount: members.length - 1,
        score: primary.score
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.primaryCandidateId.localeCompare(right.primaryCandidateId);
    });
}

function buildBundleCoverage(item: RetrievedRequirementRecord) {
  if (item.technologies.length <= 1) {
    return [];
  }

  return item.technologies.map<TechnologyCoverageView>((technology) => {
    const supporting = item.candidateEvidence.filter((candidate) =>
      candidate.matchedTechnologies.some((matched) => matched.toLowerCase() === technology.toLowerCase())
    );
    if (supporting.some((candidate) => candidate.restrictions.length === 0)) {
      return { technology, status: "SUPPORTED" };
    }
    if (supporting.length > 0) {
      return { technology, status: "RESTRICTED" };
    }
    return { technology, status: "UNSUPPORTED" };
  });
}

function getSupportState(item: RetrievedRequirementRecord, clusters: EvidenceCandidateClusterView[]) {
  if (item.coverageState === "EXCLUDED") {
    return "EXCLUDED";
  }

  if (clusters.length === 0) {
    return "NO_QUALIFYING_EVIDENCE";
  }

  const unrestricted = clusters.filter((cluster) => cluster.restrictionCodes.length === 0);
  const bundleCoverage = buildBundleCoverage(item);
  const hasUnsupportedBundleTechnology = bundleCoverage.some((entry) => entry.status === "UNSUPPORTED");

  if (unrestricted.length === 0) {
    return "RESTRICTED_SUPPORT_ONLY";
  }

  const top = unrestricted[0]!;
  if (hasUnsupportedBundleTechnology) {
    return "LIMITED_SUPPORT";
  }
  if (top.score >= 96) {
    return "STRONG_SUPPORT";
  }
  if (top.score >= 76) {
    return "GOOD_SUPPORT";
  }
  if (top.score >= 52) {
    return "LIMITED_SUPPORT";
  }

  return "RELATED_EVIDENCE_ONLY";
}

function getSupportStateLabel(state: RequirementSupportState) {
  return (
    {
      STRONG_SUPPORT: "Strong support",
      GOOD_SUPPORT: "Good support",
      LIMITED_SUPPORT: "Limited support",
      RESTRICTED_SUPPORT_ONLY: "Restricted support only",
      RELATED_EVIDENCE_ONLY: "Related evidence only",
      NO_QUALIFYING_EVIDENCE: "No qualifying evidence",
      EXCLUDED: "Excluded"
    } as const
  )[state];
}

function getSupportExplanation(
  state: RequirementSupportState,
  item: RetrievedRequirementRecord,
  clusters: EvidenceCandidateClusterView[]
) {
  if (state === "EXCLUDED") {
    return "This item was intentionally excluded from downstream matching.";
  }
  if (state === "NO_QUALIFYING_EVIDENCE") {
    return "No evidence was retrieved for this requirement.";
  }
  if (state === "RESTRICTED_SUPPORT_ONLY") {
    if (clusters.every((cluster) => cluster.restrictionCodes.includes("PROJECT_ONLY"))) {
      return "Direct project evidence exists, but no qualifying professional evidence was found.";
    }
    return "Related evidence was found, but all candidates carry restrictions.";
  }
  if (state === "RELATED_EVIDENCE_ONLY") {
    return "Related evidence exists, but no direct qualifying match was found.";
  }
  if (item.technologies.length > 1) {
    const unsupported = buildBundleCoverage(item).filter((entry) => entry.status === "UNSUPPORTED");
    if (unsupported.length > 0) {
      return `Partial technology bundle support. Missing direct support for ${unsupported.map((entry) => entry.technology).join(", ")}.`;
    }
  }
  if (state === "LIMITED_SUPPORT") {
    return "Some relevant evidence was retrieved, but the strongest support is still partial or qualified.";
  }
  if (state === "GOOD_SUPPORT") {
    return "Relevant evidence is present with clear overlap, but it is not the strongest possible support.";
  }
  return "Relevant professional evidence aligns directly with this requirement.";
}

function getConciseExplanation(
  state: RequirementSupportState,
  clusters: EvidenceCandidateClusterView[],
  item: RetrievedRequirementRecord
) {
  const top = clusters[0];
  if (!top) {
    return getSupportExplanation(state, item, clusters);
  }

  if (top.matchedTechnologies.length > 0) {
    return `${top.matchedTechnologies.join(", ")} appears in the strongest evidence for this requirement.`;
  }

  return top.whyMatched[0] ?? getSupportExplanation(state, item, clusters);
}

function getDefaultVisibleCount(clusters: EvidenceCandidateClusterView[]) {
  if (clusters.length <= 3) {
    return clusters.length;
  }

  const thirdScore = clusters[2]?.score;
  if (thirdScore == null) {
    return 3;
  }

  const tiedCount = clusters.filter((cluster) => cluster.score === thirdScore).length;
  if (tiedCount > 1) {
    return Math.min(5, clusters.length);
  }

  return 3;
}

function buildRequirementView(item: RetrievedRequirementRecord): EvidenceRequirementView {
  const ranked = rankCandidates(item);
  const clusters = buildClusterView(ranked);
  const supportState = getSupportState(item, clusters);
  const defaultVisibleCount = getDefaultVisibleCount(clusters);
  const bundleCoverage = buildBundleCoverage(item);

  return {
    requirementId: item.requirementId,
    title: formatRequirementTitle(item),
    categoryLabel: item.itemType === "RESPONSIBILITY" ? "Responsibility" : humanizeCode(item.category),
    supportState,
    supportStateLabel: getSupportStateLabel(supportState),
    supportExplanation: getSupportExplanation(supportState, item, clusters),
    conciseExplanation: getConciseExplanation(supportState, clusters, item),
    kinds: item.kinds.map((kind) => humanizeCode(kind)),
    technologies: item.technologies,
    primaryTechnologies: item.technologies.slice(0, 4),
    strongestEvidenceCount: clusters.filter((cluster) => cluster.restrictionCodes.length === 0).length,
    restrictedEvidenceCount: clusters.filter((cluster) => cluster.restrictionCodes.length > 0).length,
    relatedEvidenceCount: clusters.length,
    topCandidates: clusters.slice(0, defaultVisibleCount),
    remainingCandidates: clusters.slice(defaultVisibleCount),
    defaultVisibleCount,
    diagnostics: item.diagnostics.map((diagnostic) => diagnostic.message),
    bundleCoverage,
    retrievalStatusLabel: humanizeCode(item.coverageState)
  };
}

function buildSummary(requirementViews: EvidenceRequirementView[]): EvidenceSummaryView {
  const required = requirementViews.filter((item) => item.categoryLabel === "Required");
  const preferred = requirementViews.filter((item) => item.categoryLabel === "Preferred");
  const responsibilities = requirementViews.filter((item) => item.categoryLabel === "Responsibility");

  return {
    totalRequired: required.length,
    strongRequired: required.filter((item) => item.supportState === "STRONG_SUPPORT").length,
    goodRequired: required.filter((item) => item.supportState === "GOOD_SUPPORT").length,
    limitedRequired: required.filter((item) => item.supportState === "LIMITED_SUPPORT").length,
    restrictedOnlyRequired: required.filter((item) => item.supportState === "RESTRICTED_SUPPORT_ONLY").length,
    unmatchedRequired: required.filter((item) =>
      ["RELATED_EVIDENCE_ONLY", "NO_QUALIFYING_EVIDENCE"].includes(item.supportState)
    ).length,
    supportedPreferred: preferred.filter((item) =>
      ["STRONG_SUPPORT", "GOOD_SUPPORT"].includes(item.supportState)
    ).length,
    partialPreferred: preferred.filter((item) =>
      ["LIMITED_SUPPORT", "RESTRICTED_SUPPORT_ONLY", "RELATED_EVIDENCE_ONLY"].includes(item.supportState)
    ).length,
    unmatchedPreferred: preferred.filter((item) => item.supportState === "NO_QUALIFYING_EVIDENCE").length,
    responsibilityCoverageCount: responsibilities.filter((item) =>
      ["STRONG_SUPPORT", "GOOD_SUPPORT", "LIMITED_SUPPORT"].includes(item.supportState)
    ).length,
    restrictedCandidateCount: requirementViews.reduce(
      (count, item) => count + item.restrictedEvidenceCount,
      0
    ),
    retrievalStatusLabel: "Read-only retrieval summary"
  };
}

function buildOverviewItems(
  requirementViews: EvidenceRequirementView[],
  predicate: (item: EvidenceRequirementView) => boolean,
  limit: number
) {
  return requirementViews
    .filter(predicate)
    .slice(0, limit)
    .map<EvidenceOverviewItem>((item) => ({
      label: item.title,
      detail: item.conciseExplanation
    }));
}

function buildSections(viewModel: Omit<EvidencePageViewModel, "sections">): EvidenceRequirementSectionView[] {
  return [
    {
      id: "required",
      title: "Required",
      description: "Highest-priority required requirements, ranked with the strongest evidence first.",
      items: viewModel.required
    },
    {
      id: "preferred",
      title: "Preferred",
      description: "Preferred requirements with direct, related, or restricted support called out explicitly.",
      items: viewModel.preferred
    },
    {
      id: "contextual",
      title: "Contextual",
      description: "Contextual expectations and guidance from the reviewed requirement set.",
      items: viewModel.contextual
    },
    {
      id: "responsibilities",
      title: "Responsibilities",
      description: "Responsibility statements and the strongest retrieved evidence for each one.",
      items: viewModel.responsibilities
    },
    {
      id: "excluded",
      title: "Excluded",
      description: "Traceability for items intentionally kept out of downstream retrieval.",
      items: viewModel.excluded
    }
  ];
}

export function buildEvidenceRetrievalPageViewModel(
  result: EvidenceRetrievalResult
): EvidencePageViewModel {
  const requirementViews = result.requirementResults.map(buildRequirementView);
  const viewModelWithoutSections = {
    summary: buildSummary(requirementViews),
    strongestAreas: buildOverviewItems(
      requirementViews,
      (item) => ["STRONG_SUPPORT", "GOOD_SUPPORT"].includes(item.supportState),
      6
    ),
    largestGaps: buildOverviewItems(
      requirementViews,
      (item) =>
        ["RESTRICTED_SUPPORT_ONLY", "RELATED_EVIDENCE_ONLY", "NO_QUALIFYING_EVIDENCE"].includes(
          item.supportState
        ),
      6
    ),
    required: requirementViews.filter((item) => item.categoryLabel === "Required"),
    preferred: requirementViews.filter((item) => item.categoryLabel === "Preferred"),
    contextual: requirementViews.filter((item) => item.categoryLabel === "Contextual"),
    responsibilities: requirementViews.filter((item) => item.categoryLabel === "Responsibility"),
    excluded: requirementViews.filter((item) => item.supportState === "EXCLUDED"),
    technicalDetails: {
      runId: result.runId,
      careerProfileVersionId: result.careerProfileVersionId,
      requirementAnalysisId: result.requirementAnalysisId,
      retrievalEngineVersion: result.retrievalEngineVersion,
      retrievalContractVersion: result.retrievalContractVersion,
      careerSourceChecksum: result.careerSourceChecksum,
      requirementSourceChecksum: result.requirementSourceChecksum,
      inputChecksum: result.inputChecksum,
      recencyPolicyLabel: `${result.recencyPolicy.currentYears}/${result.recencyPolicy.recentYears}/${result.recencyPolicy.olderYears} year bands as of ${result.recencyPolicy.evaluatedAt}`
    }
  };

  return {
    ...viewModelWithoutSections,
    sections: buildSections(viewModelWithoutSections)
  };
}
