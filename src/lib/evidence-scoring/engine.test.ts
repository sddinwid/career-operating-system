import { describe, expect, it } from "vitest";
import { buildEvidenceScoringResult } from "@/lib/evidence-scoring/engine";
import type { EvidenceRetrievalResult } from "@/lib/evidence-retrieval/contract";

function buildRetrievalResult(): EvidenceRetrievalResult {
  return {
    runId: "retrieval-run-1",
    workspaceId: "workspace-1",
    careerProfileVersionId: "career-version-1",
    requirementAnalysisId: "analysis-1",
    jobDescriptionVersionId: "job-description-1",
    applicationId: "application-1",
    retrievalContractVersion: "1.0.0",
    retrievalEngineVersion: "m4.1.0",
    careerSourceChecksum: "career-checksum-1",
    requirementSourceChecksum: "requirement-checksum-1",
    inputChecksum: "retrieval-input-checksum-1",
    createdAt: "2026-07-17T12:00:00.000Z",
    status: "SUCCESS",
    diagnostics: [],
    summary: {
      totalRequirements: 3,
      includedRequirements: 3,
      excludedRequirements: 0,
      requiredWithCandidates: 1,
      preferredWithCandidates: 1,
      contextualWithCandidates: 0,
      responsibilitiesWithCandidates: 1,
      noCandidateCount: 1,
      limitedCandidateCount: 0,
      restrictedCandidateCount: 4,
      professionalCandidateCount: 2,
      projectCandidateCount: 1,
      educationCandidateCount: 0,
      certificationCandidateCount: 1,
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      diagnosticInfoCount: 0
    },
    requirementResults: [
      {
        requirementId: "required-tech",
        itemType: "REQUIREMENT",
        category: "REQUIRED",
        reviewStatus: "CONFIRMED",
        kinds: ["TECHNOLOGY", "EXPERIENCE", "RESPONSIBILITY"],
        originalText: "5+ years of PostgreSQL in production",
        correctedDisplayText: "Production PostgreSQL experience",
        technologies: ["PostgreSQL", "AWS"],
        experienceText: "5+ years",
        sourceProvenance: {
          sourceSectionId: "section-1",
          parserStatementId: "statement-1",
          parserResponsibilityId: null
        },
        retrievalStatus: "ELIGIBLE",
        candidateEvidence: [
          {
            candidateId: "candidate-pro",
            careerEvidenceId: "career-pro",
            evidenceType: "RESPONSIBILITY",
            displayTitle: "Senior Engineer at Acme",
            claimText: "Owned PostgreSQL services on AWS with measurable latency gains.",
            employer: "Acme",
            role: "Senior Engineer",
            project: null,
            skill: null,
            technologies: ["PostgreSQL", "AWS"],
            dateMetadata: {
              startDate: "2024-01",
              endDate: "2026-05",
              lastUsedDate: "2026-05",
              datePrecision: "MONTH"
            },
            recency: "CURRENT",
            context: "PROFESSIONAL",
            confirmationState: "USER_CONFIRMED",
            recordKind: "USER_CONFIRMED",
            metric: { description: "Latency reduction", value: "37%" },
            metricVerificationState: "VERIFIED",
            sourceProvenance: {
              sourceSection: "professionalExperience",
              sourceId: "career-pro",
              sourcePath: "professionalExperience[0]"
            },
            retrievalReasons: [
              {
                code: "EXACT_TECHNOLOGY_MATCH",
                explanation: "PostgreSQL matches PostgreSQL.",
                sourceRequirementConcept: "PostgreSQL",
                sourceCareerField: "technologies",
                confidence: "HIGH",
                matchingRule: "technology.canonical.exact"
              },
              {
                code: "ROLE_RESPONSIBILITY_MATCH",
                explanation: "Responsibility concepts overlap deterministically.",
                sourceRequirementConcept: "BACKEND_DEVELOPMENT",
                sourceCareerField: "responsibilities",
                confidence: "HIGH",
                matchingRule: "responsibility.concept.dictionary"
              },
              {
                code: "EXACT_TECHNOLOGY_MATCH",
                explanation: "AWS matches AWS.",
                sourceRequirementConcept: "AWS",
                sourceCareerField: "technologies",
                confidence: "HIGH",
                matchingRule: "technology.canonical.exact"
              }
            ],
            matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE", "RESPONSIBILITY"],
            matchedTechnologies: ["AWS", "PostgreSQL"],
            restrictions: [],
            eligibility: "ELIGIBLE"
          },
          {
            candidateId: "candidate-project",
            careerEvidenceId: "career-project",
            evidenceType: "PROJECT",
            displayTitle: "Platform modernization",
            claimText: "Built internal AWS data tooling with intermittent PostgreSQL use.",
            employer: null,
            role: null,
            project: "Platform modernization",
            skill: null,
            technologies: ["postgres", "Docker"],
            dateMetadata: {
              startDate: null,
              endDate: null,
              lastUsedDate: null,
              datePrecision: null
            },
            recency: "UNKNOWN",
            context: "PROJECT",
            confirmationState: "PROJECT_VERIFIED",
            recordKind: "SOURCE_FACT",
            metric: { description: "Pipeline throughput", value: "2x" },
            metricVerificationState: "UNVERIFIED",
            sourceProvenance: {
              sourceSection: "projects",
              sourceId: "career-project",
              sourcePath: "projects[0]"
            },
            retrievalReasons: [
              {
                code: "TECHNOLOGY_ALIAS_MATCH",
                explanation: "postgres matches PostgreSQL.",
                sourceRequirementConcept: "PostgreSQL",
                sourceCareerField: "technologies",
                confidence: "HIGH",
                matchingRule: "technology.alias.exact-canonical"
              },
              {
                code: "PROJECT_RESPONSIBILITY_MATCH",
                explanation: "Responsibility concepts overlap deterministically.",
                sourceRequirementConcept: "BACKEND_DEVELOPMENT",
                sourceCareerField: "responsibilities",
                confidence: "HIGH",
                matchingRule: "responsibility.concept.dictionary"
              }
            ],
            matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE", "RESPONSIBILITY"],
            matchedTechnologies: ["PostgreSQL"],
            restrictions: [
              {
                code: "PROJECT_ONLY",
                explanation: "This candidate comes from project-only evidence."
              },
              {
                code: "MISSING_DATE",
                explanation: "This candidate has no usable date metadata."
              },
              {
                code: "INTERMITTENT_USE",
                explanation: "This candidate indicates intermittent usage and should be qualified later."
              }
            ],
            eligibility: "ELIGIBLE_WITH_RESTRICTIONS"
          },
          {
            candidateId: "candidate-pro",
            careerEvidenceId: "career-pro",
            evidenceType: "RESPONSIBILITY",
            displayTitle: "Senior Engineer at Acme",
            claimText: "Owned PostgreSQL services on AWS with measurable latency gains.",
            employer: "Acme",
            role: "Senior Engineer",
            project: null,
            skill: null,
            technologies: ["PostgreSQL", "AWS"],
            dateMetadata: {
              startDate: "2024-01",
              endDate: "2026-05",
              lastUsedDate: "2026-05",
              datePrecision: "MONTH"
            },
            recency: "CURRENT",
            context: "PROFESSIONAL",
            confirmationState: "USER_CONFIRMED",
            recordKind: "USER_CONFIRMED",
            metric: { description: "Latency reduction", value: "37%" },
            metricVerificationState: "VERIFIED",
            sourceProvenance: {
              sourceSection: "professionalExperience",
              sourceId: "career-pro",
              sourcePath: "professionalExperience[0]"
            },
            retrievalReasons: [
              {
                code: "DIRECT_EVIDENCE_REFERENCE",
                explanation: "Skill record links to this exact evidence.",
                sourceRequirementConcept: "PostgreSQL",
                sourceCareerField: "skills.evidenceReferences",
                confidence: "HIGH",
                matchingRule: "skill.evidence.link"
              }
            ],
            matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE", "RESPONSIBILITY"],
            matchedTechnologies: ["PostgreSQL"],
            restrictions: [],
            eligibility: "ELIGIBLE"
          }
        ],
        excludedEvidence: [
          {
            candidateId: "candidate-ai",
            careerEvidenceId: "career-ai",
            evidenceType: "SKILL",
            displayTitle: "AI drafted evidence",
            claimText: "AI drafted evidence",
            employer: null,
            role: null,
            project: null,
            skill: "AI drafted evidence",
            technologies: ["PostgreSQL"],
            dateMetadata: {
              startDate: null,
              endDate: null,
              lastUsedDate: null,
              datePrecision: null
            },
            recency: "UNKNOWN",
            context: "OTHER",
            confirmationState: "UNCONFIRMED",
            recordKind: "AI_SUGGESTION",
            metric: null,
            metricVerificationState: null,
            sourceProvenance: {
              sourceSection: "skills",
              sourceId: "career-ai",
              sourcePath: "skills[2]"
            },
            retrievalReasons: [
              {
                code: "EXACT_TECHNOLOGY_MATCH",
                explanation: "PostgreSQL matches PostgreSQL.",
                sourceRequirementConcept: "PostgreSQL",
                sourceCareerField: "technologies",
                confidence: "HIGH",
                matchingRule: "technology.canonical.exact"
              }
            ],
            matchedRequirementKinds: ["TECHNOLOGY"],
            matchedTechnologies: ["PostgreSQL"],
            restrictions: [
              {
                code: "AI_SUGGESTION",
                explanation: "AI-suggested candidates are not eligible as verified career evidence."
              }
            ],
            eligibility: "INELIGIBLE"
          }
        ],
        diagnostics: [],
        coverageState: "CANDIDATES_FOUND"
      },
      {
        requirementId: "preferred-cert",
        itemType: "REQUIREMENT",
        category: "PREFERRED",
        reviewStatus: "CONFIRMED",
        kinds: ["CERTIFICATION"],
        originalText: "Active AWS certification preferred",
        correctedDisplayText: null,
        technologies: ["AWS"],
        experienceText: null,
        sourceProvenance: {
          sourceSectionId: "section-2",
          parserStatementId: "statement-2",
          parserResponsibilityId: null
        },
        retrievalStatus: "ELIGIBLE",
        candidateEvidence: [],
        excludedEvidence: [
          {
            candidateId: "candidate-cert-expired",
            careerEvidenceId: "career-cert-expired",
            evidenceType: "CERTIFICATION",
            displayTitle: "AWS Developer Associate",
            claimText: "Expired AWS Developer Associate certification.",
            employer: null,
            role: null,
            project: null,
            skill: null,
            technologies: ["AWS"],
            dateMetadata: {
              startDate: "2020-01",
              endDate: "2022-01",
              lastUsedDate: "2022-01",
              datePrecision: "MONTH"
            },
            recency: "STALE",
            context: "CERTIFICATION",
            confirmationState: "EXPIRED_REFERENCE",
            recordKind: "SOURCE_FACT",
            metric: null,
            metricVerificationState: null,
            sourceProvenance: {
              sourceSection: "certifications",
              sourceId: "career-cert-expired",
              sourcePath: "certifications[0]"
            },
            retrievalReasons: [
              {
                code: "CERTIFICATION_MATCH",
                explanation: "Certification name overlaps deterministically with the requirement wording.",
                sourceRequirementConcept: "AWS Developer Associate",
                sourceCareerField: "certifications",
                confidence: "HIGH",
                matchingRule: "certification.name.exact"
              }
            ],
            matchedRequirementKinds: ["CERTIFICATION"],
            matchedTechnologies: ["AWS"],
            restrictions: [
              {
                code: "EXPIRED_CERTIFICATION",
                explanation: "Certification is expired."
              }
            ],
            eligibility: "INELIGIBLE"
          }
        ],
        diagnostics: [],
        coverageState: "LIMITED_CANDIDATES"
      },
      {
        requirementId: "responsibility-1",
        itemType: "RESPONSIBILITY",
        category: "RESPONSIBILITY",
        reviewStatus: "CONFIRMED",
        kinds: ["LEADERSHIP", "ARCHITECTURE", "DOMAIN"],
        originalText: "Lead architecture reviews in a finance platform",
        correctedDisplayText: null,
        technologies: ["AWS"],
        experienceText: null,
        sourceProvenance: {
          sourceSectionId: "section-3",
          parserStatementId: null,
          parserResponsibilityId: "responsibility-1"
        },
        retrievalStatus: "ELIGIBLE",
        candidateEvidence: [
          {
            candidateId: "candidate-lead",
            careerEvidenceId: "career-lead",
            evidenceType: "LEADERSHIP",
            displayTitle: "Staff Engineer leadership",
            claimText: "Mentored engineers and led distributed-system architecture decisions in fintech.",
            employer: "Fintech Co",
            role: "Staff Engineer",
            project: null,
            skill: null,
            technologies: ["AWS"],
            dateMetadata: {
              startDate: "2023-01",
              endDate: "2025-01",
              lastUsedDate: "2025-01",
              datePrecision: "MONTH"
            },
            recency: "RECENT",
            context: "PROFESSIONAL",
            confirmationState: "SOURCE_PROVIDED",
            recordKind: "SOURCE_FACT",
            metric: null,
            metricVerificationState: null,
            sourceProvenance: {
              sourceSection: "professionalExperience",
              sourceId: "career-lead",
              sourcePath: "professionalExperience[1]"
            },
            retrievalReasons: [
              {
                code: "ARCHITECTURE_CONCEPT_MATCH",
                explanation: "Architecture-related concepts overlap deterministically.",
                sourceRequirementConcept: "SYSTEM_DESIGN",
                sourceCareerField: "architecture",
                confidence: "HIGH",
                matchingRule: "architecture.concept.dictionary"
              },
              {
                code: "LEADERSHIP_MATCH",
                explanation: "Leadership-specific evidence was found deterministically.",
                sourceRequirementConcept: "LEADERSHIP",
                sourceCareerField: "leadership",
                confidence: "HIGH",
                matchingRule: "leadership.explicit"
              },
              {
                code: "DOMAIN_MATCH",
                explanation: "Domain metadata overlaps deterministically.",
                sourceRequirementConcept: "finance",
                sourceCareerField: "domainTags",
                confidence: "HIGH",
                matchingRule: "domain.alias.dictionary"
              },
              {
                code: "USER_CONFIRMED_RELATIONSHIP",
                explanation: "An interview story references the same deterministic competency area.",
                sourceRequirementConcept: "LEADERSHIP",
                sourceCareerField: "interviewStories",
                confidence: "HIGH",
                matchingRule: "story.competency.overlap"
              }
            ],
            matchedRequirementKinds: ["LEADERSHIP", "ARCHITECTURE", "DOMAIN"],
            matchedTechnologies: ["AWS"],
            restrictions: [],
            eligibility: "ELIGIBLE"
          }
        ],
        excludedEvidence: [],
        diagnostics: [],
        coverageState: "CANDIDATES_FOUND"
      }
    ],
    recencyPolicy: {
      currentYears: 1,
      recentYears: 3,
      olderYears: 5,
      evaluatedAt: "2026-07-17"
    }
  };
}

