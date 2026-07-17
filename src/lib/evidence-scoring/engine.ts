import {
  evidenceScoringConfiguration,
  EVIDENCE_SCORING_CONFIGURATION_VERSION,
  EVIDENCE_SCORING_CONTRACT_VERSION,
  EVIDENCE_SCORING_ENGINE_VERSION
} from "@/lib/evidence-scoring/config";
import {
  evidenceScoringInputSchema,
  evidenceScoringResultSchema,
  type EvidenceCandidateStrengthBand,
  type EvidenceScoringInput,
  type RankedCandidateScore,
  type RequirementEvidenceStrengthState,
  type ScoreContribution
} from "@/lib/evidence-scoring/contract";
import type {
  CandidateEvidence,
  EvidenceDiagnostic,
  EvidenceRestriction,
  RetrievedRequirementRecord,
  RetrievalReason
} from "@/lib/evidence-retrieval/contract";

type ContributionFamily =
  | "TECHNOLOGY"
  | "EXPLICIT_RELATIONSHIP"
  | "RESPONSIBILITY"
  | "CONCEPTUAL_ALIGNMENT";

const DIRECT_REASON_CODES = new Set([
  "EXACT_TECHNOLOGY_MATCH",
  "TECHNOLOGY_ALIAS_MATCH",
  "DIRECT_EVIDENCE_REFERENCE",
  "SKILL_EVIDENCE_LINK",
  "ROLE_RESPONSIBILITY_MATCH",
  "PROJECT_RESPONSIBILITY_MATCH",
  "EDUCATION_MATCH",
  "CERTIFICATION_MATCH",
  "USER_CONFIRMED_RELATIONSHIP"
]);

const factorDefinitions: Record<
  RetrievalReason["code"],
  {
    label: string;
    ruleIdentifier: string;
    sourceRelationship: string;
    family?: ContributionFamily;
    familyCapKey?: ContributionFamily;
  }
> = {
  EXACT_TECHNOLOGY_MATCH: {
    label: "Exact technology match",
    ruleIdentifier: "factor.exact-technology",
    sourceRelationship: "technology.exact",
    family: "TECHNOLOGY",
    familyCapKey: "TECHNOLOGY"
  },
  TECHNOLOGY_ALIAS_MATCH: {
    label: "Technology alias match",
    ruleIdentifier: "factor.alias-technology",
    sourceRelationship: "technology.alias",
    family: "TECHNOLOGY",
    familyCapKey: "TECHNOLOGY"
  },
  DIRECT_EVIDENCE_REFERENCE: {
    label: "Direct evidence relationship",
    ruleIdentifier: "factor.direct-evidence-reference",
    sourceRelationship: "evidence.direct",
    family: "EXPLICIT_RELATIONSHIP",
    familyCapKey: "EXPLICIT_RELATIONSHIP"
  },
  SKILL_EVIDENCE_LINK: {
    label: "Skill evidence relationship",
    ruleIdentifier: "factor.skill-evidence-link",
    sourceRelationship: "skill.linked-evidence",
    family: "EXPLICIT_RELATIONSHIP",
    familyCapKey: "EXPLICIT_RELATIONSHIP"
  },
  ROLE_RESPONSIBILITY_MATCH: {
    label: "Professional responsibility alignment",
    ruleIdentifier: "factor.professional-responsibility",
    sourceRelationship: "responsibility.professional",
    family: "RESPONSIBILITY",
    familyCapKey: "RESPONSIBILITY"
  },
  PROJECT_RESPONSIBILITY_MATCH: {
    label: "Project responsibility alignment",
    ruleIdentifier: "factor.project-responsibility",
    sourceRelationship: "responsibility.project",
    family: "RESPONSIBILITY",
    familyCapKey: "RESPONSIBILITY"
  },
  ARCHITECTURE_CONCEPT_MATCH: {
    label: "Architecture alignment",
    ruleIdentifier: "factor.architecture",
    sourceRelationship: "concept.architecture",
    family: "CONCEPTUAL_ALIGNMENT",
    familyCapKey: "CONCEPTUAL_ALIGNMENT"
  },
  DOMAIN_MATCH: {
    label: "Domain alignment",
    ruleIdentifier: "factor.domain",
    sourceRelationship: "concept.domain",
    family: "CONCEPTUAL_ALIGNMENT",
    familyCapKey: "CONCEPTUAL_ALIGNMENT"
  },
  LEADERSHIP_MATCH: {
    label: "Leadership alignment",
    ruleIdentifier: "factor.leadership",
    sourceRelationship: "concept.leadership",
    family: "CONCEPTUAL_ALIGNMENT",
    familyCapKey: "CONCEPTUAL_ALIGNMENT"
  },
  EDUCATION_MATCH: {
    label: "Education alignment",
    ruleIdentifier: "factor.education",
    sourceRelationship: "education.match"
  },
  CERTIFICATION_MATCH: {
    label: "Certification alignment",
    ruleIdentifier: "factor.certification",
    sourceRelationship: "certification.match"
  },
  EXPERIENCE_CONTEXT_MATCH: {
    label: "Experience context alignment",
    ruleIdentifier: "factor.experience-context",
    sourceRelationship: "experience.context"
  },
  USER_CONFIRMED_RELATIONSHIP: {
    label: "User-confirmed relationship",
    ruleIdentifier: "factor.user-confirmed-relationship",
    sourceRelationship: "relationship.user-confirmed",
    family: "EXPLICIT_RELATIONSHIP",
    familyCapKey: "EXPLICIT_RELATIONSHIP"
  }
};

