import type { CanonicalCareerKnowledgeContract } from "@/lib/career/contracts";
import type { CareerProfileVersion, JobRequirementAnalysis } from "@prisma/client";
import type { CareerKnowledgeOpportunity, MatchedCompetency } from "@/lib/competencies/contract";
import {
  buildEvidenceClusterId,
  computeCompetencyCatalogChecksum,
  mapEvidenceToCompetencies,
  mapRequirementToCompetencies,
  relationshipStrengthSortValue
} from "@/lib/competencies/service";
import { competencyCatalog } from "@/lib/competencies/catalog";
import { COMPETENCY_MAPPING_ENGINE_VERSION } from "@/lib/competencies/contract";
import { JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY } from "@/lib/job-descriptions/technology-dictionary";
import {
  jobRequirementAnalysisContractSchema,
  type AnalyzedRequirement,
  type AnalyzedResponsibility,
  type JobRequirementAnalysisContract,
  type RequirementKind
} from "@/lib/job-descriptions/requirement-analysis-contract";
import {
  candidateEvidenceSchema,
  EVIDENCE_RETRIEVAL_CONTRACT_VERSION,
  EVIDENCE_RETRIEVAL_ENGINE_VERSION,
  evidenceRetrievalResultSchema,
  type CandidateEvidence,
  type EvidenceCoverageState,
  type EvidenceDiagnostic,
  type EvidenceEligibilityState,
  type EvidenceRecency,
  type EvidenceRestriction,
  type EvidenceType,
  type RetrievalReason
} from "@/lib/evidence-retrieval/contract";

type InternalCandidate = CandidateEvidence & {
  searchBlob: string;
  matchedConcepts: Set<string>;
  canonicalTechnologies: Set<string>;
  domainTags: Set<string>;
  evidenceReferences: string[];
  matchedCompetencyRecords: MatchedCompetency[];
};

type RetrievalInput = {
  runId: string;
  workspaceId: string;
  careerProfileVersion: Pick<CareerProfileVersion, "id" | "checksum" | "content">;
  requirementAnalysisRecord: Pick<
    JobRequirementAnalysis,
    "id" | "jobDescriptionVersionId" | "sourceChecksum" | "status" | "analysis"
  >;
  applicationId: string | null;
  createdAt: string;
  inputChecksum: string;
  today?: string;
};

type RequirementItem = {
  id: string;
  itemType: "REQUIREMENT" | "RESPONSIBILITY";
  category: "REQUIRED" | "PREFERRED" | "CONTEXTUAL" | "NOISE" | "RESPONSIBILITY";
  kinds: RequirementKind[];
  originalText: string;
  correctedDisplayText: string | null;
  technologies: string[];
  experienceText: string | null;
  excluded: boolean;
  sourceSectionId: string | null;
  parserStatementId: string | null;
  parserResponsibilityId: string | null;
};

type CandidateBuildInput = Omit<
  CandidateEvidence,
  | "retrievalReasons"
  | "matchedRequirementKinds"
  | "matchedTechnologies"
  | "matchedCompetencies"
  | "evidenceClusterId"
  | "evidenceClusterMemberIds"
  | "eligibility"
> & {
  retrievalReasons?: RetrievalReason[];
  matchedRequirementKinds?: RequirementKind[];
  matchedTechnologies?: string[];
  matchedCompetencies?: MatchedCompetency[];
  evidenceClusterId?: string;
  evidenceClusterMemberIds?: string[];
  eligibility?: EvidenceEligibilityState;
  searchParts: string[];
  evidenceReferences?: string[];
  domainParts?: string[];
  conceptParts?: string[];
};

const RECENCY_POLICY = {
  currentYears: 1,
  recentYears: 3,
  olderYears: 5
} as const;

const CONCEPT_DICTIONARY: Array<{ concept: string; phrases: string[] }> = [
  { concept: "API_DESIGN", phrases: ["api design", "design apis", "rest api", "graphql"] },
  { concept: "BACKEND_DEVELOPMENT", phrases: ["backend", "backend services", "server-side"] },
  { concept: "DISTRIBUTED_SYSTEMS", phrases: ["distributed systems", "distributed processing"] },
  { concept: "SYSTEM_DESIGN", phrases: ["system design", "design systems"] },
  { concept: "DATABASE_DESIGN", phrases: ["database design", "postgresql", "sql"] },
  { concept: "CLOUD_ARCHITECTURE", phrases: ["aws", "cloud", "cloud architecture"] },
  { concept: "RELIABILITY", phrases: ["reliability", "resilience", "observability"] },
  { concept: "OBSERVABILITY", phrases: ["observability", "monitoring", "logging"] },
  { concept: "TESTING", phrases: ["testing", "test automation", "well tested", "testable"] },
  { concept: "CI_CD", phrases: ["ci/cd", "continuous integration", "deployment"] },
  { concept: "MENTORING", phrases: ["mentor", "mentoring", "coach", "coaching"] },
  { concept: "TECHNICAL_LEADERSHIP", phrases: ["technical leadership", "technical direction", "leadership"] },
  { concept: "CROSS_FUNCTIONAL_COLLABORATION", phrases: ["cross-functional", "stakeholder", "collaboration"] },
  {
    concept: "COMMUNICATION",
    phrases: ["communication", "communicate", "progress", "risks", "decisions", "stakeholder communication"]
  },
  { concept: "DOCUMENTATION", phrases: ["documentation", "documented", "written"] },
  {
    concept: "PRODUCTION_DELIVERY",
    phrases: ["production code", "production systems", "shipping", "delivery", "deployment", "release"]
  },
  {
    concept: "BUSINESS_OUTCOMES",
    phrases: ["business outcomes", "customer impact", "business impact", "operational impact"]
  },
  { concept: "OWNERSHIP", phrases: ["ownership", "own", "ideation", "iteration"] },
  {
    concept: "CONTINUOUS_IMPROVEMENT",
    phrases: ["continuous improvement", "improve", "improvement", "workflow improvements"]
  },
  {
    concept: "DOCUMENT_WORKFLOWS",
    phrases: ["document heavy", "document-heavy", "document workflows", "document understanding", "document processing"]
  },
  {
    concept: "SEARCH_RETRIEVAL",
    phrases: ["retrieval", "semantic retrieval", "search", "semantic search", "ingestion pipelines"]
  },
  { concept: "CUSTOMER_EMPATHY", phrases: ["customers", "customer empathy", "teammates"] },
  { concept: "AI_ORCHESTRATION", phrases: ["agent", "orchestration", "tool invocation"] },
  { concept: "RAG", phrases: ["rag", "retrieval augmented generation"] },
  { concept: "DATA_PIPELINES", phrases: ["data pipeline", "etl", "ingestion"] }
];

const DOMAIN_ALIASES: Record<string, string[]> = {
  finance: ["finance", "financial", "banking", "fintech"],
  healthcare: ["healthcare", "health care", "medical"],
  saas: ["saas", "software as a service"],
  analytics: ["analytics", "analysis"],
  ai: ["ai", "artificial intelligence", "ml", "machine learning"],
  platform: ["platform", "internal platforms", "platform engineering"],
  travel: ["travel"],
  crm: ["crm", "customer relationship management"],
  msp: ["msp", "managed service provider"],
  audit: ["audit", "auditing"],
  assurance: ["assurance"],
  risk: ["risk management", "risk"],
  compliance: ["compliance", "soc 2", "fedramp", "regulated financial", "regulated finance"]
};

