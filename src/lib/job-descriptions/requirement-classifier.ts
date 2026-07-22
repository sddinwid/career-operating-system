import {
  JOB_REQUIREMENT_ANALYSIS_CONTRACT_VERSION,
  JOB_REQUIREMENT_CLASSIFIER_VERSION,
  type DownstreamReadiness,
  jobRequirementAnalysisContractSchema,
  type AnalysisDiagnostic,
  type AnalyzedRequirement,
  type AnalyzedResponsibility,
  type JobRequirementAnalysisContract,
  type RequirementAnalysisReviewStatus,
  type RequirementCategory,
  type RequirementKind,
  type ResponsibilityRelevance,
  type UserOverrideState
} from "@/lib/job-descriptions/requirement-analysis-contract";
import {
  type ParsedJobDescriptionContract,
  type QualificationRequirement,
  type Responsibility
} from "@/lib/job-descriptions/parser-contract";

type BuildDraftArgs = {
  analysisId: string;
  workspaceId: string;
  parseId: string;
  parsed: ParsedJobDescriptionContract;
  createdAt?: Date;
};

const requiredPattern =
  /\b(must|required|requirement|minimum|at least|minimum of|need to|needs to|authorized to work|clearance required)\b/i;
const preferredPattern =
  /\b(preferred|nice to have|bonus|plus|ideally|familiarity with .* plus)\b/i;
const compensationPattern =
  /^(?:pay range|salary range|salary|compensation)\s*:?\s*\$?\d/i;
const compensationDisclaimerPattern =
  /^(?:the actual offer may vary|actual compensation may vary|compensation may vary|pay may vary|offer may vary)/i;
const workAuthorizationPattern =
  /\b(authorized to work|work authorization|visa sponsorship|sponsorship)\b/i;
const clearancePattern = /\b(clearance|public trust|secret|top secret)\b/i;
const travelPattern = /\b(travel|travel up to \d+%|\d+%\s*travel)\b/i;
const locationPattern = /\b(remote|hybrid|on-site|onsite|relocate|location)\b/i;
const communicationPattern =
  /\b(communication|communicate|present|writing|written|verbal|progress|risk|risks|decision|decisions|documentation)\b/i;
const collaborationPattern =
  /\b(collaborat|cross-functional|stakeholder|partner|team|mentor|peer|teammate|customer|onboarding|across disciplines|shared goals)\b/i;
const architecturePattern =
  /\b(architecture|distributed systems|microservices|api|rest|graphql|platform|maintainable|well-tested|well tested|observable|observability|tradeoffs|reliability|performance|scalability|production code)\b/i;
const cloudPattern = /\b(aws|azure|gcp|cloud|lambda|sqs|cloudwatch)\b/i;
const dataPattern = /\b(data|database|postgres|postgresql|mysql|sql|etl|warehouse|analytics|document-heavy|ingestion|retrieval|search)\b/i;
const aiMlPattern = /\b(ai|ml|machine learning|llm|rag|openai|langchain)\b/i;
const securityPattern = /\b(security|secure|oauth|authentication|authorization|cissp|soc 2|fedramp)\b/i;
const domainPattern = /\b(fintech|healthcare|payments|saas|ecommerce|gov|government|audit|assurance|risk management|compliance)\b/i;
const responsibilityPattern =
  /\b(scope|prioritize|delivery|deliver|ownership|own|build|ship|shipping|production|iterate|improve|improvement|balance|shape|business outcomes?)\b/i;