function pushDiagnostic(
  diagnostics: EvidenceDiagnostic[],
  diagnostic: EvidenceDiagnostic
) {
  diagnostics.push(diagnostic);
}

function makeContribution(input: ScoreContribution): ScoreContribution {
  return input;
}

function hasRequirementKind(requirement: RetrievedRequirementRecord, kind: string) {
  return requirement.kinds.includes(kind as (typeof requirement.kinds)[number]);
}

function getRequirementCategory(item: RetrievedRequirementRecord) {
  if (item.itemType === "RESPONSIBILITY") {
    return "RESPONSIBILITY";
  }

  if (item.category === "REQUIRED" || item.category === "PREFERRED" || item.category === "CONTEXTUAL") {
    return item.category;
  }

  return "CONTEXTUAL";
}

function getContextContribution(candidate: CandidateEvidence, requirement: RetrievedRequirementRecord) {
  if (candidate.context === "EDUCATION" && hasRequirementKind(requirement, "EDUCATION")) {
    return 10;
  }

  if (candidate.context === "CERTIFICATION" && hasRequirementKind(requirement, "CERTIFICATION")) {
    return 10;
  }

  return evidenceScoringConfiguration.evidenceContextWeights[candidate.context];
}

function getRecordKindContribution(candidate: CandidateEvidence) {
  if (candidate.recordKind in evidenceScoringConfiguration.recordKindWeights) {
    return evidenceScoringConfiguration.recordKindWeights[
      candidate.recordKind as keyof typeof evidenceScoringConfiguration.recordKindWeights
    ];
  }

  return 0;
}

function getConfirmationContribution(candidate: CandidateEvidence) {
  if (candidate.confirmationState in evidenceScoringConfiguration.confirmationStateWeights) {
    return evidenceScoringConfiguration.confirmationStateWeights[
      candidate.confirmationState as keyof typeof evidenceScoringConfiguration.confirmationStateWeights
    ];
  }

  return 0;
}

function getMetricContribution(candidate: CandidateEvidence) {
  if (!candidate.metric) {
    return 0;
  }

  if (
    candidate.metricVerificationState &&
    candidate.metricVerificationState in evidenceScoringConfiguration.metricWeights
  ) {
    return evidenceScoringConfiguration.metricWeights[
      candidate.metricVerificationState as keyof typeof evidenceScoringConfiguration.metricWeights
    ];
  }

  return evidenceScoringConfiguration.metricWeights.UNVERIFIED;
}

function getStrengthBand(score: number | null): EvidenceCandidateStrengthBand {
  if (score === null) {
    return "INELIGIBLE";
  }
  if (score >= evidenceScoringConfiguration.strengthBands.STRONG.minimum) {
    return "STRONG";
  }
  if (score >= evidenceScoringConfiguration.strengthBands.GOOD.minimum) {
    return "GOOD";
  }
  if (score >= evidenceScoringConfiguration.strengthBands.LIMITED.minimum) {
    return "LIMITED";
  }
  return "WEAK";
}