const COMMUNICATION_CONCEPTS = new Set(["COMMUNICATION", "DOCUMENTATION"]);
const COLLABORATION_CONCEPTS = new Set([
  "CROSS_FUNCTIONAL_COLLABORATION",
  "MENTORING",
  "TECHNICAL_LEADERSHIP",
  "CUSTOMER_EMPATHY"
]);
const DATA_CONCEPTS = new Set(["DATA_PIPELINES", "DOCUMENT_WORKFLOWS", "SEARCH_RETRIEVAL"]);
const AI_ML_CONCEPTS = new Set([
  "AI_ORCHESTRATION",
  "RAG",
  "SEARCH_RETRIEVAL",
  "DOCUMENT_WORKFLOWS"
]);
const RESPONSIBILITY_CONCEPTS = new Set([
  "PRODUCTION_DELIVERY",
  "BUSINESS_OUTCOMES",
  "OWNERSHIP",
  "CONTINUOUS_IMPROVEMENT",
  "MENTORING",
  "CROSS_FUNCTIONAL_COLLABORATION"
]);

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeSearchText(value: string | null | undefined) {
  return ` ${normalizeKey(value).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function containsNormalizedPhrase(normalizedHaystack: string, phrase: string) {
  const normalizedPhrase = normalizeSearchText(phrase).trim();
  if (!normalizedPhrase) {
    return false;
  }

  return normalizedHaystack.includes(` ${normalizedPhrase} `);
}

function titleCaseFromSlug(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTechnology(value: string) {
  const key = normalizeKey(value);

  for (const entry of JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY) {
    if (
      normalizeKey(entry.canonicalName) === key ||
      entry.aliases.some((alias) => normalizeKey(alias) === key)
    ) {
      return entry.canonicalName;
    }
  }

  return value.trim();
}

function technologyMatchDetails(requirementTechnology: string, candidateTechnology: string) {
  const requirementCanonical = normalizeTechnology(requirementTechnology);
  const candidateCanonical = normalizeTechnology(candidateTechnology);

  if (normalizeKey(requirementCanonical) !== normalizeKey(candidateCanonical)) {
    return null;
  }

  return {
    canonical: requirementCanonical,
    alias:
      normalizeKey(requirementTechnology) !== normalizeKey(requirementCanonical) ||
      normalizeKey(candidateTechnology) !== normalizeKey(candidateCanonical)
  };
}

function parseDateValue(normalized: string | null) {
  if (!normalized) {
    return null;
  }

  if (/^\d{4}$/.test(normalized)) {
    return new Date(`${normalized}-07-01T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}-15T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00.000Z`);
  }

  return null;
}

function getRecency(
  lastDate: string | null,
  today: string
): EvidenceRecency {
  const parsedLastDate = parseDateValue(lastDate);
  const parsedToday = parseDateValue(today);

  if (!parsedLastDate || !parsedToday) {
    return "UNKNOWN";
  }

  const diffDays = Math.max(
    0,
    Math.floor((parsedToday.getTime() - parsedLastDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const diffYears = diffDays / 365;

  if (diffYears <= RECENCY_POLICY.currentYears) {
    return "CURRENT";
  }

  if (diffYears <= RECENCY_POLICY.recentYears) {
    return "RECENT";
  }

  if (diffYears <= RECENCY_POLICY.olderYears) {
    return "OLDER";
  }

  return "STALE";
}

function pushUniqueRestriction(
  restrictions: EvidenceRestriction[],
  restriction: EvidenceRestriction
) {
  if (!restrictions.some((item) => item.code === restriction.code)) {
    restrictions.push(restriction);
  }
}

function getEligibility(
  candidate: {
    recordKind: string;
    restrictions: EvidenceRestriction[];
  }
): EvidenceEligibilityState {
  if (candidate.recordKind === "AI_SUGGESTION") {
    return "INELIGIBLE";
  }

  if (candidate.restrictions.some((item) => item.code === "AI_SUGGESTION")) {
    return "INELIGIBLE";
  }

  if (
    candidate.restrictions.some((item) =>
      ["UNCONFIRMED", "DERIVED_ONLY", "EXPIRED_CERTIFICATION"].includes(item.code)
    )
  ) {
    return "ELIGIBLE_WITH_RESTRICTIONS";
  }

  return candidate.restrictions.length > 0 ? "ELIGIBLE_WITH_RESTRICTIONS" : "ELIGIBLE";
}

function collectConcepts(values: string[]) {
  const blob = normalizeSearchText(values.join(" "));
  const matches = new Set<string>();

  for (const entry of CONCEPT_DICTIONARY) {
    if (entry.phrases.some((phrase) => containsNormalizedPhrase(blob, phrase))) {
      matches.add(entry.concept);
    }
  }

  return matches;
}

function getDomainMatches(values: string[]) {
  const blob = normalizeSearchText(values.join(" "));
  const matches = new Set<string>();

  for (const [domain, aliases] of Object.entries(DOMAIN_ALIASES)) {
    if (aliases.some((alias) => containsNormalizedPhrase(blob, alias))) {
      matches.add(domain);
    }
  }

  return matches;
}

function mapRawEvidenceType(value: string): EvidenceType {
  switch (value) {
    case "ACCOMPLISHMENT":
      return "ACCOMPLISHMENT";
    case "ARCHITECTURE":
      return "ARCHITECTURE";
    case "LEADERSHIP":
      return "LEADERSHIP";
    case "METRIC":
      return "METRIC";
    case "RESPONSIBILITY":
    case "PRODUCTION":
      return "RESPONSIBILITY";
    default:
      return "OTHER";
  }
}

function buildInternalCandidate(input: CandidateBuildInput): InternalCandidate {
  const restrictions = [...input.restrictions];

  if (input.recordKind === "DERIVED") {
    pushUniqueRestriction(restrictions, {
      code: "DERIVED_ONLY",
      explanation: "This candidate is derived rather than a preserved source fact."
    });
  }

  if (input.recordKind === "AI_SUGGESTION") {
    pushUniqueRestriction(restrictions, {
      code: "AI_SUGGESTION",
      explanation: "AI-suggested candidates are not eligible as verified career evidence."
    });
  }

  if (!["SOURCE_PROVIDED", "VERIFIED", "PROJECT_VERIFIED", "USER_CONFIRMED", "EXPIRED_REFERENCE"].includes(input.confirmationState)) {
    pushUniqueRestriction(restrictions, {
      code: "UNCONFIRMED",
      explanation: "This candidate is not in a confirmed state."
    });
  }

  if (input.context === "PROJECT") {
    pushUniqueRestriction(restrictions, {
      code: "PROJECT_ONLY",
      explanation: "This candidate comes from project-only evidence."
    });
  }

  if (input.recency === "STALE") {
    pushUniqueRestriction(restrictions, {
      code: "STALE_SKILL",
      explanation: "The most recent date for this candidate is stale."
    });
  }

  if (!input.dateMetadata.lastUsedDate && !input.dateMetadata.endDate && !input.dateMetadata.startDate) {
    pushUniqueRestriction(restrictions, {
      code: "MISSING_DATE",
      explanation: "This candidate has no usable date metadata."
    });
  }

  if (
    typeof input.metricVerificationState === "string" &&
    !["VERIFIED", "PROJECT_VERIFIED", "USER_CONFIRMED"].includes(input.metricVerificationState)
  ) {
    pushUniqueRestriction(restrictions, {
      code: "UNVERIFIED_METRIC",
      explanation: "Metric evidence is present but not verified."
    });
  }

  if (
    typeof input.metric === "object" &&
    input.metric !== null &&
    typeof (input.metric as { description?: string }).description === "string" &&
    normalizeKey(input.claimText + " " + input.displayTitle).includes("intermittent")
  ) {
    pushUniqueRestriction(restrictions, {
      code: "INTERMITTENT_USE",
      explanation: "This candidate indicates intermittent usage and should be qualified later."
    });
  }

  const candidate = {
    ...input,
    restrictions,
    eligibility: "ELIGIBLE" as EvidenceEligibilityState,
    searchBlob: normalizeKey(input.searchParts.join(" ")),
    matchedConcepts: collectConcepts([...input.searchParts, ...(input.conceptParts ?? [])]),
    canonicalTechnologies: new Set(input.technologies.map((item) => normalizeTechnology(item))),
    domainTags: getDomainMatches([...(input.domainParts ?? []), ...input.searchParts]),
    evidenceReferences: input.evidenceReferences ?? []
  };

  candidate.eligibility = getEligibility(candidate);
  const matchedCompetencyRecords = mapEvidenceToCompetencies({
    displayTitle: candidate.displayTitle,
    claimText: candidate.claimText,
    technologies: candidate.technologies,
    context: candidate.context,
    evidenceType: candidate.evidenceType,
    recordKind: candidate.recordKind,
    sourceProvenance: candidate.sourceProvenance,
    restrictions
  });
  const evidenceClusterId =
    input.evidenceClusterId ??
    buildEvidenceClusterId({
      sourceId: candidate.sourceProvenance.sourceId,
      sourcePath: candidate.sourceProvenance.sourcePath,
      matchedCompetencies: matchedCompetencyRecords,
      matchedTechnologies: candidate.technologies,
      employer: candidate.employer,
      role: candidate.role,
      project: candidate.project
    });
  const parsed = candidateEvidenceSchema.parse({
    ...candidate,
    retrievalReasons: input.retrievalReasons ?? [],
    matchedRequirementKinds: input.matchedRequirementKinds ?? [],
    matchedTechnologies: input.matchedTechnologies ?? [],
    matchedCompetencies: input.matchedCompetencies ?? matchedCompetencyRecords,
    evidenceClusterId,
    evidenceClusterMemberIds: input.evidenceClusterMemberIds ?? [candidate.candidateId],
    searchBlob: undefined,
    matchedConcepts: undefined,
    canonicalTechnologies: undefined,
    domainTags: undefined,
    evidenceReferences: undefined,
    searchParts: undefined,
    domainParts: undefined,
    conceptParts: undefined
  });

  return {
    ...parsed,
    searchBlob: candidate.searchBlob,
    matchedConcepts: candidate.matchedConcepts,
    canonicalTechnologies: candidate.canonicalTechnologies,
    domainTags: candidate.domainTags,
    evidenceReferences: candidate.evidenceReferences,
    matchedCompetencyRecords
  };
}

function buildCandidateIndex(
  contract: CanonicalCareerKnowledgeContract,
  today: string
) {
  const candidates = new Map<string, InternalCandidate>();

  const addCandidate = (candidate: InternalCandidate) => {
    candidates.set(candidate.candidateId, candidate);
  };

  for (const employment of contract.employment) {
    const roleDates = {
      startDate: employment.startDate?.normalized ?? null,
      endDate: employment.endDate?.normalized ?? null,
      lastUsedDate: employment.endDate?.normalized ?? employment.startDate?.normalized ?? null,
      datePrecision: employment.endDate?.precision ?? employment.startDate?.precision ?? null
    } as const;
    addCandidate(
      buildInternalCandidate({
        candidateId: `role:${employment.id}`,
        careerEvidenceId: employment.id,
        evidenceType: "ROLE",
        displayTitle: `${employment.roleTitle} at ${employment.employer}`,
        claimText: employment.facts[0] ?? employment.roleTitle,
        employer: employment.employer,
        role: employment.roleTitle,
        project: null,
        skill: null,
        technologies: employment.technologies,
        dateMetadata: roleDates,
        recency: getRecency(roleDates.lastUsedDate, today),
        context: "PROFESSIONAL",
        confirmationState: employment.confirmationState,
        recordKind: employment.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: employment.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [
          employment.employer,
          employment.roleTitle,
          ...employment.themes,
          ...employment.responsibilities,
          ...employment.accomplishments,
          ...employment.facts,
          ...employment.technologies,
          ...(employment.domainTags ?? [])
        ],
        domainParts: employment.domainTags
      })
    );

    employment.responsibilities.forEach((responsibility, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `employment-responsibility:${employment.id}:${index}`,
          careerEvidenceId: `${employment.id}#responsibility:${index}`,
          evidenceType: "RESPONSIBILITY",
          displayTitle: `${employment.roleTitle} responsibility`,
          claimText: responsibility,
          employer: employment.employer,
          role: employment.roleTitle,
          project: null,
          skill: null,
          technologies: employment.technologies,
          dateMetadata: roleDates,
          recency: getRecency(roleDates.lastUsedDate, today),
          context: "PROFESSIONAL",
          confirmationState: employment.confirmationState,
          recordKind: employment.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: employment.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [responsibility, employment.roleTitle, ...employment.technologies],
          domainParts: employment.domainTags
        })
      );
    });

    employment.accomplishments.forEach((accomplishment, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `employment-accomplishment:${employment.id}:${index}`,
          careerEvidenceId: `${employment.id}#accomplishment:${index}`,
          evidenceType: "ACCOMPLISHMENT",
          displayTitle: `${employment.roleTitle} accomplishment`,
          claimText: accomplishment,
          employer: employment.employer,
          role: employment.roleTitle,
          project: null,
          skill: null,
          technologies: employment.technologies,
          dateMetadata: roleDates,
          recency: getRecency(roleDates.lastUsedDate, today),
          context: "PROFESSIONAL",
          confirmationState: employment.confirmationState,
          recordKind: employment.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: employment.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [accomplishment, employment.roleTitle, ...employment.technologies],
          domainParts: employment.domainTags
        })
      );
    });

    employment.metrics.forEach((metric, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `employment-metric:${employment.id}:${index}`,
          careerEvidenceId: `${employment.id}#metric:${index}`,
          evidenceType: "METRIC",
          displayTitle: `${employment.roleTitle} metric`,
          claimText: [metric.description, metric.value].filter(Boolean).join(" "),
          employer: employment.employer,
          role: employment.roleTitle,
          project: null,
          skill: null,
          technologies: employment.technologies,
          dateMetadata: roleDates,
          recency: getRecency(roleDates.lastUsedDate, today),
          context: "PROFESSIONAL",
          confirmationState: employment.confirmationState,
          recordKind: employment.recordKind,
          metric,
          metricVerificationState: metric.verificationState,
          sourceProvenance: employment.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [metric.description ?? "", metric.value ?? "", employment.roleTitle],
          domainParts: employment.domainTags
        })
      );
    });

    if (employment.leadershipScope) {
      addCandidate(
        buildInternalCandidate({
          candidateId: `employment-leadership:${employment.id}`,
          careerEvidenceId: `${employment.id}#leadership`,
          evidenceType: "LEADERSHIP",
          displayTitle: `${employment.roleTitle} leadership`,
          claimText: employment.leadershipScope,
          employer: employment.employer,
          role: employment.roleTitle,
          project: null,
          skill: null,
          technologies: employment.technologies,
          dateMetadata: roleDates,
          recency: getRecency(roleDates.lastUsedDate, today),
          context: "PROFESSIONAL",
          confirmationState: employment.confirmationState,
          recordKind: employment.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: employment.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [employment.leadershipScope, employment.roleTitle],
          conceptParts: [employment.leadershipScope]
        })
      );
    }
  }

  for (const project of contract.projects) {
    const projectDates = {
      startDate: project.dates.startDate?.normalized ?? null,
      endDate: project.dates.endDate?.normalized ?? null,
      lastUsedDate:
        project.dates.endDate?.normalized ?? project.dates.startDate?.normalized ?? null,
      datePrecision: project.dates.endDate?.precision ?? project.dates.startDate?.precision ?? null
    } as const;
    const context = project.context === "PROFESSIONAL" ? "PROFESSIONAL" : "PROJECT";
    addCandidate(
      buildInternalCandidate({
        candidateId: `project:${project.id}`,
        careerEvidenceId: project.id,
        evidenceType: "PROJECT",
        displayTitle: project.name,
        claimText: project.purpose ?? project.role ?? project.name,
        employer: null,
        role: project.role,
        project: project.name,
        skill: null,
        technologies: project.technologies,
        dateMetadata: projectDates,
        recency: getRecency(projectDates.lastUsedDate, today),
        context,
        confirmationState: project.confirmationState,
        recordKind: project.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: project.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [
          project.name,
          project.purpose ?? "",
          project.role ?? "",
          ...project.architecture,
          ...project.responsibilities,
          ...project.accomplishments,
          ...project.technologies,
          ...project.tradeoffs,
          ...project.preferredFor,
          ...project.domainTags
        ],
        domainParts: project.domainTags
      })
    );

    project.architecture.forEach((entry, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `project-architecture:${project.id}:${index}`,
          careerEvidenceId: `${project.id}#architecture:${index}`,
          evidenceType: "ARCHITECTURE",
          displayTitle: `${project.name} architecture`,
          claimText: entry,
          employer: null,
          role: project.role,
          project: project.name,
          skill: null,
          technologies: project.technologies,
          dateMetadata: projectDates,
          recency: getRecency(projectDates.lastUsedDate, today),
          context,
          confirmationState: project.confirmationState,
          recordKind: project.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: project.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [entry, project.name, ...project.technologies],
          conceptParts: [entry]
        })
      );
    });

    project.responsibilities.forEach((entry, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `project-responsibility:${project.id}:${index}`,
          careerEvidenceId: `${project.id}#responsibility:${index}`,
          evidenceType: "PROJECT_RESPONSIBILITY",
          displayTitle: `${project.name} responsibility`,
          claimText: entry,
          employer: null,
          role: project.role,
          project: project.name,
          skill: null,
          technologies: project.technologies,
          dateMetadata: projectDates,
          recency: getRecency(projectDates.lastUsedDate, today),
          context,
          confirmationState: project.confirmationState,
          recordKind: project.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: project.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [entry, project.name, ...project.technologies],
          conceptParts: [entry]
        })
      );
    });

    project.accomplishments.forEach((entry, index) => {
      addCandidate(
        buildInternalCandidate({
          candidateId: `project-accomplishment:${project.id}:${index}`,
          careerEvidenceId: `${project.id}#accomplishment:${index}`,
          evidenceType: "PROJECT_ACCOMPLISHMENT",
          displayTitle: `${project.name} accomplishment`,
          claimText: entry,
          employer: null,
          role: project.role,
          project: project.name,
          skill: null,
          technologies: project.technologies,
          dateMetadata: projectDates,
          recency: getRecency(projectDates.lastUsedDate, today),
          context,
          confirmationState: project.confirmationState,
          recordKind: project.recordKind,
          metric: null,
          metricVerificationState: null,
          sourceProvenance: project.provenance,
          retrievalReasons: [],
          matchedRequirementKinds: [],
          matchedTechnologies: [],
          restrictions: [],
          eligibility: "ELIGIBLE",
          searchParts: [entry, project.name, ...project.technologies],
          conceptParts: [entry]
        })
      );
    });
  }

  for (const skill of contract.skills) {
    const lastUsed = skill.lastUse?.normalized ?? skill.firstUse?.normalized ?? null;
    addCandidate(
      buildInternalCandidate({
        candidateId: `skill:${skill.id}`,
        careerEvidenceId: skill.id,
        evidenceType: "SKILL",
        displayTitle: skill.name,
        claimText: skill.notes ?? skill.name,
        employer: null,
        role: null,
        project: null,
        skill: skill.name,
        technologies: [skill.name],
        dateMetadata: {
          startDate: skill.firstUse?.normalized ?? null,
          endDate: skill.lastUse?.normalized ?? null,
          lastUsedDate: lastUsed,
          datePrecision: skill.lastUse?.precision ?? skill.firstUse?.precision ?? null
        },
        recency:
          skill.recency === "CURRENT"
            ? "CURRENT"
            : skill.recency === "STALE"
              ? "STALE"
              : getRecency(lastUsed, today),
        context:
          skill.professionalUse === true
            ? "PROFESSIONAL"
            : skill.projectUse === true
              ? "PROJECT"
              : "OTHER",
        confirmationState: skill.confirmationState,
        recordKind: skill.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: skill.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [skill.name, skill.notes ?? ""],
        evidenceReferences: skill.evidenceReferences
      })
    );
  }

  for (const record of contract.evidence) {
    const project = record.associatedProjectId
      ? contract.projects.find((item) => item.id === record.associatedProjectId)
      : null;
    const employment = record.associatedEmploymentId
      ? contract.employment.find((item) => item.id === record.associatedEmploymentId)
      : null;
    const lastUsed =
      project?.dates.endDate?.normalized ??
      project?.dates.startDate?.normalized ??
      employment?.endDate?.normalized ??
      employment?.startDate?.normalized ??
      null;
    addCandidate(
      buildInternalCandidate({
        candidateId: `evidence:${record.id}`,
        careerEvidenceId: record.id,
        evidenceType: mapRawEvidenceType(record.evidenceType),
        displayTitle: titleCaseFromSlug(record.evidenceType),
        claimText: record.claim,
        employer: employment?.employer ?? null,
        role: employment?.roleTitle ?? project?.role ?? null,
        project: project?.name ?? null,
        skill: null,
        technologies: record.technologies,
        dateMetadata: {
          startDate: employment?.startDate?.normalized ?? project?.dates.startDate?.normalized ?? null,
          endDate: employment?.endDate?.normalized ?? project?.dates.endDate?.normalized ?? null,
          lastUsedDate: lastUsed,
          datePrecision:
            employment?.endDate?.precision ??
            employment?.startDate?.precision ??
            project?.dates.endDate?.precision ??
            project?.dates.startDate?.precision ??
            null
        },
        recency: getRecency(lastUsed, today),
        context: project ? "PROJECT" : employment ? "PROFESSIONAL" : "OTHER",
        confirmationState: record.confirmationState,
        recordKind: record.recordKind,
        metric: record.metric,
        metricVerificationState: record.metric?.verificationState ?? null,
        sourceProvenance: record.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [
          record.claim,
          record.context ?? "",
          ...record.themes,
          ...record.technologies,
          ...record.roleFamilyRelevance
        ]
      })
    );
  }

  for (const education of contract.education) {
    addCandidate(
      buildInternalCandidate({
        candidateId: `education:${education.id}`,
        careerEvidenceId: education.id,
        evidenceType: "EDUCATION",
        displayTitle: education.degree,
        claimText: [education.degree, education.field, education.institution].filter(Boolean).join(" at "),
        employer: null,
        role: null,
        project: null,
        skill: null,
        technologies: [],
        dateMetadata: {
          startDate: null,
          endDate: education.completionDate?.normalized ?? null,
          lastUsedDate: education.completionDate?.normalized ?? null,
          datePrecision: education.completionDate?.precision ?? null
        },
        recency: getRecency(education.completionDate?.normalized ?? null, today),
        context: "EDUCATION",
        confirmationState: education.confirmationState,
        recordKind: education.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: education.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [education.degree, education.field ?? "", education.institution]
      })
    );
  }

  for (const certification of contract.certifications) {
    addCandidate(
      buildInternalCandidate({
        candidateId: `certification:${certification.id}`,
        careerEvidenceId: certification.id,
        evidenceType: "CERTIFICATION",
        displayTitle: certification.name,
        claimText: [certification.name, certification.issuer ?? ""].filter(Boolean).join(" - "),
        employer: null,
        role: null,
        project: null,
        skill: null,
        technologies: [],
        dateMetadata: {
          startDate: certification.awardDate?.normalized ?? null,
          endDate: certification.expirationDate?.normalized ?? null,
          lastUsedDate: certification.expirationDate?.normalized ?? certification.awardDate?.normalized ?? null,
          datePrecision:
            certification.expirationDate?.precision ?? certification.awardDate?.precision ?? null
        },
        recency: getRecency(
          certification.expirationDate?.normalized ?? certification.awardDate?.normalized ?? null,
          today
        ),
        context: "CERTIFICATION",
        confirmationState: certification.confirmationState,
        recordKind: certification.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: certification.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions:
          certification.status === "EXPIRED"
            ? [
                {
                  code: "EXPIRED_CERTIFICATION",
                  explanation: "This certification is expired."
                }
              ]
            : [],
        eligibility: "ELIGIBLE",
        searchParts: [certification.name, certification.issuer ?? "", certification.status]
      })
    );
  }

  for (const story of contract.interviewStories) {
    addCandidate(
      buildInternalCandidate({
        candidateId: `story:${story.id}`,
        careerEvidenceId: story.id,
        evidenceType: "INTERVIEW_STORY",
        displayTitle: story.title,
        claimText: [story.situation, story.task, story.action, story.result].join(" "),
        employer: null,
        role: null,
        project: null,
        skill: null,
        technologies: [],
        dateMetadata: {
          startDate: null,
          endDate: null,
          lastUsedDate: null,
          datePrecision: null
        },
        recency: "UNKNOWN",
        context: "OTHER",
        confirmationState: story.confirmationState,
        recordKind: story.recordKind,
        metric: null,
        metricVerificationState: null,
        sourceProvenance: story.provenance,
        retrievalReasons: [],
        matchedRequirementKinds: [],
        matchedTechnologies: [],
        restrictions: [],
        eligibility: "ELIGIBLE",
        searchParts: [
          story.title,
          story.situation,
          story.task,
          story.action,
          story.result,
          ...story.associatedCompetencies
        ],
        evidenceReferences: story.supportingEvidenceIds
      })
    );
  }

  return candidates;
}