const contextualSectionTypes = new Set([
  "ABOUT_ROLE",
  "LOCATION",
  "COMPANY_VALUES"
]);
const requiredSectionTypes = new Set([
  "REQUIRED_QUALIFICATIONS",
  "TECHNICAL_CRAFT",
  "IMPACT_EXECUTION",
  "COLLABORATION_INFLUENCE",
  "CULTURE_GROWTH"
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function defaultOverrideState(): UserOverrideState {
  return {
    categoryChanged: false,
    kindsChanged: false,
    exclusionChanged: false,
    noteChanged: false,
    displayTextChanged: false,
    confirmationChanged: false
  };
}

function addDiagnostic(
  diagnostics: AnalysisDiagnostic[],
  diagnostic: AnalysisDiagnostic
) {
  diagnostics.push(diagnostic);
}

function buildKindsFromText(args: {
  text: string;
  technologies: string[];
  hasExperience: boolean;
  hasEducation: boolean;
  hasCertification: boolean;
  domainReferences: string[];
  leadershipReferences: string[];
}): RequirementKind[] {
  const kinds = new Set<RequirementKind>();

  if (args.technologies.length > 0) {
    kinds.add("TECHNOLOGY");
  }
  if (args.hasExperience) {
    kinds.add("EXPERIENCE");
  }
  if (args.hasEducation) {
    kinds.add("EDUCATION");
  }
  if (args.hasCertification) {
    kinds.add("CERTIFICATION");
  }
  if (args.leadershipReferences.length > 0) {
    kinds.add("LEADERSHIP");
  }
  if (args.domainReferences.length > 0 || domainPattern.test(args.text)) {
    kinds.add("DOMAIN");
  }
  if (workAuthorizationPattern.test(args.text)) {
    kinds.add("WORK_AUTHORIZATION");
  }
  if (clearancePattern.test(args.text)) {
    kinds.add("CLEARANCE");
    kinds.add("SECURITY");
  }
  if (travelPattern.test(args.text)) {
    kinds.add("TRAVEL");
  }
  if (locationPattern.test(args.text)) {
    kinds.add("LOCATION");
  }
  if (communicationPattern.test(args.text)) {
    kinds.add("COMMUNICATION");
  }
  if (collaborationPattern.test(args.text)) {
    kinds.add("COLLABORATION");
  }
  if (architecturePattern.test(args.text)) {
    kinds.add("ARCHITECTURE");
  }
  if (cloudPattern.test(args.text)) {
    kinds.add("CLOUD");
  }
  if (dataPattern.test(args.text)) {
    kinds.add("DATA");
  }
  if (aiMlPattern.test(args.text)) {
    kinds.add("AI_ML");
  }
  if (securityPattern.test(args.text)) {
    kinds.add("SECURITY");
  }
  if (responsibilityPattern.test(args.text)) {
    kinds.add("RESPONSIBILITY");
  }

  if (kinds.size === 0) {
    kinds.add("OTHER");
  }

  return Array.from(kinds);
}

function classifyRequirement(
  requirement: QualificationRequirement,
  parsed: ParsedJobDescriptionContract
) {
  const text = requirement.originalText;
  const section = parsed.sections.find((item) => item.id === requirement.sourceSectionId);

  let category: RequirementCategory = "CONTEXTUAL";
  let confidence: AnalyzedRequirement["confidence"] = requirement.confidence;
  let classificationRule = "requirements.classify.fallback.contextual";

  if (
    section?.type === "BENEFITS" ||
    section?.type === "EQUAL_OPPORTUNITY" ||
    section?.type === "APPLICATION_INSTRUCTIONS" ||
    compensationPattern.test(text) ||
    compensationDisclaimerPattern.test(text)
  ) {
    category = "NOISE";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.noise";
  } else if (
    section?.type === "CULTURE_GROWTH" &&
    /\bfieldguide'?s values\b|\bFearless\b|\bFast\b|\bLovable\b|\bOwners\b|\bWin-win\b|\bInclusive\b/i.test(
      text
    )
  ) {
    category = "CONTEXTUAL";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.cultureValues.contextual";
  } else if (section?.type === "COMPANY_VALUES") {
    category = "CONTEXTUAL";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.values.contextual";
  } else if (contextualSectionTypes.has(section?.type ?? "")) {
    category = "CONTEXTUAL";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.contextual";
  } else if (
    requirement.levelApplicability !== "ALL_LEVELS" &&
    section &&
    requiredSectionTypes.has(section.type)
  ) {
    category = "CONTEXTUAL";
    confidence = "HIGH";
    classificationRule = "requirements.classify.levelSpecific.contextual";
  } else if (
    requirement.explicitLabel === "REQUIRED" ||
    requirement.explicitLabel === "MINIMUM"
  ) {
    category = "REQUIRED";
    confidence = "HIGH";
    classificationRule = "requirements.classify.explicit.required";
  } else if (
    requirement.explicitLabel === "PREFERRED" ||
    requirement.explicitLabel === "NICE_TO_HAVE" ||
    requirement.explicitLabel === "BONUS"
  ) {
    category = "PREFERRED";
    confidence = "HIGH";
    classificationRule = "requirements.classify.explicit.preferred";
  } else if (requiredPattern.test(text)) {
    category = "REQUIRED";
    confidence = "MEDIUM";
    classificationRule = "requirements.classify.lexical.required";
  } else if (preferredPattern.test(text)) {
    category = "PREFERRED";
    confidence = "MEDIUM";
    classificationRule = "requirements.classify.lexical.preferred";
  } else if (requiredSectionTypes.has(section?.type ?? "")) {
    category = "REQUIRED";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.required";
  } else if (section?.type === "PREFERRED_QUALIFICATIONS") {
    category = "PREFERRED";
    confidence = "HIGH";
    classificationRule = "requirements.classify.section.preferred";
  } else if (section?.type === "SKILLS") {
    category = "CONTEXTUAL";
    confidence = "LOW";
    classificationRule = "requirements.classify.section.skills.contextual";
  }

  const experience = parsed.experienceRequirements.find(
    (item) => item.id === requirement.experienceRequirementId
  );

  const kinds = buildKindsFromText({
    text,
    technologies: requirement.technologyReferences,
    hasExperience: Boolean(experience),
    hasEducation: Boolean(requirement.degreeRequirement),
    hasCertification: Boolean(requirement.certificationRequirement),
    domainReferences: requirement.domainReferences,
    leadershipReferences: requirement.leadershipReferences
  });

  return {
    category,
    confidence,
    classificationRule,
    kinds,
    experience
  };
}

function classifyResponsibility(responsibility: Responsibility) {
  const text = responsibility.text;
  const kinds = buildKindsFromText({
    text,
    technologies: responsibility.technologyMentions,
    hasExperience: false,
    hasEducation: false,
    hasCertification: false,
    domainReferences: [],
    leadershipReferences: actionLooksLeadership(text) ? ["leadership"] : []
  });

  const relevance: ResponsibilityRelevance = /equal opportunity|benefits|apply now/i.test(text)
    ? "NOISE"
    : "INCLUDED";

  return {
    relevance,
    kinds:
      kinds.includes("RESPONSIBILITY") ? kinds : (["RESPONSIBILITY", ...kinds] as RequirementKind[]),
    classificationRule:
      relevance === "NOISE"
        ? "responsibilities.classify.noise"
        : "responsibilities.classify.included",
    confidence: relevance === "NOISE" ? "MEDIUM" : responsibility.confidence
  };
}

function actionLooksLeadership(text: string) {
  return /\b(lead|mentor|manage|coach|influence|hire|hiring|onboard|onboarding)\b/i.test(text);
}

function buildSummary(
  requirements: AnalyzedRequirement[],
  responsibilities: AnalyzedResponsibility[],
  downstreamReadiness: DownstreamReadiness
) {
  const includedRequirements = requirements.filter((item) => !item.excluded);
  const includedResponsibilities = responsibilities.filter((item) => !item.excluded);
  const userOverridesCount = [
    ...requirements.map((item) => item.userOverrideState),
    ...responsibilities.map((item) => item.userOverrideState)
  ].filter((state) => Object.values(state).some(Boolean)).length;

  return {
    requiredCount: includedRequirements.filter((item) => item.category === "REQUIRED").length,
    preferredCount: includedRequirements.filter((item) => item.category === "PREFERRED").length,
    contextualCount: includedRequirements.filter((item) => item.category === "CONTEXTUAL").length,
    noiseCount: includedRequirements.filter((item) => item.category === "NOISE").length,
    includedResponsibilitiesCount: includedResponsibilities.filter(
      (item) => item.relevance === "INCLUDED"
    ).length,
    excludedResponsibilitiesCount: responsibilities.filter((item) => item.excluded).length,
    technologiesCount: new Set(
      includedRequirements.flatMap((item) => item.technologies).concat(
        includedResponsibilities.flatMap((item) => item.technologies)
      )
    ).size,
    experienceRequirementsCount: includedRequirements.filter((item) =>
      item.kinds.includes("EXPERIENCE")
    ).length,
    educationRequirementsCount: includedRequirements.filter((item) =>
      item.kinds.includes("EDUCATION")
    ).length,
    certificationRequirementsCount: includedRequirements.filter((item) =>
      item.kinds.includes("CERTIFICATION")
    ).length,
    leadershipRequirementsCount: includedRequirements.filter((item) =>
      item.kinds.includes("LEADERSHIP")
    ).length,
    domainRequirementsCount: includedRequirements.filter((item) =>
      item.kinds.includes("DOMAIN")
    ).length,
    userOverridesCount,
    userAddedRequirementsCount: requirements.filter((item) => item.userAdded).length,
    unresolvedReviewItemsCount:
      requirements.filter((item) => item.confirmationState === "UNCONFIRMED" && !item.excluded)
        .length +
      responsibilities.filter(
        (item) => item.confirmationState === "UNCONFIRMED" && !item.excluded
      ).length,
    lowConfidenceCount:
      requirements.filter((item) => item.confidence === "LOW" && !item.excluded).length +
      responsibilities.filter((item) => item.confidence === "LOW" && !item.excluded).length,
    excludedRequirementsCount: requirements.filter((item) => item.excluded).length,
    qualificationExtractionCount: includedRequirements.length,
    responsibilityExtractionCount: includedResponsibilities.length,
    downstreamReadiness
  };
}

function countMeaningfulSectionLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function countEligibleRequirementLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !compensationPattern.test(line) && !compensationDisclaimerPattern.test(line)
    ).length;
}

