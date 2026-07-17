import {
  MATCH_REPORT_CONFIGURATION_VERSION,
  MATCH_REPORT_CONTRACT_VERSION,
  MATCH_REPORT_ENGINE_VERSION,
  matchReportConfiguration
} from "@/lib/match-report/config";
import {
  matchReportInputSchema,
  matchReportResultSchema,
  type ConclusionCode,
  type Criticality,
  type GapType,
  type MatchReportInput,
  type MatchTier,
  type PursuitRecommendation,
  type ResumeReadinessState
} from "@/lib/match-report/contract";
import type { EvidenceDiagnostic } from "@/lib/evidence-retrieval/contract";
import type {
  RankedCandidateScore,
  ScoredRequirementRecord
} from "@/lib/evidence-scoring/contract";

const CENTRAL_TECHNOLOGY_HINTS = new Set(["typescript", "javascript", "python", "postgresql", "aws", "react", "node.js", "node", "sql"]);

function pushDiagnostic(diagnostics: EvidenceDiagnostic[], diagnostic: EvidenceDiagnostic) {
  diagnostics.push(diagnostic);
}

function stableId(prefix: string, values: string[]) {
  return `${prefix}:${values.join(":").toLowerCase().replace(/[^a-z0-9:_-]+/g, "-")}`;
}

function isProfessional(candidate: RankedCandidateScore) {
  return candidate.context === "PROFESSIONAL";
}

function isProject(candidate: RankedCandidateScore) {
  return candidate.context === "PROJECT";
}

function isStale(candidate: RankedCandidateScore) {
  return (
    candidate.recency === "STALE" ||
    candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL")
  );
}

function topCandidates(candidates: RankedCandidateScore[]) {
  return candidates.slice(0, matchReportConfiguration.topCandidatesPerRequirement);
}