function sortCandidateReasons(reasons: RetrievalReason[]) {
  return [...reasons].sort((left, right) =>
    `${left.code}:${left.explanation}`.localeCompare(`${right.code}:${right.explanation}`)
  );
}

function sortCandidates(candidates: CandidateEvidence[]) {
  return [...candidates].sort((left, right) => {
    const eligibilityRank = (eligibility: CandidateEvidence["eligibility"]) =>
      ({
        ELIGIBLE: 2,
        ELIGIBLE_WITH_RESTRICTIONS: 1,
        INELIGIBLE: 0
      })[eligibility];
    if (eligibilityRank(left.eligibility) !== eligibilityRank(right.eligibility)) {
      return eligibilityRank(right.eligibility) - eligibilityRank(left.eligibility);
    }

    const contextRank = (context: CandidateEvidence["context"]) =>
      ({
        PROFESSIONAL: 4,
        PROJECT: 3,
        EDUCATION: 2,
        CERTIFICATION: 2,
        OTHER: 1
      })[context];
    if (contextRank(left.context) !== contextRank(right.context)) {
      return contextRank(right.context) - contextRank(left.context);
    }

    const recencyRank = (recency: CandidateEvidence["recency"]) =>
      ({
        CURRENT: 5,
        RECENT: 4,
        OLDER: 3,
        UNKNOWN: 2,
        STALE: 1
      })[recency];
    if (recencyRank(left.recency) !== recencyRank(right.recency)) {
      return recencyRank(right.recency) - recencyRank(left.recency);
    }

    return left.candidateId.localeCompare(right.candidateId);
  });
}