function buildDiagnostics(
  parsed: ParsedJobDescriptionContract,
  requirements: AnalyzedRequirement[],
  responsibilities: AnalyzedResponsibility[]
) {
  const diagnostics: AnalysisDiagnostic[] = [];

  for (const requirement of requirements) {
    if (requirement.confidence === "LOW" && !requirement.excluded) {
      addDiagnostic(diagnostics, {
        code: "LOW_CONFIDENCE_CLASSIFICATION",
        severity: "WARNING",
        message: `Low-confidence requirement classification: ${requirement.originalText}`,
        rule: "requirements.diagnostics.lowConfidence",
        location: requirement.sourceLocation,
        relatedItemIds: [requirement.id]
      });
    }

    if (requirement.kinds.length === 0) {
      addDiagnostic(diagnostics, {
        code: "REQUIREMENT_WITH_NO_KINDS",
        severity: "WARNING",
        message: `Requirement kinds were empty: ${requirement.originalText}`,
        rule: "requirements.diagnostics.noKinds",
        location: requirement.sourceLocation,
        relatedItemIds: [requirement.id]
      });
    }

    if (requirement.userAdded && requirement.parserProvenance.parserStatementId) {
      addDiagnostic(diagnostics, {
        code: "USER_ADDED_REQUIREMENT_WITH_SOURCE_PROVENANCE",
        severity: "ERROR",
        message: "A user-added requirement should not claim parser source provenance.",
        rule: "requirements.diagnostics.userAddedProvenance",
        location: null,
        relatedItemIds: [requirement.id]
      });
    }

    if (
      requirement.explicitSourceLabel === "PREFERRED" &&
      requirement.category === "REQUIRED"
    ) {
      addDiagnostic(diagnostics, {
        code: "PREFERRED_WORDING_IN_REQUIRED_CATEGORY",
        severity: "WARNING",
        message: `Preferred wording was classified as required: ${requirement.originalText}`,
        rule: "requirements.diagnostics.preferredConflict",
        location: requirement.sourceLocation,
        relatedItemIds: [requirement.id]
      });
    }
  }

  const duplicateRequirementTexts = new Set<string>();
  for (const requirement of requirements) {
    const key = requirement.normalizedText;
    if (duplicateRequirementTexts.has(key)) {
      addDiagnostic(diagnostics, {
        code: "DUPLICATE_REQUIREMENT",
        severity: "INFO",
        message: `Duplicate requirement text remains in the review set: ${requirement.originalText}`,
        rule: "requirements.diagnostics.duplicate",
        location: requirement.sourceLocation,
        relatedItemIds: [requirement.id]
      });
    } else {
      duplicateRequirementTexts.add(key);
    }
  }

  if (
    parsed.experienceRequirements.some((item) => item.associatedSkill === null)
  ) {
    addDiagnostic(diagnostics, {
      code: "EXPERIENCE_WITH_NO_CLEAR_SUBJECT",
      severity: "WARNING",
      message: "At least one experience requirement has no clear associated skill.",
      rule: "requirements.diagnostics.experienceAmbiguous",
      location: null,
      relatedItemIds: []
    });
  }

  const qualificationLineCount = parsed.sections
    .filter(
      (item) =>
        requiredSectionTypes.has(item.type) || item.type === "PREFERRED_QUALIFICATIONS"
    )
    .reduce((total, section) => total + countEligibleRequirementLines(section.text), 0);
  if (qualificationLineCount >= 3 && requirements.length === 0) {
    addDiagnostic(diagnostics, {
      code: "QUALIFICATION_EXTRACTION_EMPTY",
      severity: "ERROR",
      message:
        "The parser detected qualification content, but no reviewable requirements were extracted for downstream automation.",
      rule: "requirements.diagnostics.qualificationCoverage",
      location: null,
      relatedItemIds: []
    });
  }

  const summary = buildSummary(requirements, responsibilities, "NEEDS_REVIEW");
  if (summary.requiredCount === 0) {
    addDiagnostic(diagnostics, {
      code: "NO_REQUIRED_REQUIREMENTS_DETECTED",
      severity: "WARNING",
      message: "No required requirements are currently included in the analysis.",
      rule: "requirements.diagnostics.noRequired",
      location: null,
      relatedItemIds: []
    });
  }
  if (
    summary.requiredCount === 0 &&
    summary.preferredCount === 0 &&
    summary.contextualCount > 0
  ) {
    addDiagnostic(diagnostics, {
      code: "ALL_REQUIREMENTS_CONTEXTUAL",
      severity: "INFO",
      message: "All included requirements are currently contextual.",
      rule: "requirements.diagnostics.allContextual",
      location: null,
      relatedItemIds: []
    });
  }
  const denominator = Math.max(
    1,
    summary.requiredCount + summary.preferredCount + summary.contextualCount + summary.noiseCount
  );
  if (summary.noiseCount / denominator > 0.5) {
    addDiagnostic(diagnostics, {
      code: "UNUSUALLY_HIGH_NOISE_RATIO",
      severity: "INFO",
      message: "More than half of the included requirements are currently classified as noise.",
      rule: "requirements.diagnostics.noiseRatio",
      location: null,
      relatedItemIds: []
    });
  }

  if (
    parsed.sections.some(
      (item) => item.type === "OTHER" && /Core Competencies|Our Values/i.test(item.heading)
    )
  ) {
    addDiagnostic(diagnostics, {
      code: "KNOWN_SECTION_UNRECOGNIZED",
      severity: "ERROR",
      message:
        "A known job-description section heading was still treated as unrecognized.",
      rule: "requirements.diagnostics.knownSectionUnrecognized",
      location: null,
      relatedItemIds: []
    });
  }

  const responsibilitySections = parsed.sections.filter((item) => item.type === "RESPONSIBILITIES");
  for (const section of responsibilitySections) {
    const sourceLineCount = countMeaningfulSectionLines(section.text);
    const extractedCount = responsibilities.filter(
      (item) => item.parserProvenance.sourceSectionId === section.id
    ).length;
    if (sourceLineCount >= 3 && extractedCount < sourceLineCount) {
      addDiagnostic(diagnostics, {
        code: "RESPONSIBILITY_ITEMS_MERGED",
        severity: "ERROR",
        message:
          "The responsibilities section still contains merged source lines instead of atomic responsibility records.",
        rule: "requirements.diagnostics.responsibilityItemsMerged",
        location: null,
        relatedItemIds: []
      });
      addDiagnostic(diagnostics, {
        code: "RESPONSIBILITY_EXTRACTION_COVERAGE_LOW",
        severity: "ERROR",
        message:
          "The parser detected a responsibilities section with multiple lines, but too few responsibilities were extracted for downstream automation.",
        rule: "requirements.diagnostics.responsibilityCoverage",
        location: null,
        relatedItemIds: []
      });
    }
  }

  const qualificationSections = parsed.sections.filter((item) =>
    requiredSectionTypes.has(item.type) || item.type === "PREFERRED_QUALIFICATIONS"
  );
  const mergedPreferred = qualificationSections.some((section) => {
    const sourceLineCount = countEligibleRequirementLines(section.text);
    const extractedCount = requirements.filter((item) => item.sourceSectionId === section.id).length;
    return sourceLineCount >= 2 && extractedCount < sourceLineCount;
  });

  if (mergedPreferred) {
    addDiagnostic(diagnostics, {
      code: "ATOMIC_EXTRACTION_COVERAGE_LOW",
      severity: "ERROR",
      message:
        "At least one recognized list-oriented section still produced fewer atomic items than the source lines indicate.",
      rule: "requirements.diagnostics.atomicCoverage",
      location: null,
      relatedItemIds: []
    });
  }

  const preferredSection = parsed.sections.find((item) => item.type === "PREFERRED_QUALIFICATIONS");
  if (preferredSection) {
    const sourceLineCount = countEligibleRequirementLines(preferredSection.text);
    const extractedCount = requirements.filter(
      (item) => item.sourceSectionId === preferredSection.id
    ).length;
    if (sourceLineCount >= 2 && extractedCount < sourceLineCount) {
      addDiagnostic(diagnostics, {
        code: "PREFERRED_ITEMS_MERGED",
        severity: "ERROR",
        message:
          "Preferred experience lines are still merged and need atomic decomposition before downstream use.",
        rule: "requirements.diagnostics.preferredItemsMerged",
        location: null,
        relatedItemIds: []
      });
    }
  }

  const requiredSections = parsed.sections.filter((item) => requiredSectionTypes.has(item.type));
  if (
    requiredSections.some((section) => {
      const sourceLineCount = countEligibleRequirementLines(section.text);
      const extractedCount = requirements.filter((item) => item.sourceSectionId === section.id).length;
      return sourceLineCount >= 2 && extractedCount < sourceLineCount;
    })
  ) {
    addDiagnostic(diagnostics, {
      code: "QUALIFICATION_ITEMS_MERGED",
      severity: "ERROR",
      message:
        "One or more core qualification sections still contain merged multi-line items instead of atomic requirements.",
      rule: "requirements.diagnostics.qualificationItemsMerged",
      location: null,
      relatedItemIds: []
    });
  }

  if (
    requirements.some(
      (item) =>
        item.parserStatementId !== null &&
        /senior|staff/i.test(item.originalText) &&
        item.levelApplicability === "ALL_LEVELS"
    )
  ) {
    addDiagnostic(diagnostics, {
      code: "LEVEL_APPLICABILITY_MISSING",
      severity: "ERROR",
      message:
        "At least one level-specific item lost its level applicability during parsing or classification.",
      rule: "requirements.diagnostics.levelApplicabilityMissing",
      location: null,
      relatedItemIds: []
    });
  }

  const contextualCoverageCount = requirements.filter(
    (item) => item.category === "CONTEXTUAL" && !item.excluded
  ).length;
  if (
    parsed.sections.some((item) => item.type === "ABOUT_ROLE" || item.type === "COMPANY_VALUES") &&
    contextualCoverageCount === 0
  ) {
    addDiagnostic(diagnostics, {
      code: "CONTEXTUAL_SECTION_UNDER_EXTRACTED",
      severity: "WARNING",
      message:
        "Contextual role or values sections were present, but little or no contextual review content was extracted.",
      rule: "requirements.diagnostics.contextualUnderExtracted",
      location: null,
      relatedItemIds: []
    });
  }

  return diagnostics;
}