describe("evidence scoring engine", () => {
  it("scores, ranks, deduplicates, and explains candidates deterministically", () => {
    const result = buildEvidenceScoringResult({
      runId: "scoring-run-1",
      workspaceId: "workspace-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      retrievalResult: buildRetrievalResult(),
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "score-input-checksum-1"
    });

    const required = result.requirementScores.find(
      (item) => item.requirementId === "required-tech"
    );
    const preferred = result.requirementScores.find(
      (item) => item.requirementId === "preferred-cert"
    );
    const responsibility = result.requirementScores.find(
      (item) => item.requirementId === "responsibility-1"
    );

    expect(result.scoringConfigurationVersion).toBe("scott-v1");
    expect(result.scoringEngineVersion).toBe("m4.2.0");
    expect(required?.rankedCandidates).toHaveLength(3);
    expect(required?.rankedCandidates[0]?.candidateId).toBe("candidate-pro");
    expect(required?.rankedCandidates[0]?.finalScore).toBeGreaterThan(
      required?.rankedCandidates[1]?.finalScore ?? 0
    );
    expect(required?.rankedCandidates[0]?.factorContributions.some((item) => item.factorCode === "EXACT_TECHNOLOGY_MATCH")).toBe(true);
    expect(required?.rankedCandidates[0]?.factorContributions.some((item) => item.factorCode === "VERIFIED_METRIC")).toBe(true);
    expect(required?.rankedCandidates[1]?.penaltyContributions.some((item) => item.factorCode === "PROJECT_ONLY")).toBe(true);
    expect(required?.rankedCandidates[1]?.penaltyContributions.some((item) => item.factorCode === "MISSING_DATE")).toBe(true);
    expect(required?.rankedCandidates[1]?.penaltyContributions.some((item) => item.factorCode === "INTERMITTENT_USE")).toBe(true);
    expect(required?.rankedCandidates[2]?.strengthBand).toBe("INELIGIBLE");
    expect(required?.evidenceStrengthState).toBe("STRONG_EVIDENCE");
    expect(preferred?.evidenceStrengthState).toBe("RESTRICTED_ONLY");
    expect(preferred?.rankedCandidates[0]?.penaltyContributions.some((item) => item.factorCode === "EXPIRED_CERTIFICATION")).toBe(true);
    expect(responsibility?.rankedCandidates[0]?.factorContributions.some((item) => item.factorCode === "ARCHITECTURE_CONCEPT_MATCH")).toBe(true);
    expect(
      responsibility?.rankedCandidates[0]?.factorContributions.some(
        (item) => item.factorCode === "LEADERSHIP_MATCH" || item.factorCode === "DOMAIN_MATCH"
      )
    ).toBe(false);
    expect(result.diagnostics.some((item) => item.code === "DUPLICATE_CANDIDATE_MERGED")).toBe(true);
    expect(result.diagnostics.some((item) => item.code === "FACTOR_FAMILY_CAP_APPLIED")).toBe(true);
    expect(result.summary.averageEligibleCandidateScore).not.toBeNull();
    expect(result.summary.requiredStrongEvidenceCount).toBe(1);
    expect(result.summary.restrictedOnlyRequirementCount).toBe(1);
  });

  it("rejects unsuccessful retrieval results", () => {
    const retrievalResult = {
      ...buildRetrievalResult(),
      status: "FAILED" as const
    };

    expect(() =>
      buildEvidenceScoringResult({
        runId: "scoring-run-1",
        workspaceId: "workspace-1",
        evidenceRetrievalRunId: "retrieval-run-1",
        retrievalResult,
        createdAt: "2026-07-17T12:00:00.000Z",
        inputChecksum: "score-input-checksum-1"
      })
    ).toThrow(/only successful evidence retrieval runs can be scored/i);
  });
});