function findSharedConcept(
  candidate: InternalCandidate,
  requirementConcepts: Set<string>,
  allowedConcepts?: Set<string>
) {
  for (const concept of requirementConcepts) {
    if (allowedConcepts && !allowedConcepts.has(concept)) {
      continue;
    }

    if (candidate.matchedConcepts.has(concept)) {
      return concept;
    }
  }

  return null;
}

function collectRequirementConcepts(item: RequirementItem) {
  const values = [
    item.originalText,
    item.correctedDisplayText ?? "",
    item.experienceText ?? "",
    ...item.technologies
  ];
  return collectConcepts(values);
}

function buildRequirementItems(
  analysis: JobRequirementAnalysisContract
): RequirementItem[] {
  const requirements: RequirementItem[] = analysis.requirements.map((item: AnalyzedRequirement) => ({
    id: item.id,
    itemType: "REQUIREMENT",
    category: item.category,
    kinds: item.kinds,
    originalText: item.originalText,
    correctedDisplayText: item.correctedDisplayText,
    technologies: item.technologies,
    experienceText: item.experienceText,
    excluded: item.excluded,
    sourceSectionId: item.parserProvenance.sourceSectionId,
    parserStatementId: item.parserProvenance.parserStatementId,
    parserResponsibilityId: null
  }));

  const responsibilities: RequirementItem[] = analysis.responsibilities.map(
    (item: AnalyzedResponsibility) => ({
      id: item.id,
      itemType: "RESPONSIBILITY",
      category: item.relevance === "NOISE" ? "NOISE" : "RESPONSIBILITY",
      kinds: item.kinds,
      originalText: item.originalText,
      correctedDisplayText: item.correctedDisplayText,
      technologies: item.technologies,
      experienceText: null,
      excluded: item.excluded,
      sourceSectionId: item.parserProvenance.sourceSectionId,
      parserStatementId: null,
      parserResponsibilityId: item.parserProvenance.parserResponsibilityId
    })
  );

  return [...requirements, ...responsibilities];
}