function getRequirementStrengthState(args: {
  requirement: RetrievedRequirementRecord;
  eligibleCandidates: RankedCandidateScore[];
  restrictedCount: number;
  ineligibleCount: number;
}): RequirementEvidenceStrengthState {
  if (args.requirement.retrievalStatus !== "ELIGIBLE") {
    return "EXCLUDED";
  }

  if (args.eligibleCandidates.length === 0) {
    return args.restrictedCount + args.ineligibleCount > 0 ? "RESTRICTED_ONLY" : "NO_EVIDENCE";
  }

  const highest = args.eligibleCandidates[0]?.finalScore ?? 0;
  const allRestricted = args.eligibleCandidates.every(
    (candidate) => candidate.restrictions.length > 0
  );
  const onlyProjectOrStale = args.eligibleCandidates.every((candidate) =>
    candidate.restrictions.some((restriction) =>
      ["PROJECT_ONLY", "STALE_SKILL"].includes(restriction.code)
    )
  );

  let state: RequirementEvidenceStrengthState =
    highest >= 75
      ? "STRONG_EVIDENCE"
      : highest >= 55
        ? "GOOD_EVIDENCE"
        : highest >= 30
          ? "LIMITED_EVIDENCE"
          : "WEAK_EVIDENCE";

  if ((allRestricted || onlyProjectOrStale) && state === "STRONG_EVIDENCE") {
    state = "LIMITED_EVIDENCE";
  } else if ((allRestricted || onlyProjectOrStale) && state === "GOOD_EVIDENCE") {
    state = "LIMITED_EVIDENCE";
  }

  return state;
}