function deriveDownstreamReadiness(args: {
  diagnostics: AnalysisDiagnostic[];
  lowConfidenceAcknowledged: boolean;
  summary: ReturnType<typeof buildSummary>;
}): DownstreamReadiness {
  if (
    args.diagnostics.some(
      (item) =>
        item.severity === "ERROR" ||
        item.code === "NO_REQUIRED_REQUIREMENTS_DETECTED"
    )
  ) {
    return "BLOCKED";
  }

  if (args.summary.lowConfidenceCount > 0 && !args.lowConfidenceAcknowledged) {
    return "NEEDS_REVIEW";
  }

  return "READY";
}

function deriveReviewStatus(args: {
  diagnostics: AnalysisDiagnostic[];
  lowConfidenceAcknowledged: boolean;
  confirmed?: boolean;
}): RequirementAnalysisReviewStatus {
  if (args.confirmed) {
    return "CONFIRMED";
  }

  if (args.diagnostics.some((item) => item.severity === "ERROR")) {
    return "FAILED";
  }

  if (
    args.diagnostics.some((item) => item.code === "LOW_CONFIDENCE_CLASSIFICATION") &&
    !args.lowConfidenceAcknowledged
  ) {
    return "NEEDS_REVIEW";
  }

  if (args.diagnostics.some((item) => item.severity === "WARNING")) {
    return "NEEDS_REVIEW";
  }

  return "DRAFT";
}