function buildReason(
  code: RetrievalReason["code"],
  explanation: string,
  sourceRequirementConcept: string | null,
  sourceCareerField: string | null,
  matchingRule: string,
  competency?: MatchedCompetency | null
): RetrievalReason {
  return {
    code,
    explanation,
    sourceRequirementConcept,
    sourceCareerField,
    competencyId: competency?.competencyId ?? null,
    competencyName: competency?.competencyName ?? null,
    relationshipStrength: competency?.relationshipStrength ?? null,
    direct: competency?.direct ?? false,
    confidence: "HIGH",
    matchingRule
  };
}

function mergeCandidateMatch(
  candidateMatches: Map<string, { candidate: InternalCandidate; reasons: RetrievalReason[]; matchedTechnologies: Set<string> }>,
  candidate: InternalCandidate,
  reason: RetrievalReason,
  matchedTechnology?: string
) {
  const existing =
    candidateMatches.get(candidate.candidateId) ??
    { candidate, reasons: [], matchedTechnologies: new Set<string>() };
  existing.reasons.push(reason);
  if (matchedTechnology) {
    existing.matchedTechnologies.add(matchedTechnology);
  }
  candidateMatches.set(candidate.candidateId, existing);
}

function findMatchesForRequirement(
  item: RequirementItem,
  candidates: Map<string, InternalCandidate>
) {
  const candidateMatches = new Map<
    string,
    { candidate: InternalCandidate; reasons: RetrievalReason[]; matchedTechnologies: Set<string> }
  >();
  const technologies = item.technologies.map((entry) => entry.trim()).filter(Boolean);
  const requirementCompetencyMapping = mapRequirementToCompetencies(item);
  const requirementConcepts = collectRequirementConcepts(item);
  const textBlob = normalizeKey(
    [item.originalText, item.correctedDisplayText ?? "", item.experienceText ?? ""].join(" ")
  );
  const domainMatches = getDomainMatches([item.originalText, item.correctedDisplayText ?? ""]);

  for (const candidate of candidates.values()) {
    const hasSharedTechnology =
      technologies.length > 0 &&
      technologies.some((technology) =>
        candidate.canonicalTechnologies.has(normalizeTechnology(technology))
      );
    const isPrimarilyTechnologyRequirement =
      technologies.length > 0 &&
      item.kinds.every((kind) => ["TECHNOLOGY", "EXPERIENCE"].includes(kind));
    if (isPrimarilyTechnologyRequirement && !hasSharedTechnology) {
      continue;
    }

    for (const requirementTechnology of technologies) {
      for (const candidateTechnology of candidate.technologies) {
        const matched = technologyMatchDetails(requirementTechnology, candidateTechnology);
        if (!matched) {
          continue;
        }

        mergeCandidateMatch(
          candidateMatches,
          candidate,
          buildReason(
            matched.alias ? "TECHNOLOGY_ALIAS_MATCH" : "EXACT_TECHNOLOGY_MATCH",
            `${requirementTechnology} matches ${candidateTechnology}.`,
            matched.canonical,
            "technologies",
            matched.alias
              ? "technology.alias.exact-canonical"
              : "technology.canonical.exact"
          ),
          matched.canonical
        );
      }
    }

    if (
      candidate.evidenceType === "SKILL" &&
      technologies.some(
        (technology) => normalizeKey(normalizeTechnology(technology)) === normalizeKey(candidate.displayTitle)
      )
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "DIRECT_EVIDENCE_REFERENCE",
          `Skill ${candidate.displayTitle} directly matches the requirement technology.`,
          candidate.displayTitle,
          "skills",
          "skill.name.direct"
        ),
        candidate.displayTitle
      );

      for (const referenceId of candidate.evidenceReferences) {
        const referenced = candidates.get(`evidence:${referenceId}`);
        if (referenced) {
          mergeCandidateMatch(
            candidateMatches,
            referenced,
            buildReason(
              "SKILL_EVIDENCE_LINK",
              `Supporting evidence was linked from the ${candidate.displayTitle} skill record.`,
              candidate.displayTitle,
              "skills.evidenceReferences",
              "skill.evidence.link"
            ),
            candidate.displayTitle
          );
        }
      }
    }

    for (const requirementCompetency of requirementCompetencyMapping.competencies) {
      const candidateCompetency = candidate.matchedCompetencyRecords.find(
        (entry) => entry.competencyId === requirementCompetency.competencyId
      );
      if (!candidateCompetency) {
        continue;
      }

      if (
        relationshipStrengthSortValue(candidateCompetency.relationshipStrength) <
        relationshipStrengthSortValue(requirementCompetency.relationshipStrength === "EXACT" ? "DIRECT" : "SUPPORTING")
      ) {
        continue;
      }

      const sharedTechnology =
        technologies.find((technology) =>
          candidate.canonicalTechnologies.has(normalizeTechnology(technology))
        ) ?? undefined;
      if (
        technologies.length > 0 &&
        item.kinds.includes("TECHNOLOGY") &&
        sharedTechnology === undefined &&
        relationshipStrengthSortValue(candidateCompetency.relationshipStrength) <
          relationshipStrengthSortValue("EXACT")
      ) {
        continue;
      }
      const exactLike =
        requirementCompetency.relationshipStrength === "EXACT" ||
        candidateCompetency.relationshipStrength === "EXACT" ||
        sharedTechnology !== undefined;
      const competencyExplanation = exactLike
        ? `${candidate.displayTitle} directly supports ${requirementCompetency.competencyName}.`
        : `${candidate.displayTitle} provides related evidence for ${requirementCompetency.competencyName}.`;

      let code: RetrievalReason["code"] = "USER_CONFIRMED_RELATIONSHIP";
      let rule = "competency.related";
      let field = "competencies";
      if (item.kinds.includes("ARCHITECTURE")) {
        code = "ARCHITECTURE_CONCEPT_MATCH";
        rule = "competency.architecture";
        field = "architecture";
      } else if (item.kinds.includes("COMMUNICATION")) {
        code = "COMMUNICATION_MATCH";
        rule = "competency.communication";
        field = "communication";
      } else if (item.kinds.includes("COLLABORATION")) {
        code = "COLLABORATION_MATCH";
        rule = "competency.collaboration";
        field = "collaboration";
      } else if (item.kinds.includes("DATA")) {
        code = "DATA_MATCH";
        rule = "competency.data";
        field = "data";
      } else if (item.kinds.includes("AI_ML")) {
        code = "AI_ML_MATCH";
        rule = "competency.ai-ml";
        field = "ai_ml";
      } else if (item.kinds.includes("LEADERSHIP")) {
        code = "LEADERSHIP_MATCH";
        rule = "competency.leadership";
        field = "leadership";
      } else if (item.kinds.includes("RESPONSIBILITY")) {
        code =
          candidate.context === "PROJECT"
            ? "PROJECT_RESPONSIBILITY_MATCH"
            : "ROLE_RESPONSIBILITY_MATCH";
        rule = "competency.responsibility";
        field = "responsibilities";
      } else if (item.kinds.includes("EXPERIENCE")) {
        code = "EXPERIENCE_CONTEXT_MATCH";
        rule = "competency.experience";
        field = "employment";
      }

      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          code,
          competencyExplanation,
          requirementCompetency.competencyName,
          field,
          rule,
          candidateCompetency
        ),
        sharedTechnology
      );
    }

    const responsibilityConcept = findSharedConcept(
      candidate,
      requirementConcepts,
      RESPONSIBILITY_CONCEPTS
    );
    if (item.kinds.includes("RESPONSIBILITY") && responsibilityConcept) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          candidate.context === "PROJECT"
            ? "PROJECT_RESPONSIBILITY_MATCH"
            : "ROLE_RESPONSIBILITY_MATCH",
          `${titleCaseFromSlug(responsibilityConcept)} overlaps with the requirement responsibility.`,
          responsibilityConcept,
          "responsibilities",
          "responsibility.concept.dictionary"
        )
      );
    }

    const architectureConcept = findSharedConcept(candidate, requirementConcepts);
    if (item.kinds.includes("ARCHITECTURE") && architectureConcept) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "ARCHITECTURE_CONCEPT_MATCH",
          `${titleCaseFromSlug(architectureConcept)} directly aligns with the architecture requirement.`,
          architectureConcept,
          "architecture",
          "architecture.concept.dictionary"
        )
      );
    }

    const communicationConcept = findSharedConcept(
      candidate,
      requirementConcepts,
      COMMUNICATION_CONCEPTS
    );
    if (item.kinds.includes("COMMUNICATION") && communicationConcept) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "COMMUNICATION_MATCH",
          `${titleCaseFromSlug(communicationConcept)} directly supports the communication requirement.`,
          communicationConcept,
          "communication",
          "communication.concept.dictionary"
        )
      );
    }

    const collaborationConcept = findSharedConcept(
      candidate,
      requirementConcepts,
      COLLABORATION_CONCEPTS
    );
    if (
      (item.kinds.includes("COLLABORATION") || item.kinds.includes("LEADERSHIP")) &&
      collaborationConcept
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "COLLABORATION_MATCH",
          `${titleCaseFromSlug(collaborationConcept)} directly supports the collaboration requirement.`,
          collaborationConcept,
          "collaboration",
          "collaboration.concept.dictionary"
        )
      );
    }

    const dataConcept = findSharedConcept(candidate, requirementConcepts, DATA_CONCEPTS);
    if (item.kinds.includes("DATA") && dataConcept) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "DATA_MATCH",
          `${titleCaseFromSlug(dataConcept)} directly supports the data-oriented requirement.`,
          dataConcept,
          "data",
          "data.concept.dictionary"
        )
      );
    }

    const aiMlConcept = findSharedConcept(candidate, requirementConcepts, AI_ML_CONCEPTS);
    if (item.kinds.includes("AI_ML") && aiMlConcept) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "AI_ML_MATCH",
          `${titleCaseFromSlug(aiMlConcept)} directly supports the AI or search requirement.`,
          aiMlConcept,
          "ai_ml",
          "ai-ml.concept.dictionary"
        )
      );
    }

    const matchingDomain =
      item.kinds.includes("DOMAIN") && domainMatches.size > 0
        ? [...domainMatches].find((domain) => candidate.domainTags.has(domain)) ?? null
        : null;
    if (matchingDomain) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "DOMAIN_MATCH",
          `${titleCaseFromSlug(matchingDomain)} domain evidence overlaps with the requirement.`,
          matchingDomain,
          "domainTags",
          "domain.alias.dictionary"
        )
      );
    }

    if (
      item.kinds.includes("LEADERSHIP") &&
      (candidate.evidenceType === "LEADERSHIP" ||
        candidate.searchBlob.includes("mentor") ||
        candidate.searchBlob.includes("lead"))
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "LEADERSHIP_MATCH",
          "Leadership-specific evidence was found deterministically.",
          "LEADERSHIP",
          "leadership",
          "leadership.explicit"
        )
      );
    }

    if (
      item.kinds.includes("EDUCATION") &&
      candidate.evidenceType === "EDUCATION" &&
      (candidate.searchBlob.includes("bachelor") ||
        candidate.searchBlob.includes("master") ||
        textBlob.includes("degree") ||
        textBlob.includes("computer science"))
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "EDUCATION_MATCH",
          "Education evidence overlaps deterministically with the requirement wording.",
          "EDUCATION",
          "education",
          "education.keyword"
        )
      );
    }

    if (
      item.kinds.includes("CERTIFICATION") &&
      candidate.evidenceType === "CERTIFICATION" &&
      normalizeKey(textBlob).includes(normalizeKey(candidate.displayTitle))
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "CERTIFICATION_MATCH",
          "Certification name overlaps deterministically with the requirement wording.",
          candidate.displayTitle,
          "certifications",
          "certification.name.exact"
        )
      );
    }

    if (
      item.kinds.includes("EXPERIENCE") &&
      candidate.context === "PROFESSIONAL" &&
      technologies.some((technology) =>
        candidate.canonicalTechnologies.has(normalizeTechnology(technology))
      )
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "EXPERIENCE_CONTEXT_MATCH",
          "Professional experience exists for the requested technology.",
          technologies[0] ?? null,
          "employment",
          "experience.professional.technology"
        ),
        technologies[0]
      );
    }

    if (
      candidate.evidenceType === "INTERVIEW_STORY" &&
      [...requirementConcepts].some((concept) => candidate.matchedConcepts.has(concept))
    ) {
      mergeCandidateMatch(
        candidateMatches,
        candidate,
        buildReason(
          "USER_CONFIRMED_RELATIONSHIP",
          `Interview-story evidence supports ${[...requirementConcepts].find((concept) => candidate.matchedConcepts.has(concept)) ?? "the same competency area"}.`,
          [...requirementConcepts].find((concept) => candidate.matchedConcepts.has(concept)) ?? null,
          "interviewStories",
          "story.competency.overlap"
        )
      );
    }
  }

  return candidateMatches;
}