function centralTechnologyCounts(requirements: ScoredRequirementRecord[]) {
  const counts = new Map<string, number>();
  for (const requirement of requirements) {
    if (requirement.category !== "REQUIRED") {
      continue;
    }
    for (const candidate of requirement.rankedCandidates) {
      for (const tech of candidate.matchedTechnologies) {
        const key = tech.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function hasExplicitMandatoryWording(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("required") ||
    normalized.includes("must") ||
    normalized.includes("minimum") ||
    normalized.includes("clearance") ||
    normalized.includes("work authorization")
  );
}

function inferGapTypes(requirement: ScoredRequirementRecord): GapType[] {
  const gapTypes = new Set<GapType>();
  const lowerText = `${requirement.originalText} ${requirement.correctedDisplayText ?? ""}`.toLowerCase();
  const eligible = requirement.rankedCandidates.filter((candidate) => candidate.finalScore !== null);
  const top = eligible[0];

  if (requirement.evidenceStrengthState === "NO_EVIDENCE") {
    gapTypes.add("NO_EVIDENCE");
  }
  if (requirement.evidenceStrengthState === "WEAK_EVIDENCE") {
    gapTypes.add("WEAK_EVIDENCE");
  }
  if (requirement.evidenceStrengthState === "RESTRICTED_ONLY") {
    gapTypes.add("RESTRICTED_ONLY");
  }
  if (top && top.retrievalReasons.length > 0 && top.directRelationshipStrength <= 1) {
    gapTypes.add("INDIRECT_EVIDENCE_ONLY");
  }
  if (eligible.length > 0 && eligible.every((candidate) => isProject(candidate))) {
    gapTypes.add("PROJECT_ONLY");
  }
  if (eligible.length > 0 && eligible.every((candidate) => isStale(candidate))) {
    gapTypes.add("STALE_EVIDENCE");
  }
  if (requirement.kinds.includes("CERTIFICATION")) {
    const expired = requirement.rankedCandidates.some((candidate) =>
      candidate.restrictions.some((restriction) => restriction.code === "EXPIRED_CERTIFICATION")
    );
    if (expired) {
      gapTypes.add("EXPIRED_CERTIFICATION");
      if (lowerText.includes("active") || lowerText.includes("current")) {
        gapTypes.add("MISSING_CURRENT_CERTIFICATION");
      }
    }
  }
  if (requirement.kinds.includes("EDUCATION") && requirement.evidenceStrengthState === "NO_EVIDENCE") {
    gapTypes.add("MISSING_EDUCATION");
  }
  if (lowerText.includes("clearance") && requirement.evidenceStrengthState !== "STRONG_EVIDENCE") {
    gapTypes.add("MISSING_CLEARANCE");
  }
  if (lowerText.includes("work authorization") || lowerText.includes("authorized to work")) {
    gapTypes.add("MISSING_WORK_AUTHORIZATION");
  }
  if (
    (lowerText.includes("current") || lowerText.includes("recent")) &&
    (requirement.evidenceStrengthState === "LIMITED_EVIDENCE" ||
      requirement.evidenceStrengthState === "WEAK_EVIDENCE" ||
      requirement.evidenceStrengthState === "NO_EVIDENCE")
  ) {
    gapTypes.add("MISSING_RECENT_EXPERIENCE");
  }

  if (gapTypes.size === 0) {
    gapTypes.add("NONE");
  }

  return [...gapTypes];
}

function inferCriticality(
  requirement: ScoredRequirementRecord,
  gapTypes: GapType[],
  technologyCounts: Map<string, number>
): Criticality {
  if (gapTypes.includes("NONE")) {
    return "NONE";
  }

  const lowerText = `${requirement.originalText} ${requirement.correctedDisplayText ?? ""}`.toLowerCase();
  const hasCentralTech = requirement.rankedCandidates.some((candidate) =>
    candidate.matchedTechnologies.some((tech) => {
      const key = tech.toLowerCase();
      return (technologyCounts.get(key) ?? 0) > 1 || CENTRAL_TECHNOLOGY_HINTS.has(key);
    })
  );

  if (
    requirement.category === "REQUIRED" &&
    (gapTypes.includes("MISSING_WORK_AUTHORIZATION") ||
      gapTypes.includes("MISSING_CLEARANCE") ||
      gapTypes.includes("MISSING_CURRENT_CERTIFICATION") ||
      (hasExplicitMandatoryWording(lowerText) && gapTypes.includes("NO_EVIDENCE")) ||
      (hasCentralTech && gapTypes.includes("NO_EVIDENCE")))
  ) {
    return "CRITICAL";
  }

  if (
    requirement.category === "REQUIRED" &&
    (gapTypes.includes("RESTRICTED_ONLY") ||
      gapTypes.includes("PROJECT_ONLY") ||
      gapTypes.includes("STALE_EVIDENCE") ||
      gapTypes.includes("WEAK_EVIDENCE") ||
      gapTypes.includes("MISSING_EDUCATION"))
  ) {
    return "MATERIAL";
  }

  return requirement.category === "REQUIRED" ? "MATERIAL" : "MINOR";
}

function getConclusionCode(requirement: ScoredRequirementRecord, gapTypes: GapType[], criticality: Criticality): ConclusionCode {
  if (criticality === "CRITICAL") {
    return "CRITICAL_GAP";
  }
  if (criticality === "MATERIAL" && requirement.category === "REQUIRED") {
    return "MATERIAL_GAP";
  }
  if (gapTypes.includes("PROJECT_ONLY")) {
    return "PROJECT_SUPPORTED";
  }
  if (gapTypes.includes("RESTRICTED_ONLY")) {
    return "RESTRICTED_SUPPORT";
  }
  if (gapTypes.includes("STALE_EVIDENCE")) {
    return "STALE_SUPPORT";
  }
  switch (requirement.evidenceStrengthState) {
    case "STRONG_EVIDENCE":
      return requirement.category === "REQUIRED" ? "CORE_STRENGTH" : "SUPPORTED_REQUIREMENT";
    case "GOOD_EVIDENCE":
      return "SUPPORTED_REQUIREMENT";
    case "LIMITED_EVIDENCE":
      return "LIMITED_SUPPORT";
    case "WEAK_EVIDENCE":
    case "NO_EVIDENCE":
      return requirement.category === "REQUIRED" ? "NO_SUPPORT" : "OPTIONAL_GAP";
    default:
      return "CONTEXT_ONLY";
  }
}

function explanationForRequirement(
  requirement: ScoredRequirementRecord,
  gapTypes: GapType[],
  top: RankedCandidateScore | undefined
) {
  if (gapTypes.includes("NO_EVIDENCE")) {
    return "No usable evidence was found for this requirement.";
  }
  if (gapTypes.includes("RESTRICTED_ONLY")) {
    return "Only restricted or ineligible evidence is available for this requirement.";
  }
  if (gapTypes.includes("PROJECT_ONLY")) {
    return "Only project-based evidence currently supports this requirement.";
  }
  if (gapTypes.includes("STALE_EVIDENCE")) {
    return "Available evidence is older or stale and should be qualified carefully.";
  }
  if (top) {
    return `Top support comes from ${top.displayTitle} with ${top.strengthBand.toLowerCase()} evidence.`;
  }
  return `This ${requirement.category.toLowerCase()} requirement has limited support.`;
}

function resumeGuidanceForRequirement(gapTypes: GapType[], strengthState: ScoredRequirementRecord["evidenceStrengthState"]) {
  if (gapTypes.includes("NO_EVIDENCE")) {
    return "Do not claim this requirement in a targeted resume.";
  }
  if (gapTypes.includes("RESTRICTED_ONLY")) {
    return "Avoid presenting this as supported current evidence without clear qualification.";
  }
  if (gapTypes.includes("PROJECT_ONLY")) {
    return "If used, label it clearly as project evidence rather than professional evidence.";
  }
  if (gapTypes.includes("STALE_EVIDENCE")) {
    return "Qualify this evidence as older experience instead of current experience.";
  }
  if (strengthState === "STRONG_EVIDENCE" || strengthState === "GOOD_EVIDENCE") {
    return "Safe to prioritize this in targeted resume composition.";
  }
  return "Usable only with careful qualification and factual restraint.";
}

function topStrengthLabel(requirement: ScoredRequirementRecord) {
  const technologies = [...new Set(requirement.rankedCandidates.flatMap((candidate) => candidate.matchedTechnologies))];
  if (technologies.length > 0) {
    return technologies[0];
  }
  if (requirement.kinds.includes("ARCHITECTURE")) {
    return "Architecture and system design";
  }
  if (requirement.kinds.includes("LEADERSHIP")) {
    return "Technical leadership";
  }
  if (requirement.kinds.includes("DOMAIN")) {
    return "Domain experience";
  }
  return requirement.correctedDisplayText ?? requirement.originalText;
}

function inferMatchTier(args: {
  alignmentIndex: number | null;
  requiredNoEvidenceCount: number;
  criticalRequiredGapCount: number;
  materialRequiredGapCount: number;
}): MatchTier {
  if (args.alignmentIndex === null) {
    return "INSUFFICIENT_EVIDENCE";
  }
  let tier: MatchTier =
    args.alignmentIndex >= matchReportConfiguration.matchTierThresholds.STRONG_ALIGNMENT
      ? "STRONG_ALIGNMENT"
      : args.alignmentIndex >= matchReportConfiguration.matchTierThresholds.GOOD_ALIGNMENT
        ? "GOOD_ALIGNMENT"
        : args.alignmentIndex >= matchReportConfiguration.matchTierThresholds.PARTIAL_ALIGNMENT
          ? "PARTIAL_ALIGNMENT"
          : args.alignmentIndex >= matchReportConfiguration.matchTierThresholds.WEAK_ALIGNMENT
            ? "WEAK_ALIGNMENT"
            : "INSUFFICIENT_EVIDENCE";

  if (args.criticalRequiredGapCount > 1) {
    tier = "WEAK_ALIGNMENT";
  } else if (args.criticalRequiredGapCount === 1 && tier === "STRONG_ALIGNMENT") {
    tier = "PARTIAL_ALIGNMENT";
  } else if (args.requiredNoEvidenceCount > 0 && tier === "STRONG_ALIGNMENT") {
    tier = "GOOD_ALIGNMENT";
  }

  if (args.materialRequiredGapCount > 2 && tier === "GOOD_ALIGNMENT") {
    tier = "PARTIAL_ALIGNMENT";
  }

  return tier;
}

function inferPursuitRecommendation(
  matchTier: MatchTier,
  resumeReadinessState: ResumeReadinessState,
  criticalGapCount: number
): PursuitRecommendation {
  if (resumeReadinessState === "NOT_READY" || resumeReadinessState === "NEEDS_REVIEW") {
    return "DO_NOT_RECOMMEND_YET";
  }
  if (matchTier === "STRONG_ALIGNMENT" && criticalGapCount === 0) {
    return "PRIORITIZE";
  }
  if (matchTier === "GOOD_ALIGNMENT") {
    return "APPLY";
  }
  if (matchTier === "PARTIAL_ALIGNMENT") {
    return "CONSIDER";
  }
  return "LOW_PRIORITY";
}

function inferResumeReadiness(
  matchTier: MatchTier,
  criticalGapCount: number,
  materialGapCount: number,
  diagnostics: EvidenceDiagnostic[]
): ResumeReadinessState {
  if (matchTier === "INSUFFICIENT_EVIDENCE") {
    return "NOT_READY";
  }
  if (criticalGapCount > 0) {
    return "NOT_READY";
  }
  if (materialGapCount > matchReportConfiguration.resumeReadiness.readyWithLimitationsMaxMaterialGaps) {
    return "READY_WITH_LIMITATIONS";
  }
  if (diagnostics.some((item) => item.code.includes("LIMITED"))) {
    return "READY_WITH_LIMITATIONS";
  }
  return matchTier === "STRONG_ALIGNMENT" || matchTier === "GOOD_ALIGNMENT"
    ? "READY"
    : "READY_WITH_LIMITATIONS";
}

export function buildMatchReportResult(input: MatchReportInput) {
  const parsed = matchReportInputSchema.parse(input);
  const diagnostics: EvidenceDiagnostic[] = [];

  if (parsed.scoringResult.status === "FAILED" || parsed.scoringResult.status === "PENDING") {
    throw new Error("Only successful evidence scoring runs can generate match reports.");
  }

  const technologyCounts = centralTechnologyCounts(parsed.scoringResult.requirementScores);
  const requirementConclusions = parsed.scoringResult.requirementScores.map((requirement) => {
    const rankedCandidates = topCandidates(requirement.rankedCandidates);
    const gapTypes = inferGapTypes(requirement);
    const criticality = inferCriticality(requirement, gapTypes, technologyCounts);
    const conclusionCode = getConclusionCode(requirement, gapTypes, criticality);
    const top = rankedCandidates[0];

    if (criticality === "CRITICAL") {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "CRITICAL_GAP_DETECTED",
        message: "A critical required gap was detected in the match report.",
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: null
      });
    }
    if (gapTypes.includes("PROJECT_ONLY") && requirement.category === "REQUIRED") {
      pushDiagnostic(diagnostics, {
        severity: "INFO",
        code: "REQUIRED_REQUIREMENT_ONLY_PROJECT_EVIDENCE",
        message: "A required requirement is currently supported only by project evidence.",
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: null
      });
    }
    if (gapTypes.includes("STALE_EVIDENCE") && requirement.category === "REQUIRED") {
      pushDiagnostic(diagnostics, {
        severity: "INFO",
        code: "REQUIRED_REQUIREMENT_ONLY_STALE_EVIDENCE",
        message: "A required requirement is currently supported only by stale evidence.",
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: null
      });
    }
    if (gapTypes.includes("RESTRICTED_ONLY") && requirement.category === "REQUIRED") {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "REQUIRED_REQUIREMENT_RESTRICTED_ONLY",
        message: "A required requirement has restricted-only evidence.",
        relatedRequirementId: requirement.requirementId,
        relatedCandidateId: null
      });
    }

    return {
      requirementId: requirement.requirementId,
      requirementText: requirement.correctedDisplayText ?? requirement.originalText,
      category: requirement.category,
      kinds: requirement.kinds,
      evidenceStrengthState: requirement.evidenceStrengthState,
      highestCandidateScore: requirement.highestCandidateScore,
      highestCandidateStrengthBand: top?.strengthBand ?? null,
      topCandidateIds: rankedCandidates.map((candidate) => candidate.candidateId),
      professionalEvidenceCount: requirement.rankedCandidates.filter((candidate) => isProfessional(candidate)).length,
      projectEvidenceCount: requirement.rankedCandidates.filter((candidate) => isProject(candidate)).length,
      restrictedEvidenceCount: requirement.rankedCandidates.filter((candidate) => candidate.restrictions.length > 0).length,
      gapTypes,
      criticality,
      conclusionCode,
      explanation: explanationForRequirement(requirement, gapTypes, top),
      resumeUseGuidance: resumeGuidanceForRequirement(gapTypes, requirement.evidenceStrengthState),
      provenance: {
        scoringRequirementId: requirement.requirementId,
        evidenceScoringRunId: parsed.evidenceScoringRunId
      }
    };
  });

  const strengths = requirementConclusions
    .filter((requirement) =>
      ["STRONG_EVIDENCE", "GOOD_EVIDENCE", "LIMITED_EVIDENCE"].includes(requirement.evidenceStrengthState) &&
      !requirement.gapTypes.includes("NO_EVIDENCE")
    )
    .slice(0, 6)
    .map((requirement) => ({
      strengthId: stableId("strength", [requirement.requirementId, topStrengthLabel(parsed.scoringResult.requirementScores.find((item) => item.requirementId === requirement.requirementId)!) ]),
      requirementIds: [requirement.requirementId],
      strengthCategory: topStrengthLabel(parsed.scoringResult.requirementScores.find((item) => item.requirementId === requirement.requirementId)!),
      explanation: requirement.explanation,
      supportingEvidenceIds: requirement.topCandidateIds,
      evidenceContext:
        requirement.professionalEvidenceCount > 0 && requirement.projectEvidenceCount > 0
          ? "MIXED"
          : requirement.professionalEvidenceCount > 0
            ? "PROFESSIONAL"
            : "PROJECT",
      technologies: parsed.scoringResult.requirementScores
        .find((item) => item.requirementId === requirement.requirementId)
        ?.rankedCandidates.flatMap((candidate) => candidate.matchedTechnologies)
        .slice(0, 4) ?? [],
      confidence:
        requirement.evidenceStrengthState === "STRONG_EVIDENCE"
          ? "HIGH"
          : requirement.evidenceStrengthState === "GOOD_EVIDENCE"
            ? "MEDIUM"
            : "LOW",
      resumeRelevance: requirement.category === "REQUIRED" ? "PRIMARY" : "SECONDARY"
    }));

  const risksAndGaps = requirementConclusions
    .filter((requirement) => !requirement.gapTypes.includes("NONE"))
    .map((requirement) => {
      const scoredRequirement = parsed.scoringResult.requirementScores.find(
        (item) => item.requirementId === requirement.requirementId
      )!;
      return {
        riskId: stableId("risk", [requirement.requirementId, requirement.criticality]),
        requirementIds: [requirement.requirementId],
        gapType: requirement.gapTypes[0],
        severity: requirement.criticality,
        explanation: requirement.explanation,
        availableRestrictedEvidence: scoredRequirement.rankedCandidates
          .filter((candidate) => candidate.restrictions.length > 0)
          .map((candidate) => candidate.candidateId),
        availableProjectEvidence: scoredRequirement.rankedCandidates
          .filter((candidate) => isProject(candidate))
          .map((candidate) => candidate.candidateId),
        availableStaleEvidence: scoredRequirement.rankedCandidates
          .filter((candidate) => isStale(candidate))
          .map((candidate) => candidate.candidateId),
        resumeWarning: requirement.resumeUseGuidance,
        interviewWarning: `Be ready to explain the limitation around ${requirement.requirementText.toLowerCase()}.`,
        provenance: {
          evidenceScoringRunId: parsed.evidenceScoringRunId,
          scoringRequirementIds: [requirement.requirementId]
        }
      };
    });

  const priorityEvidenceThemes = strengths.map((strength) => ({
    themeId: stableId("theme", [strength.strengthCategory]),
    label: strength.strengthCategory,
    supportingRequirementIds: strength.requirementIds,
    supportingEvidenceIds: strength.supportingEvidenceIds,
    strength: strength.confidence === "HIGH" ? "STRONG" : strength.confidence === "MEDIUM" ? "GOOD" : "LIMITED",
    professionalSupportCount: strength.evidenceContext === "PROJECT" ? 0 : strength.supportingEvidenceIds.length,
    projectSupportCount: strength.evidenceContext === "PROFESSIONAL" ? 0 : strength.supportingEvidenceIds.length
  }));

  const priorityTechnologies = parsed.scoringResult.requirementScores
    .flatMap((requirement) =>
      requirement.rankedCandidates.flatMap((candidate) =>
        candidate.matchedTechnologies.map((technology) => ({
          technology,
          requirementImportance: requirement.requirementImportance,
          evidenceStrengthState: requirement.evidenceStrengthState,
          professionalEvidenceCount: requirement.rankedCandidates.filter((entry) => isProfessional(entry)).length,
          recency: candidate.recency,
          guidance:
            isStale(candidate) ? "QUALIFY" : candidate.restrictions.some((r) => r.code === "PROJECT_ONLY") ? "QUALIFY" : "INCLUDE"
        }))
      )
    )
    .filter((item, index, list) => list.findIndex((entry) => entry.technology === item.technology) === index)
    .slice(0, 8);

  const rolesToEmphasize = parsed.scoringResult.requirementScores
    .flatMap((requirement) => requirement.rankedCandidates)
    .filter((candidate) => isProfessional(candidate))
    .filter((candidate, index, list) => list.findIndex((entry) => entry.candidateId === candidate.candidateId) === index)
    .slice(0, 5)
    .map((candidate) => ({
      roleId: candidate.candidateId,
      employer: candidate.employer,
      roleTitle: candidate.role,
      supportedRequirementIds: parsed.scoringResult.requirementScores
        .filter((requirement) => requirement.rankedCandidates.some((entry) => entry.candidateId === candidate.candidateId))
        .map((requirement) => requirement.requirementId),
      strongEvidenceCount: parsed.scoringResult.requirementScores.filter(
        (requirement) =>
          ["STRONG_EVIDENCE", "GOOD_EVIDENCE"].includes(requirement.evidenceStrengthState) &&
          requirement.rankedCandidates.some((entry) => entry.candidateId === candidate.candidateId)
      ).length,
      relevantTechnologies: candidate.matchedTechnologies.slice(0, 6),
      relevantAccomplishments: [candidate.claimText],
      emphasisReason: `Professional evidence from ${candidate.displayTitle} supports multiple report conclusions.`
    }));

  const projectsToConsider = parsed.scoringResult.requirementScores
    .flatMap((requirement) => requirement.rankedCandidates.map((candidate) => ({ requirement, candidate })))
    .filter(({ candidate }) => isProject(candidate))
    .filter(
      ({ candidate }, index, list) =>
        list.findIndex((entry) => entry.candidate.candidateId === candidate.candidateId) === index
    )
    .slice(0, 5)
    .map(({ requirement, candidate }) => ({
      projectId: candidate.candidateId,
      supportedRequirementIds: [requirement.requirementId],
      strongestRelevance:
        candidate.strengthBand === "STRONG"
          ? "STRONG"
          : candidate.strengthBand === "GOOD"
            ? "GOOD"
            : "LIMITED",
      technologies: candidate.matchedTechnologies.slice(0, 5),
      projectOnlyWarning: candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
        ? "Project-only evidence should be labeled clearly if used."
        : null
    }));

  const claimsToAvoid = requirementConclusions
    .filter((requirement) => !requirement.gapTypes.includes("NONE"))
    .map((requirement) => ({
      concept: requirement.requirementText,
      reason: requirement.explanation,
      missingOrRestrictedEvidenceIds: requirement.topCandidateIds,
      truthfulnessRule: "Do not overclaim unsupported, stale, expired, or project-only evidence as current professional support.",
      handling:
        requirement.gapTypes.includes("EXPIRED_CERTIFICATION")
          ? "EXPIRED"
          : requirement.gapTypes.includes("PROJECT_ONLY")
            ? "PROJECT_ONLY"
            : requirement.gapTypes.includes("STALE_EVIDENCE")
              ? "QUALIFY"
              : requirement.gapTypes.includes("NO_EVIDENCE")
                ? "OMIT"
                : "NEEDS_USER_CONFIRMATION"
    }));

  const requiredConclusions = requirementConclusions.filter((item) => item.category === "REQUIRED");
  const strongRequiredCount = requiredConclusions.filter((item) => item.evidenceStrengthState === "STRONG_EVIDENCE").length;
  const goodRequiredCount = requiredConclusions.filter((item) => item.evidenceStrengthState === "GOOD_EVIDENCE").length;
  const limitedRequiredCount = requiredConclusions.filter((item) => item.evidenceStrengthState === "LIMITED_EVIDENCE").length;
  const weakRequiredCount = requiredConclusions.filter((item) => item.evidenceStrengthState === "WEAK_EVIDENCE").length;
  const requiredNoEvidenceCount = requiredConclusions.filter((item) => item.gapTypes.includes("NO_EVIDENCE")).length;
  const requiredRestrictedOnlyCount = requiredConclusions.filter((item) => item.gapTypes.includes("RESTRICTED_ONLY")).length;
  const criticalRequiredGapCount = requiredConclusions.filter((item) => item.criticality === "CRITICAL").length;
  const materialRequiredGapCount = requiredConclusions.filter((item) => item.criticality === "MATERIAL").length;

  const weightedValues = parsed.scoringResult.requirementScores.map((requirement) => ({
    importance: matchReportConfiguration.requirementImportance[requirement.category],
    value:
      requirement.evidenceStrengthState === "EXCLUDED"
        ? null
        : matchReportConfiguration.evidenceStrengthValues[
            requirement.evidenceStrengthState as keyof typeof matchReportConfiguration.evidenceStrengthValues
          ]
  }));

  const numerator = weightedValues.reduce(
    (sum, item) => sum + (item.value === null ? 0 : item.importance * item.value),
    0
  );
  const denominator = weightedValues.reduce((sum, item) => sum + item.importance, 0);
  const alignmentIndex = denominator > 0 ? Math.round((numerator / denominator) * 100) : null;

  const matchTier = inferMatchTier({
    alignmentIndex,
    requiredNoEvidenceCount,
    criticalRequiredGapCount,
    materialRequiredGapCount
  });
  if (criticalRequiredGapCount > 0) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "ALIGNMENT_TIER_CAPPED_BY_CRITICAL_GAP",
      message: "A critical gap capped the maximum alignment tier.",
      relatedRequirementId: requiredConclusions.find((item) => item.criticality === "CRITICAL")?.requirementId ?? null,
      relatedCandidateId: null
    });
  }

  const resumeReadinessState = inferResumeReadiness(
    matchTier,
    criticalRequiredGapCount,
    materialRequiredGapCount,
    diagnostics
  );
  if (resumeReadinessState !== "READY") {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "RESUME_READINESS_LIMITED",
      message: "Resume readiness is limited by current evidence support and gaps.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const pursuitRecommendation = inferPursuitRecommendation(
    matchTier,
    resumeReadinessState,
    criticalRequiredGapCount
  );

  const summary = {
    matchTier,
    pursuitRecommendation,
    resumeReadinessState,
    alignmentIndex,
    requiredRequirementCount: requiredConclusions.length,
    preferredRequirementCount: requirementConclusions.filter((item) => item.category === "PREFERRED").length,
    responsibilityCount: requirementConclusions.filter((item) => item.category === "RESPONSIBILITY").length,
    strongRequiredCount,
    goodRequiredCount,
    limitedRequiredCount,
    weakRequiredCount,
    requiredNoEvidenceCount,
    requiredRestrictedOnlyCount,
    criticalRequiredGapCount,
    materialRequiredGapCount,
    professionalCoreSupportCount: requiredConclusions.filter((item) => item.professionalEvidenceCount > 0).length,
    projectOnlySupportCount: requiredConclusions.filter((item) => item.gapTypes.includes("PROJECT_ONLY")).length,
    staleSupportCount: requiredConclusions.filter((item) => item.gapTypes.includes("STALE_EVIDENCE")).length,
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

  return matchReportResultSchema.parse({
    runId: parsed.runId,
    workspaceId: parsed.workspaceId,
    evidenceScoringRunId: parsed.evidenceScoringRunId,
    evidenceRetrievalRunId: parsed.scoringResult.evidenceRetrievalRunId,
    scoringInputChecksum: parsed.scoringResult.inputChecksum,
    careerProfileVersionId: parsed.scoringResult.careerProfileVersionId,
    requirementAnalysisId: parsed.scoringResult.requirementAnalysisId,
    jobDescriptionVersionId: parsed.scoringResult.jobDescriptionVersionId,
    applicationId: parsed.scoringResult.applicationId,
    matchReportContractVersion: MATCH_REPORT_CONTRACT_VERSION,
    matchReportEngineVersion: MATCH_REPORT_ENGINE_VERSION,
    matchReportConfigurationVersion: MATCH_REPORT_CONFIGURATION_VERSION,
    scoringContractVersion: parsed.scoringResult.scoringContractVersion,
    scoringEngineVersion: parsed.scoringResult.scoringEngineVersion,
    inputChecksum: parsed.inputChecksum,
    createdAt: parsed.createdAt,
    status,
    scoringStatus: parsed.scoringResult.status,
    diagnostics,
    summary,
    reportConfiguration: matchReportConfiguration,
    requirementConclusions,
    strengths,
    risksAndGaps,
    resumeGuidance: {
      priorityEvidenceThemes,
      priorityTechnologies,
      rolesToEmphasize,
      projectsToConsider,
      claimsToAvoid
    }
  });
}