export function recomputeRequirementAnalysis(
  analysis: JobRequirementAnalysisContract,
  parsed: ParsedJobDescriptionContract,
  options?: { confirmed?: boolean }
) {
  const diagnostics = buildDiagnostics(parsed, analysis.requirements, analysis.responsibilities);
  const provisionalSummary = buildSummary(
    analysis.requirements,
    analysis.responsibilities,
    "NEEDS_REVIEW"
  );
  const downstreamReadiness = deriveDownstreamReadiness({
    diagnostics,
    lowConfidenceAcknowledged: analysis.lowConfidenceAcknowledged,
    summary: provisionalSummary
  });
  const summary = buildSummary(
    analysis.requirements,
    analysis.responsibilities,
    downstreamReadiness
  );
  const reviewStatus = deriveReviewStatus({
    diagnostics,
    lowConfidenceAcknowledged: analysis.lowConfidenceAcknowledged,
    confirmed: options?.confirmed
  });

  return jobRequirementAnalysisContractSchema.parse({
    ...analysis,
    diagnostics,
    summary,
    reviewStatus
  });
}

export function buildInitialRequirementAnalysisDraft(
  args: BuildDraftArgs
) {
  const requirements: AnalyzedRequirement[] = args.parsed.qualifications.map((requirement) => {
    const classified = classifyRequirement(requirement, args.parsed);
    return {
      id: `requirement-${slugify(requirement.id) || "item"}`,
      parserStatementId: requirement.id,
      originalText: requirement.originalText,
      normalizedText: requirement.normalizedText,
      correctedDisplayText: null,
      category: classified.category,
      kinds: classified.kinds,
      explicitSourceLabel: requirement.explicitLabel,
      levelApplicability: requirement.levelApplicability,
      sourceGroupId: requirement.sourceGroupId,
      sourceSectionId: requirement.sourceSectionId,
      sourceSectionType:
        args.parsed.sections.find((item) => item.id === requirement.sourceSectionId)?.type ?? null,
      sourceLocation: requirement.sourceLocation,
      technologies: requirement.technologyReferences,
      experienceText: classified.experience?.originalText ?? null,
      degreeRequirement: requirement.degreeRequirement,
      certificationRequirement: requirement.certificationRequirement,
      equivalencyText: requirement.equivalencyText,
      domainReferences: requirement.domainReferences,
      leadershipReferences: requirement.leadershipReferences,
      confidence: classified.confidence,
      classificationRule: classified.classificationRule,
      parserProvenance: {
        parseId: args.parseId,
        parserVersion: args.parsed.parserVersion,
        parserStatementId: requirement.id,
        parserResponsibilityId: null,
        sourceSectionId: requirement.sourceSectionId
      },
      userOverrideState: defaultOverrideState(),
      userAdded: false,
      excluded: false,
      reviewNote: null,
      confirmationState: "UNCONFIRMED"
    };
  });

  const responsibilities: AnalyzedResponsibility[] = args.parsed.responsibilities.map(
    (responsibility) => {
      const classified = classifyResponsibility(responsibility);
      return {
        id: `responsibility-${slugify(responsibility.id) || "item"}`,
        parserResponsibilityId: responsibility.id,
        originalText: responsibility.text,
        normalizedText: responsibility.normalizedText,
        correctedDisplayText: null,
        relevance: classified.relevance,
        kinds: classified.kinds,
        technologies: responsibility.technologyMentions,
        sourceLocation: responsibility.sourceLocation,
        confidence: classified.confidence,
        classificationRule: classified.classificationRule,
        parserProvenance: {
          parseId: args.parseId,
          parserVersion: args.parsed.parserVersion,
          parserStatementId: null,
          parserResponsibilityId: responsibility.id,
          sourceSectionId: responsibility.sourceSectionId
        },
        userOverrideState: defaultOverrideState(),
        excluded: false,
        reviewNote: null,
        confirmationState: "UNCONFIRMED"
      };
    }
  );

  const base = jobRequirementAnalysisContractSchema.parse({
    id: args.analysisId,
    workspaceId: args.workspaceId,
    jobDescriptionVersionId: args.parsed.jobDescriptionVersionId,
    parseId: args.parseId,
    contractVersion: JOB_REQUIREMENT_ANALYSIS_CONTRACT_VERSION,
    classifierVersion: JOB_REQUIREMENT_CLASSIFIER_VERSION,
    createdAt: (args.createdAt ?? new Date()).toISOString(),
    reviewStatus: "DRAFT",
    sourceChecksum: args.parsed.sourceChecksum,
    parserVersion: args.parsed.parserVersion,
    requirements,
    responsibilities,
    summary: buildSummary(requirements, responsibilities, "NEEDS_REVIEW"),
    lowConfidenceAcknowledged: false,
    diagnostics: []
  });

  return recomputeRequirementAnalysis(base, args.parsed);
}