function getCoverageState(
  eligibleCandidates: CandidateEvidence[],
  excludedCandidates: CandidateEvidence[],
  item: RequirementItem
): EvidenceCoverageState {
  if (item.excluded || item.category === "NOISE") {
    return "EXCLUDED";
  }

  if (eligibleCandidates.length === 0 && excludedCandidates.length === 0) {
    return "NO_CANDIDATES";
  }

  if (
    eligibleCandidates.length === 0 ||
    eligibleCandidates.every((candidate) => candidate.eligibility !== "ELIGIBLE")
  ) {
    return "LIMITED_CANDIDATES";
  }

  return "CANDIDATES_FOUND";
}

function toStoredCandidate(
  candidate: InternalCandidate,
  reasons: RetrievalReason[],
  kinds: RequirementKind[],
  matchedTechnologies: Set<string>
): CandidateEvidence {
  const matchedCompetencies = candidate.matchedCompetencyRecords
    .filter((competency) =>
      reasons.some(
        (reason) =>
          reason.competencyId === competency.competencyId ||
          reason.sourceRequirementConcept === competency.competencyName
      )
    )
    .sort(
      (left, right) =>
        relationshipStrengthSortValue(right.relationshipStrength) -
          relationshipStrengthSortValue(left.relationshipStrength) ||
        left.competencyName.localeCompare(right.competencyName)
    );

  return candidateEvidenceSchema.parse({
    ...candidate,
    retrievalReasons: sortCandidateReasons(reasons),
    matchedCompetencies,
    matchedRequirementKinds: [...kinds].sort(),
    matchedTechnologies: [...matchedTechnologies].sort(),
    evidenceClusterMemberIds: candidate.evidenceClusterMemberIds ?? [candidate.candidateId]
  });
}