function mergeReasons(reasons: RetrievalReason[]) {
  const seen = new Set<string>();
  const merged: RetrievalReason[] = [];

  for (const reason of reasons) {
    const key = `${reason.code}:${reason.matchingRule}:${reason.sourceRequirementConcept ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(reason);
    }
  }

  return merged.sort((left, right) =>
    `${left.code}:${left.matchingRule}`.localeCompare(`${right.code}:${right.matchingRule}`)
  );
}

function mergeRestrictions(restrictions: EvidenceRestriction[]) {
  const map = new Map<string, EvidenceRestriction>();
  for (const restriction of restrictions) {
    map.set(restriction.code, restriction);
  }
  return [...map.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function mergeCandidates(
  candidates: CandidateEvidence[],
  diagnostics: EvidenceDiagnostic[],
  requirementId: string
) {
  const merged = new Map<string, CandidateEvidence>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.candidateId);
    if (!existing) {
      merged.set(candidate.candidateId, candidate);
      continue;
    }

    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "DUPLICATE_CANDIDATE_MERGED",
      message: "Duplicate candidate evidence was merged before scoring.",
      relatedRequirementId: requirementId,
      relatedCandidateId: candidate.candidateId
    });

    merged.set(candidate.candidateId, {
      ...existing,
      retrievalReasons: mergeReasons([...existing.retrievalReasons, ...candidate.retrievalReasons]),
      restrictions: mergeRestrictions([...existing.restrictions, ...candidate.restrictions]),
      matchedRequirementKinds: [...new Set([...existing.matchedRequirementKinds, ...candidate.matchedRequirementKinds])].sort(),
      matchedTechnologies: [...new Set([...existing.matchedTechnologies, ...candidate.matchedTechnologies])].sort()
    });
  }

  return [...merged.values()];
}

function isIneligible(candidate: CandidateEvidence) {
  return (
    candidate.eligibility === "INELIGIBLE" ||
    candidate.recordKind === "AI_SUGGESTION" ||
    candidate.restrictions.some((restriction) => restriction.code === "AI_SUGGESTION")
  );
}

function hasVerifiedMetric(candidate: CandidateEvidence) {
  return ["VERIFIED", "PROJECT_VERIFIED", "USER_CONFIRMED"].includes(
    candidate.metricVerificationState ?? ""
  );
}

function getRecencySortValue(recency: CandidateEvidence["recency"]) {
  return {
    CURRENT: 5,
    RECENT: 4,
    OLDER: 3,
    UNKNOWN: 2,
    STALE: 1
  }[recency];
}

function getDirectRelationshipStrength(reasons: RetrievalReason[]) {
  let strength = 0;

  for (const reason of reasons) {
    if (reason.code === "DIRECT_EVIDENCE_REFERENCE") {
      strength = Math.max(strength, 5);
    } else if (reason.code === "SKILL_EVIDENCE_LINK" || reason.code === "USER_CONFIRMED_RELATIONSHIP") {
      strength = Math.max(strength, 4);
    } else if (reason.code === "EXACT_TECHNOLOGY_MATCH") {
      strength = Math.max(strength, 3);
    } else if (reason.code === "TECHNOLOGY_ALIAS_MATCH") {
      strength = Math.max(strength, 2);
    } else if (DIRECT_REASON_CODES.has(reason.code)) {
      strength = Math.max(strength, 1);
    }
  }

  return strength;
}

function scoreCandidate(
  requirement: RetrievedRequirementRecord,
  candidate: CandidateEvidence,
  diagnostics: EvidenceDiagnostic[]
): RankedCandidateScore {
  const factorContributions: ScoreContribution[] = [];
  const penaltyContributions: ScoreContribution[] = [];
  const exclusionReasons: string[] = [];

  for (const restriction of mergeRestrictions(candidate.restrictions)) {
    const weight =
      evidenceScoringConfiguration.penaltyWeights[
        restriction.code as keyof typeof evidenceScoringConfiguration.penaltyWeights
      ];
    if (typeof weight !== "number") {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "UNKNOWN_RESTRICTION_CODE",
        message: `Unknown restriction code ${restriction.code} was preserved but not scored.`,
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: candidate.candidateId
      });
      continue;
    }

    penaltyContributions.push(
      makeContribution({
        factorCode: restriction.code,
        label: restriction.code.replace(/_/g, " "),
        value: weight,
        explanation: restriction.explanation,
        sourceRelationship: "candidate.restrictions",
        configurationWeight: weight,
        capped: false,
        ruleIdentifier: `penalty.${restriction.code.toLowerCase()}`
      })
    );
  }

  if (isIneligible(candidate)) {
    exclusionReasons.push("Candidate is ineligible for primary scoring.");
    return {
      ...candidate,
      visibleForDiagnostics: true,
      exclusionReasons,
      finalScore: null,
      unclampedScore: null,
      strengthBand: "INELIGIBLE",
      rank: null,
      directRelationshipStrength: getDirectRelationshipStrength(candidate.retrievalReasons),
      factorContributions,
      penaltyContributions
    };
  }

  const familyApplied = new Set<ContributionFamily>();
  const familyCapped = new Set<ContributionFamily>();

  for (const reason of mergeReasons(candidate.retrievalReasons)) {
    const definition = factorDefinitions[reason.code];
    if (!definition) {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "UNKNOWN_RETRIEVAL_REASON",
        message: `Unknown retrieval reason ${reason.code} could not be mapped to a scoring factor.`,
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: candidate.candidateId
      });
      continue;
    }

    const weight = evidenceScoringConfiguration.factorWeights[reason.code] ?? 0;
    if (definition.family && familyApplied.has(definition.family)) {
      familyCapped.add(definition.family);
      continue;
    }

    familyApplied.add(definition.family ?? "CONCEPTUAL_ALIGNMENT");
    factorContributions.push(
      makeContribution({
        factorCode: reason.code,
        label: definition.label,
        value: weight,
        explanation: reason.explanation,
        sourceRelationship: definition.sourceRelationship,
        configurationWeight: weight,
        capped: false,
        ruleIdentifier: definition.ruleIdentifier
      })
    );
  }

  if (
    candidate.technologies.some((technology) =>
      ["aws", "azure", "gcp", "platform", "kubernetes", "docker"].includes(technology.toLowerCase())
    ) &&
    requirement.kinds.some((kind) => ["TECHNOLOGY", "ARCHITECTURE", "RESPONSIBILITY"].includes(kind))
  ) {
    factorContributions.push(
      makeContribution({
        factorCode: "CLOUD_PLATFORM_ALIGNMENT",
        label: "Cloud or platform alignment",
        value: evidenceScoringConfiguration.factorWeights.CLOUD_PLATFORM_ALIGNMENT,
        explanation: "Candidate evidence includes explicit cloud or platform technologies.",
        sourceRelationship: "technology.cloud-platform",
        configurationWeight: evidenceScoringConfiguration.factorWeights.CLOUD_PLATFORM_ALIGNMENT,
        capped: false,
        ruleIdentifier: "factor.cloud-platform"
      })
    );
  }

  const contextWeight = getContextContribution(candidate, requirement);
  if (contextWeight !== 0) {
    factorContributions.push(
      makeContribution({
        factorCode: `CONTEXT_${candidate.context}`,
        label: `${candidate.context} context`,
        value: contextWeight,
        explanation: "Evidence context contributes to relevance without overriding direct relevance.",
        sourceRelationship: "candidate.context",
        configurationWeight: contextWeight,
        capped: false,
        ruleIdentifier: "factor.context"
      })
    );
  }

  const recencyWeight = evidenceScoringConfiguration.recencyWeights[candidate.recency];
  if (recencyWeight !== 0) {
    const target = recencyWeight > 0 ? factorContributions : penaltyContributions;
    target.push(
      makeContribution({
        factorCode: `RECENCY_${candidate.recency}`,
        label: `${candidate.recency} recency`,
        value: recencyWeight,
        explanation: "Recency comes directly from the retrieval run metadata.",
        sourceRelationship: "candidate.recency",
        configurationWeight: recencyWeight,
        capped: false,
        ruleIdentifier: "factor.recency"
      })
    );
  }

  const recordKindWeight = getRecordKindContribution(candidate);
  if (recordKindWeight !== 0) {
    factorContributions.push(
      makeContribution({
        factorCode: `RECORD_KIND_${candidate.recordKind}`,
        label: `${candidate.recordKind.replace(/_/g, " ")} source`,
        value: recordKindWeight,
        explanation: "Source and user-confirmed records receive a deterministic trust boost.",
        sourceRelationship: "candidate.recordKind",
        configurationWeight: recordKindWeight,
        capped: false,
        ruleIdentifier: "factor.record-kind"
      })
    );
  }

  const confirmationWeight = getConfirmationContribution(candidate);
  if (confirmationWeight !== 0) {
    factorContributions.push(
      makeContribution({
        factorCode: `CONFIRMATION_${candidate.confirmationState}`,
        label: `${candidate.confirmationState.replace(/_/g, " ")} confirmation`,
        value: confirmationWeight,
        explanation: "Confirmation state increases confidence in using the evidence as a claim.",
        sourceRelationship: "candidate.confirmationState",
        configurationWeight: confirmationWeight,
        capped: false,
        ruleIdentifier: "factor.confirmation-state"
      })
    );
  }

  const metricWeight = getMetricContribution(candidate);
  if (metricWeight !== 0) {
    factorContributions.push(
      makeContribution({
        factorCode: hasVerifiedMetric(candidate) ? "VERIFIED_METRIC" : "UNVERIFIED_METRIC",
        label: hasVerifiedMetric(candidate) ? "Verified metric" : "Unverified metric",
        value: metricWeight,
        explanation: "Metrics strengthen evidence only when attached to the candidate record.",
        sourceRelationship: "candidate.metric",
        configurationWeight: metricWeight,
        capped: false,
        ruleIdentifier: "factor.metric"
      })
    );
  }

  if (familyCapped.size > 0) {
    penaltyContributions.push(
      makeContribution({
        factorCode: "FACTOR_FAMILY_CAP",
        label: "Factor-family cap",
        value: evidenceScoringConfiguration.penaltyWeights.FACTOR_FAMILY_CAP,
        explanation: "Overlapping factor families were capped to prevent score inflation.",
        sourceRelationship: "candidate.retrievalReasons",
        configurationWeight: evidenceScoringConfiguration.penaltyWeights.FACTOR_FAMILY_CAP,
        capped: true,
        ruleIdentifier: "penalty.factor-family-cap"
      })
    );
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "FACTOR_FAMILY_CAP_APPLIED",
      message: "A factor-family cap prevented overlapping retrieval reasons from over-scoring this candidate.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  const hasDirectLink = candidate.retrievalReasons.some((reason) => DIRECT_REASON_CODES.has(reason.code));
  if (!hasDirectLink) {
    penaltyContributions.push(
      makeContribution({
        factorCode: "NO_DIRECT_REQUIREMENT_LINK",
        label: "Indirect relationship only",
        value: evidenceScoringConfiguration.penaltyWeights.NO_DIRECT_REQUIREMENT_LINK,
        explanation: "Candidate relevance depends on indirect overlap rather than a direct relationship.",
        sourceRelationship: "candidate.retrievalReasons",
        configurationWeight: evidenceScoringConfiguration.penaltyWeights.NO_DIRECT_REQUIREMENT_LINK,
        capped: false,
        ruleIdentifier: "penalty.no-direct-link"
      })
    );
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "INDIRECT_ONLY_CANDIDATE",
      message: "Candidate score depends only on indirect relationship evidence.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  if (
    candidate.dateMetadata.lastUsedDate === null &&
    candidate.dateMetadata.endDate === null &&
    candidate.dateMetadata.startDate === null
  ) {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "MISSING_RECENCY_METADATA",
      message: "Candidate score used a conservative recency treatment because date metadata is missing.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  if (!candidate.confirmationState) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "MISSING_CONFIRMATION_STATE",
      message: "Candidate confirmation state is missing.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  const requirementImportance = evidenceScoringConfiguration.requirementImportance[
    getRequirementCategory(requirement)
  ];
  const positiveSubtotal = factorContributions.reduce((sum, item) => sum + item.value, 0);
  const penaltySubtotal = penaltyContributions.reduce((sum, item) => sum + item.value, 0);
  const weightedRaw = Math.round(positiveSubtotal * requirementImportance + penaltySubtotal);
  const finalScore = Math.min(
    evidenceScoringConfiguration.scoreBounds.maximum,
    Math.max(evidenceScoringConfiguration.scoreBounds.minimum, weightedRaw)
  );

  if (positiveSubtotal === 0) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "CANDIDATE_HAS_NO_SCORING_FACTORS",
      message: "Candidate has no positive scoring factors and was scored only through penalties or defaults.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  if (weightedRaw > evidenceScoringConfiguration.scoreBounds.maximum) {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "SCORE_CLAMPED_AT_MAXIMUM",
      message: "Candidate score exceeded the configured maximum and was clamped.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  } else if (weightedRaw < evidenceScoringConfiguration.scoreBounds.minimum) {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "SCORE_CLAMPED_AT_MINIMUM",
      message: "Candidate score fell below zero and was clamped to zero.",
      relatedRequirementId: requirement.requirementId,
      relatedCandidateId: candidate.candidateId
    });
  }

  return {
    ...candidate,
    visibleForDiagnostics: true,
    exclusionReasons,
    finalScore,
    unclampedScore: weightedRaw,
    strengthBand: getStrengthBand(finalScore),
    rank: null,
    directRelationshipStrength: getDirectRelationshipStrength(candidate.retrievalReasons),
    factorContributions,
    penaltyContributions
  };
}

function sortCandidates(candidates: RankedCandidateScore[]) {
  return [...candidates].sort((left, right) => {
    const leftEligible = left.finalScore !== null ? 1 : 0;
    const rightEligible = right.finalScore !== null ? 1 : 0;
    if (leftEligible !== rightEligible) {
      return rightEligible - leftEligible;
    }

    if ((right.finalScore ?? -1) !== (left.finalScore ?? -1)) {
      return (right.finalScore ?? -1) - (left.finalScore ?? -1);
    }

    if (right.directRelationshipStrength !== left.directRelationshipStrength) {
      return right.directRelationshipStrength - left.directRelationshipStrength;
    }

    if (left.context !== right.context) {
      if (left.context === "PROFESSIONAL") {
        return -1;
      }
      if (right.context === "PROFESSIONAL") {
        return 1;
      }
    }

    if (getRecencySortValue(left.recency) !== getRecencySortValue(right.recency)) {
      return getRecencySortValue(right.recency) - getRecencySortValue(left.recency);
    }

    if (hasVerifiedMetric(left) !== hasVerifiedMetric(right)) {
      return hasVerifiedMetric(right) ? 1 : -1;
    }

    return left.candidateId.localeCompare(right.candidateId);
  });
}

export function buildEvidenceScoringResult(input: EvidenceScoringInput) {
  const parsed = evidenceScoringInputSchema.parse(input);
  const diagnostics: EvidenceDiagnostic[] = [];

  if (parsed.retrievalResult.status === "FAILED" || parsed.retrievalResult.status === "PENDING") {
    throw new Error("Only successful evidence retrieval runs can be scored.");
  }

  for (const requirement of parsed.retrievalResult.requirementResults) {
    if (requirement.retrievalStatus !== "ELIGIBLE") {
      pushDiagnostic(diagnostics, {
        severity: "INFO",
        code: "REQUIREMENT_EXCLUDED_FROM_SCORING",
        message: "Requirement was excluded from primary scoring because retrieval marked it as non-eligible.",
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: null
      });
    }
  }

  const requirementScores = parsed.retrievalResult.requirementResults
    .filter((requirement) => requirement.retrievalStatus === "ELIGIBLE")
    .map((requirement) => {
      const itemDiagnostics: EvidenceDiagnostic[] = [];

      const mergedCandidates = mergeCandidates(
        [...requirement.candidateEvidence, ...requirement.excludedEvidence],
        itemDiagnostics,
        requirement.requirementId
      );
      const scoredCandidates = sortCandidates(
        mergedCandidates.map((candidate) => scoreCandidate(requirement, candidate, itemDiagnostics))
      );

      const rankedCandidates = scoredCandidates.map((candidate, index) => ({
        ...candidate,
        rank: candidate.finalScore === null ? null : index + 1
      }));

      const eligibleCandidates = rankedCandidates.filter((candidate) => candidate.finalScore !== null);
      const restrictedCount = rankedCandidates.filter(
        (candidate) => candidate.finalScore !== null && candidate.restrictions.length > 0
      ).length;
      const ineligibleCount = rankedCandidates.filter((candidate) => candidate.finalScore === null).length;

      const evidenceStrengthState = getRequirementStrengthState({
        requirement,
        eligibleCandidates,
        restrictedCount,
        ineligibleCount
      });

      if (requirement.itemType === "REQUIREMENT" && requirement.category === "REQUIRED") {
        if (eligibleCandidates.length === 0) {
          pushDiagnostic(itemDiagnostics, {
            severity: "WARNING",
            code: "REQUIRED_REQUIREMENT_HAS_NO_ELIGIBLE_EVIDENCE",
            message: "Required requirement has no eligible evidence after scoring.",
            relatedRequirementId: requirement.requirementId,
            relatedCandidateId: null
          });
        } else if (
          eligibleCandidates.every((candidate) =>
            candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
          )
        ) {
          pushDiagnostic(itemDiagnostics, {
            severity: "INFO",
            code: "REQUIRED_REQUIREMENT_ONLY_PROJECT_EVIDENCE",
            message: "Required requirement is supported only by project-context evidence.",
            relatedRequirementId: requirement.requirementId,
            relatedCandidateId: null
          });
        } else if (
          eligibleCandidates.every((candidate) =>
            candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL")
          )
        ) {
          pushDiagnostic(itemDiagnostics, {
            severity: "INFO",
            code: "REQUIRED_REQUIREMENT_ONLY_STALE_EVIDENCE",
            message: "Required requirement is supported only by stale evidence.",
            relatedRequirementId: requirement.requirementId,
            relatedCandidateId: null
          });
        }
      }

      if (
        requirement.kinds.includes("CERTIFICATION") &&
        rankedCandidates.some((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "EXPIRED_CERTIFICATION")
        )
      ) {
        pushDiagnostic(itemDiagnostics, {
          severity: "WARNING",
          code: "CURRENT_CERTIFICATION_ONLY_EXPIRED_EVIDENCE",
          message: "Certification evidence exists, but it is expired or otherwise restricted.",
          relatedRequirementId: requirement.requirementId,
          relatedCandidateId: null
        });
      }

      diagnostics.push(...itemDiagnostics);

      return {
        requirementId: requirement.requirementId,
        itemType: requirement.itemType,
        category: getRequirementCategory(requirement),
        requirementImportance:
          evidenceScoringConfiguration.requirementImportance[getRequirementCategory(requirement)],
        kinds: requirement.kinds,
        originalText: requirement.originalText,
        correctedDisplayText: requirement.correctedDisplayText,
        evidenceStrengthState,
        highestCandidateScore: eligibleCandidates[0]?.finalScore ?? null,
        eligibleCandidateCount: eligibleCandidates.length,
        restrictedCandidateCount: restrictedCount,
        ineligibleCandidateCount: ineligibleCount,
        rankedCandidates,
        diagnostics: itemDiagnostics
      };
    });

  const eligibleCandidateScores = requirementScores.flatMap((requirement) =>
    requirement.rankedCandidates
      .map((candidate) => candidate.finalScore)
      .filter((value): value is number => value !== null)
  );

  const summary = {
    requirementsScored: requirementScores.filter((item) => item.category !== "RESPONSIBILITY" || item.itemType === "RESPONSIBILITY").length,
    requiredStrongEvidenceCount: requirementScores.filter(
      (item) => item.category === "REQUIRED" && item.evidenceStrengthState === "STRONG_EVIDENCE"
    ).length,
    requiredGoodEvidenceCount: requirementScores.filter(
      (item) => item.category === "REQUIRED" && item.evidenceStrengthState === "GOOD_EVIDENCE"
    ).length,
    requiredLimitedOrWeakEvidenceCount: requirementScores.filter(
      (item) =>
        item.category === "REQUIRED" &&
        ["LIMITED_EVIDENCE", "WEAK_EVIDENCE"].includes(item.evidenceStrengthState)
    ).length,
    requiredNoEvidenceCount: requirementScores.filter(
      (item) =>
        item.category === "REQUIRED" &&
        ["NO_EVIDENCE", "RESTRICTED_ONLY"].includes(item.evidenceStrengthState)
    ).length,
    preferredStrongOrGoodEvidenceCount: requirementScores.filter(
      (item) =>
        item.category === "PREFERRED" &&
        ["STRONG_EVIDENCE", "GOOD_EVIDENCE"].includes(item.evidenceStrengthState)
    ).length,
    restrictedOnlyRequirementCount: requirementScores.filter(
      (item) => item.evidenceStrengthState === "RESTRICTED_ONLY"
    ).length,
    noEvidenceRequirementCount: requirementScores.filter(
      (item) => item.evidenceStrengthState === "NO_EVIDENCE"
    ).length,
    averageEligibleCandidateScore:
      eligibleCandidateScores.length > 0
        ? Math.round(
            (eligibleCandidateScores.reduce((sum, value) => sum + value, 0) /
              eligibleCandidateScores.length) *
              10
          ) / 10
        : null,
    diagnosticErrorCount: diagnostics.filter((item) => item.severity === "ERROR").length,
    diagnosticWarningCount: diagnostics.filter((item) => item.severity === "WARNING").length,
    diagnosticInfoCount: diagnostics.filter((item) => item.severity === "INFO").length
  };

  const status =
    summary.diagnosticErrorCount > 0
      ? "FAILED"
      : summary.diagnosticWarningCount > 0
        ? "SUCCESS_WITH_WARNINGS"
        : "SUCCESS";

  return evidenceScoringResultSchema.parse({
    runId: parsed.runId,
    workspaceId: parsed.workspaceId,
    evidenceRetrievalRunId: parsed.evidenceRetrievalRunId,
    evidenceRetrievalInputChecksum: parsed.retrievalResult.inputChecksum,
    careerProfileVersionId: parsed.retrievalResult.careerProfileVersionId,
    requirementAnalysisId: parsed.retrievalResult.requirementAnalysisId,
    jobDescriptionVersionId: parsed.retrievalResult.jobDescriptionVersionId,
    applicationId: parsed.retrievalResult.applicationId,
    retrievalContractVersion: parsed.retrievalResult.retrievalContractVersion,
    scoringContractVersion: EVIDENCE_SCORING_CONTRACT_VERSION,
    scoringEngineVersion: EVIDENCE_SCORING_ENGINE_VERSION,
    scoringConfigurationVersion: EVIDENCE_SCORING_CONFIGURATION_VERSION,
    inputChecksum: parsed.inputChecksum,
    createdAt: parsed.createdAt,
    status,
    retrievalStatus: parsed.retrievalResult.status,
    diagnostics,
    summary,
    scoringConfiguration: evidenceScoringConfiguration,
    requirementScores
  });
}
