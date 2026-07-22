import { describe, expect, it } from "vitest";
import { buildEvidenceRetrievalPageViewModel } from "@/lib/evidence-retrieval/presentation";
import type { EvidenceRetrievalResult } from "@/lib/evidence-retrieval/contract";

function createResult(overrides?: Partial<EvidenceRetrievalResult>): EvidenceRetrievalResult {
  return {
    runId: "run-1",
    workspaceId: "workspace-1",
    careerProfileVersionId: "career-version-1",
    requirementAnalysisId: "analysis-1",
    jobDescriptionVersionId: "job-description-1",
    applicationId: "application-1",
    retrievalContractVersion: "1.0.0",
    retrievalEngineVersion: "m4.1.0",
    careerSourceChecksum: "career-checksum-1",
    requirementSourceChecksum: "requirement-checksum-1",
    inputChecksum: "input-checksum-1",
    createdAt: "2026-07-22T12:00:00.000Z",
    status: "SUCCESS_WITH_WARNINGS",
    diagnostics: [],
    summary: {
      totalRequirements: 1,
      includedRequirements: 1,
      excludedRequirements: 0,
      requiredWithCandidates: 1,
      preferredWithCandidates: 0,
      contextualWithCandidates: 0,
      responsibilitiesWithCandidates: 0,
      noCandidateCount: 0,
      limitedCandidateCount: 0,
      restrictedCandidateCount: 0,
      professionalCandidateCount: 1,
      projectCandidateCount: 0,
      educationCandidateCount: 0,
      certificationCandidateCount: 0,
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      diagnosticInfoCount: 0
    },
    requirementResults: [],
    recencyPolicy: {
      currentYears: 1,
      recentYears: 3,
      olderYears: 5,
      evaluatedAt: "2026-07-22"
    },
    ...overrides
  };
}