export function buildEvidenceRetrievalResult(input: RetrievalInput) {
  const careerContract = input.careerProfileVersion.content as CanonicalCareerKnowledgeContract;
  const parsedCareer = careerContract;
  const analysis = jobRequirementAnalysisContractSchema.parse(input.requirementAnalysisRecord.analysis);
  const today = input.today ?? input.createdAt.slice(0, 10);
  const competencyCatalogChecksum = computeCompetencyCatalogChecksum(competencyCatalog);
  const candidates = buildCandidateIndex(parsedCareer, today);
  const diagnostics: EvidenceDiagnostic[] = [];
  const requirementResults = buildRequirementItems(analysis).map((item) => {
    const requirementCompetencyMapping = mapRequirementToCompetencies(item);
    const isNoise = item.category === "NOISE";
    const retrievalStatus = item.excluded
      ? "EXCLUDED"
      : isNoise
        ? "SKIPPED_NOISE"
        : "ELIGIBLE";

    if (item.excluded) {
      diagnostics.push({
        severity: "INFO",
        code: "EXCLUDED_REQUIREMENT_SKIPPED",
        message: "Excluded requirement skipped from evidence retrieval.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    } else if (isNoise) {
      diagnostics.push({
        severity: "INFO",
        code: "NOISE_REQUIREMENT_SKIPPED",
        message: "Noise requirement skipped from evidence retrieval.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    }

    const matches =
      retrievalStatus === "ELIGIBLE" ? findMatchesForRequirement(item, candidates) : new Map();

    const eligibleCandidates: CandidateEvidence[] = [];
    const excludedCandidates: CandidateEvidence[] = [];
    const itemDiagnostics: EvidenceDiagnostic[] = [];

    for (const match of matches.values()) {
      const stored = toStoredCandidate(
        match.candidate,
        match.reasons,
        item.kinds,
        match.matchedTechnologies
      );
      if (stored.eligibility === "INELIGIBLE") {
        excludedCandidates.push(stored);
      } else {
        eligibleCandidates.push(stored);
      }
    }

    const cappedEligibleCandidates = sortCandidates(eligibleCandidates).slice(0, 12);
    const cappedExcludedCandidates = sortCandidates(excludedCandidates).slice(0, 8);

    if (
      retrievalStatus === "ELIGIBLE" &&
      cappedEligibleCandidates.length === 0 &&
      cappedExcludedCandidates.length === 0
    ) {
      itemDiagnostics.push({
        severity: "WARNING",
        code: "NO_CANDIDATES",
        message: "No candidate evidence was retrieved for this item.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    }

    if (
      cappedEligibleCandidates.length > 0 &&
      cappedEligibleCandidates.every((candidate) =>
        candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
      )
    ) {
      itemDiagnostics.push({
        severity: "INFO",
        code: "ONLY_PROJECT_CANDIDATES",
        message: "Only project-context candidates were retrieved for this item.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    }

    if (
      cappedEligibleCandidates.length > 0 &&
      cappedEligibleCandidates.every((candidate) =>
        candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL")
      )
    ) {
      itemDiagnostics.push({
        severity: "INFO",
        code: "ONLY_STALE_CANDIDATES",
        message: "Only stale candidates were retrieved for this item.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    }

    if (
      item.kinds.includes("CERTIFICATION") &&
      cappedEligibleCandidates.some((candidate) =>
        candidate.restrictions.some((restriction) => restriction.code === "EXPIRED_CERTIFICATION")
      )
    ) {
      itemDiagnostics.push({
        severity: "WARNING",
        code: "EXPIRED_CERTIFICATION_ONLY",
        message: "Certification evidence exists but is expired.",
        relatedRequirementId: item.id,
        relatedCandidateId: null
      });
    }

    diagnostics.push(...itemDiagnostics);

    return {
      requirementId: item.id,
      itemType: item.itemType,
      category: item.category,
      reviewStatus: analysis.reviewStatus,
      kinds: item.kinds,
      originalText: item.originalText,
      correctedDisplayText: item.correctedDisplayText,
      technologies: [...item.technologies].sort(),
      experienceText: item.experienceText,
      mappedCompetencies: requirementCompetencyMapping.competencies,
      competencyComponents: requirementCompetencyMapping.components,
      sourceProvenance: {
        sourceSectionId: item.sourceSectionId,
        parserStatementId: item.parserStatementId,
        parserResponsibilityId: item.parserResponsibilityId
      },
      retrievalStatus,
      candidateEvidence: cappedEligibleCandidates,
      excludedEvidence: cappedExcludedCandidates,
      diagnostics: itemDiagnostics,
      coverageState: getCoverageState(cappedEligibleCandidates, cappedExcludedCandidates, item)
    };
  });

  const careerKnowledgeOpportunities: CareerKnowledgeOpportunity[] = requirementResults
    .filter((item) => item.retrievalStatus === "ELIGIBLE")
    .flatMap((item) => {
      const currentEvidence = [...item.candidateEvidence, ...item.excludedEvidence];
      const relatedEvidence = currentEvidence
        .filter((candidate) => (candidate.matchedCompetencies ?? []).length > 0)
        .map((candidate) => candidate.displayTitle);
      const hasOnlySkills =
        currentEvidence.length > 0 &&
        currentEvidence.every((candidate) => candidate.evidenceType === "SKILL");
      const hasOnlyProjects =
        currentEvidence.length > 0 &&
        currentEvidence.every((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
        );
      const hasOnlyStale =
        currentEvidence.length > 0 &&
        currentEvidence.every((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL")
        );
      const hasInterviewStoryOnly =
        currentEvidence.length > 0 &&
        currentEvidence.some((candidate) => candidate.evidenceType === "INTERVIEW_STORY") &&
        currentEvidence.every(
          (candidate) =>
            candidate.evidenceType === "INTERVIEW_STORY" ||
            candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
        );
      const unsupportedComponents = item.competencyComponents.filter(
        (component) => component.relationshipStrength === "NONE"
      );

      if (
        relatedEvidence.length === 0 &&
        !hasOnlySkills &&
        !hasOnlyProjects &&
        !hasOnlyStale &&
        !hasInterviewStoryOnly &&
        unsupportedComponents.length === 0
      ) {
        return [];
      }

      return [
        {
          requirementId: item.requirementId,
          requirementTitle: item.correctedDisplayText ?? item.originalText,
          competencyId: item.mappedCompetencies[0]?.competencyId ?? null,
          competencyName: item.mappedCompetencies[0]?.competencyName ?? null,
          currentEvidence: relatedEvidence.slice(0, 5),
          insufficiencyReason: hasOnlySkills
            ? "Only skill-declaration evidence is currently stored."
            : hasOnlyProjects
              ? "Only project-context evidence was retrieved."
              : hasOnlyStale
                ? "Only older or stale evidence was retrieved."
                : hasInterviewStoryOnly
                  ? "Interview-story evidence exists without enough direct professional evidence."
                  : unsupportedComponents.length > 0
                    ? `Compound coverage is incomplete for ${unsupportedComponents
                        .map((component) => component.label)
                        .join(", ")}.`
                    : "Related evidence exists, but an explicit structured professional example may be missing.",
          suggestedReviewAction: hasOnlySkills
            ? "Review Career Knowledge for a verified structured example if one exists."
            : hasOnlyProjects
              ? "Review whether a professional production example exists and should be modeled explicitly."
              : hasOnlyStale
                ? "Review whether a more recent structured example exists."
                : hasInterviewStoryOnly
                  ? "Review whether a matching professional accomplishment or responsibility exists."
                  : unsupportedComponents.length > 0
                    ? "Review the partially covered components and confirm whether additional truthful examples exist."
                    : "Confirm whether this is a genuine gap or a Career Knowledge modeling gap."
        }
      ];
    });

  const summary = {
    totalRequirements: requirementResults.length,
    includedRequirements: requirementResults.filter((item) => item.retrievalStatus === "ELIGIBLE")
      .length,
    excludedRequirements: requirementResults.filter((item) => item.retrievalStatus !== "ELIGIBLE")
      .length,
    requiredWithCandidates: requirementResults.filter(
      (item) => item.category === "REQUIRED" && item.candidateEvidence.length > 0
    ).length,
    preferredWithCandidates: requirementResults.filter(
      (item) => item.category === "PREFERRED" && item.candidateEvidence.length > 0
    ).length,
    contextualWithCandidates: requirementResults.filter(
      (item) => item.category === "CONTEXTUAL" && item.candidateEvidence.length > 0
    ).length,
    responsibilitiesWithCandidates: requirementResults.filter(
      (item) => item.itemType === "RESPONSIBILITY" && item.candidateEvidence.length > 0
    ).length,
    noCandidateCount: requirementResults.filter((item) => item.coverageState === "NO_CANDIDATES")
      .length,
    limitedCandidateCount: requirementResults.filter(
      (item) => item.coverageState === "LIMITED_CANDIDATES"
    ).length,
    restrictedCandidateCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) => candidate.restrictions.length > 0).length,
      0
    ),
    professionalCandidateCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) => candidate.context === "PROFESSIONAL").length,
      0
    ),
    projectCandidateCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) => candidate.context === "PROJECT").length,
      0
    ),
    educationCandidateCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) => candidate.context === "EDUCATION").length,
      0
    ),
    certificationCandidateCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) => candidate.context === "CERTIFICATION").length,
      0
    ),
    projectRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
        ).length,
      0
    ),
    staleRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "STALE_SKILL")
        ).length,
      0
    ),
    missingDateRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "MISSING_DATE")
        ).length,
      0
    ),
    expiredCertificationRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "EXPIRED_CERTIFICATION")
        ).length,
      0
    ),
    unverifiedRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "UNVERIFIED_METRIC")
        ).length,
      0
    ),
    unconfirmedRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "UNCONFIRMED")
        ).length,
      0
    ),
    indirectRestrictionCount: requirementResults.reduce(
      (count, item) =>
        count +
        item.candidateEvidence.filter((candidate) =>
          candidate.restrictions.some((restriction) => restriction.code === "NO_DIRECT_REQUIREMENT_LINK")
        ).length,
      0
    ),
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

  return evidenceRetrievalResultSchema.parse({
    runId: input.runId,
    workspaceId: input.workspaceId,
    careerProfileVersionId: input.careerProfileVersion.id,
    requirementAnalysisId: input.requirementAnalysisRecord.id,
    jobDescriptionVersionId: input.requirementAnalysisRecord.jobDescriptionVersionId,
    applicationId: input.applicationId,
    retrievalContractVersion: EVIDENCE_RETRIEVAL_CONTRACT_VERSION,
    retrievalEngineVersion: EVIDENCE_RETRIEVAL_ENGINE_VERSION,
    competencyCatalogVersion: competencyCatalog.catalogVersion,
    competencyCatalogChecksum,
    competencyMappingEngineVersion: COMPETENCY_MAPPING_ENGINE_VERSION,
    careerSourceChecksum: input.careerProfileVersion.checksum,
    requirementSourceChecksum: input.requirementAnalysisRecord.sourceChecksum,
    inputChecksum: input.inputChecksum,
    createdAt: input.createdAt,
    status,
    diagnostics,
    summary,
    requirementResults,
    careerKnowledgeOpportunities,
    recencyPolicy: {
      ...RECENCY_POLICY,
      evaluatedAt: today
    }
  });
}