describe("buildEvidenceRetrievalPageViewModel", () => {
  it("marks partial technology bundles as limited support and exposes per-technology coverage", () => {
    const result = createResult({
      requirementResults: [
        {
          requirementId: "requirement-1",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          reviewStatus: "CONFIRMED",
          kinds: ["TECHNOLOGY", "ARCHITECTURE"],
          originalText:
            "TypeScript, React, Node.js, Python, and GraphQL experience preferred",
          correctedDisplayText:
            "TypeScript, React, Node.js, Python, and GraphQL experience preferred",
          technologies: ["TypeScript", "React", "Node.js", "Python", "GraphQL"],
          experienceText: null,
          sourceProvenance: {
            sourceSectionId: "section-1",
            parserStatementId: "statement-1",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [
            {
              candidateId: "candidate-1",
              careerEvidenceId: "candidate-1",
              evidenceType: "RESPONSIBILITY",
              displayTitle: "Professional platform delivery",
              claimText: "Built TypeScript and React services with Node.js in production.",
              employer: "Acme",
              role: "Senior Engineer",
              project: null,
              skill: null,
              technologies: ["TypeScript", "React", "Node.js"],
              dateMetadata: {
                startDate: "2024-01",
                endDate: "2026-01",
                lastUsedDate: "2026-01",
                datePrecision: "MONTH"
              },
              recency: "CURRENT",
              context: "PROFESSIONAL",
              confirmationState: "VERIFIED",
              recordKind: "SOURCE_FACT",
              metric: null,
              metricVerificationState: null,
              sourceProvenance: {
                sourceSection: "employment",
                sourceId: "employment-1",
                sourcePath: "employment[0].responsibilities[0]"
              },
              retrievalReasons: [
                {
                  code: "EXACT_TECHNOLOGY_MATCH",
                  explanation: "TypeScript matches TypeScript.",
                  sourceRequirementConcept: "TypeScript",
                  sourceCareerField: "technologies",
                  confidence: "HIGH",
                  matchingRule: "technology.canonical.exact"
                }
              ],
              matchedRequirementKinds: ["TECHNOLOGY", "ARCHITECTURE"],
              matchedTechnologies: ["TypeScript", "React", "Node.js"],
              restrictions: [],
              eligibility: "ELIGIBLE"
            },
            {
              candidateId: "candidate-2",
              careerEvidenceId: "candidate-2",
              evidenceType: "PROJECT",
              displayTitle: "Search prototype",
              claimText: "Built a Python-based retrieval prototype.",
              employer: null,
              role: null,
              project: "Search prototype",
              skill: null,
              technologies: ["Python"],
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
              metric: null,
              metricVerificationState: null,
              sourceProvenance: {
                sourceSection: "projects",
                sourceId: "project-1",
                sourcePath: "projects[0]"
              },
              retrievalReasons: [
                {
                  code: "EXACT_TECHNOLOGY_MATCH",
                  explanation: "Python matches Python.",
                  sourceRequirementConcept: "Python",
                  sourceCareerField: "technologies",
                  confidence: "HIGH",
                  matchingRule: "technology.canonical.exact"
                }
              ],
              matchedRequirementKinds: ["TECHNOLOGY"],
              matchedTechnologies: ["Python"],
              restrictions: [
                {
                  code: "PROJECT_ONLY",
                  explanation: "This candidate comes from project-only evidence."
                }
              ],
              eligibility: "ELIGIBLE_WITH_RESTRICTIONS"
            }
          ],
          excludedEvidence: [],
          diagnostics: [],
          coverageState: "CANDIDATES_FOUND"
        }
      ]
    });

    const viewModel = buildEvidenceRetrievalPageViewModel(result);
    const item = viewModel.required[0]!;

    expect(item.supportState).toBe("LIMITED_SUPPORT");
    expect(item.bundleCoverage).toEqual(
      expect.arrayContaining([
        { technology: "TypeScript", status: "SUPPORTED" },
        { technology: "React", status: "SUPPORTED" },
        { technology: "Node.js", status: "SUPPORTED" },
        { technology: "Python", status: "RESTRICTED" },
        { technology: "GraphQL", status: "UNSUPPORTED" }
      ])
    );
  });

  it("uses exact gap language for restricted project-only evidence", () => {
    const result = createResult({
      requirementResults: [
        {
          requirementId: "requirement-2",
          itemType: "REQUIREMENT",
          category: "PREFERRED",
          reviewStatus: "CONFIRMED",
          kinds: ["DATA"],
          originalText: "Document ingestion and retrieval experience",
          correctedDisplayText: null,
          technologies: [],
          experienceText: null,
          sourceProvenance: {
            sourceSectionId: "section-2",
            parserStatementId: "statement-2",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [
            {
              candidateId: "candidate-project",
              careerEvidenceId: "candidate-project",
              evidenceType: "ARCHITECTURE",
              displayTitle: "AI Knowledge Search Platform",
              claimText: "Designed document ingestion and semantic retrieval workflows.",
              employer: null,
              role: null,
              project: "AI Knowledge Search Platform",
              skill: null,
              technologies: ["PostgreSQL"],
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
              metric: null,
              metricVerificationState: null,
              sourceProvenance: {
                sourceSection: "projects",
                sourceId: "project-2",
                sourcePath: "projects[1].architecture[0]"
              },
              retrievalReasons: [
                {
                  code: "DATA_MATCH",
                  explanation: "Data, ingestion, or retrieval evidence overlaps deterministically.",
                  sourceRequirementConcept: "SEARCH_RETRIEVAL",
                  sourceCareerField: "data",
                  confidence: "HIGH",
                  matchingRule: "data.concept.dictionary"
                }
              ],
              matchedRequirementKinds: ["DATA"],
              matchedTechnologies: [],
              restrictions: [
                {
                  code: "PROJECT_ONLY",
                  explanation: "This candidate comes from project-only evidence."
                }
              ],
              eligibility: "ELIGIBLE_WITH_RESTRICTIONS"
            }
          ],
          excludedEvidence: [],
          diagnostics: [],
          coverageState: "LIMITED_CANDIDATES"
        }
      ]
    });

    const viewModel = buildEvidenceRetrievalPageViewModel(result);
    const item = viewModel.preferred[0]!;

    expect(item.supportState).toBe("RESTRICTED_SUPPORT_ONLY");
    expect(item.supportExplanation).toBe(
      "Direct project evidence exists, but no qualifying professional evidence was found."
    );
  });

  it("returns a serializable section model for the client explorer", () => {
    const result = createResult({
      requirementResults: [
        {
          requirementId: "requirement-3",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          reviewStatus: "CONFIRMED",
          kinds: ["TECHNOLOGY"],
          originalText: "PostgreSQL experience",
          correctedDisplayText: null,
          technologies: ["PostgreSQL"],
          experienceText: null,
          sourceProvenance: {
            sourceSectionId: "section-3",
            parserStatementId: "statement-3",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [],
          excludedEvidence: [],
          diagnostics: [],
          coverageState: "NO_CANDIDATES"
        }
      ]
    });

    const viewModel = buildEvidenceRetrievalPageViewModel(result);
    const serialized = JSON.parse(JSON.stringify(viewModel));

    expect(serialized.sections).toEqual([
      {
        id: "required",
        title: "Required",
        description:
          "Highest-priority required requirements, ranked with the strongest evidence first.",
        items: serialized.required
      },
      {
        id: "preferred",
        title: "Preferred",
        description:
          "Preferred requirements with direct, related, or restricted support called out explicitly.",
        items: []
      },
      {
        id: "contextual",
        title: "Contextual",
        description: "Contextual expectations and guidance from the reviewed requirement set.",
        items: []
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        description: "Responsibility statements and the strongest retrieved evidence for each one.",
        items: []
      },
      {
        id: "excluded",
        title: "Excluded",
        description: "Traceability for items intentionally kept out of downstream retrieval.",
        items: []
      }
    ]);
    expect(serialized.technicalDetails.recencyPolicyLabel).toBe(
      "1/3/5 year bands as of 2026-07-22"
    );
  });
});
