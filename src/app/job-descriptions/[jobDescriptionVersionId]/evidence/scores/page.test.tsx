import { render, screen } from "@testing-library/react";
import EvidenceScoringPage from "@/app/job-descriptions/[jobDescriptionVersionId]/evidence/scores/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/evidence-scoring/service", () => ({
  getEvidenceScoringContext: vi.fn(async () => ({
    jobDescriptionVersion: {
      opportunity: {
        title: "Senior Platform Engineer",
        company: {
          name: "Acme"
        }
      }
    },
    reusableScoringRun: {
      id: "scoring-run-1"
    }
  })),
  parseStoredEvidenceScoringRun: vi.fn(async () => ({
    run: {
      id: "scoring-run-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      applicationId: "application-1",
      engineVersion: "m4.2.0",
      contractVersion: "1.0.0",
      configurationVersion: "scott-v1",
      careerProfileVersion: {
        id: "career-version-1",
        sourceFilename: "career_knowledge_base_fixture_v1.json"
      },
      requirementAnalysis: {
        id: "analysis-1",
        classifierVersion: "m3.3.0"
      }
    },
    result: {
      runId: "scoring-run-1",
      workspaceId: "workspace-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      evidenceRetrievalInputChecksum: "retrieval-input-checksum-1",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1",
      retrievalContractVersion: "1.0.0",
      scoringContractVersion: "1.0.0",
      scoringEngineVersion: "m4.2.0",
      scoringConfigurationVersion: "scott-v1",
      inputChecksum: "score-input-checksum-1",
      createdAt: "2026-07-17T12:00:00.000Z",
      status: "SUCCESS_WITH_WARNINGS",
      retrievalStatus: "SUCCESS_WITH_WARNINGS",
      diagnostics: [
        {
          severity: "WARNING",
          code: "REQUIRED_REQUIREMENT_HAS_NO_ELIGIBLE_EVIDENCE",
          message: "Required requirement has no eligible evidence after scoring.",
          relatedRequirementId: "requirement-gap",
          relatedCandidateId: null
        }
      ],
      summary: {
        requirementsScored: 2,
        requiredStrongEvidenceCount: 1,
        requiredGoodEvidenceCount: 0,
        requiredLimitedOrWeakEvidenceCount: 0,
        requiredNoEvidenceCount: 0,
        preferredStrongOrGoodEvidenceCount: 0,
        restrictedOnlyRequirementCount: 1,
        noEvidenceRequirementCount: 0,
        averageEligibleCandidateScore: 78,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 1,
        diagnosticInfoCount: 0
      },
      scoringConfiguration: {
        version: "scott-v1"
      },
      requirementScores: [
        {
          requirementId: "requirement-1",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          requirementImportance: 1,
          kinds: ["TECHNOLOGY", "EXPERIENCE"],
          originalText: "PostgreSQL experience required",
          correctedDisplayText: "Production PostgreSQL experience",
          evidenceStrengthState: "STRONG_EVIDENCE",
          highestCandidateScore: 78,
          eligibleCandidateCount: 2,
          restrictedCandidateCount: 1,
          ineligibleCandidateCount: 0,
          diagnostics: [],
          rankedCandidates: [
            {
              candidateId: "role:exp_fixture",
              careerEvidenceId: "exp_fixture",
              displayTitle: "Software Engineer at Fixture Corp",
              claimText: "Built backend services for internal tools.",
              evidenceType: "ROLE",
              context: "PROFESSIONAL",
              recency: "RECENT",
              recordKind: "SOURCE_FACT",
              confirmationState: "SOURCE_PROVIDED",
              metricVerificationState: "VERIFIED",
              employer: "Fixture Corp",
              role: "Software Engineer",
              project: null,
              skill: null,
              technologies: ["Python", "PostgreSQL"],
              matchedTechnologies: ["PostgreSQL"],
              matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE"],
              dateMetadata: {
                startDate: "2022-01",
                endDate: "2024-06",
                lastUsedDate: "2024-06",
                datePrecision: "MONTH"
              },
              sourceProvenance: {
                sourceSection: "professionalExperience",
                sourceId: "exp_fixture",
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
                }
              ],
              restrictions: [],
              eligibility: "ELIGIBLE",
              visibleForDiagnostics: true,
              exclusionReasons: [],
              finalScore: 78,
              unclampedScore: 78,
              strengthBand: "STRONG",
              rank: 1,
              directRelationshipStrength: 3,
              factorContributions: [
                {
                  factorCode: "EXACT_TECHNOLOGY_MATCH",
                  label: "Exact technology match",
                  value: 22,
                  explanation: "PostgreSQL matches PostgreSQL.",
                  sourceRelationship: "technology.exact",
                  configurationWeight: 22,
                  capped: false,
                  ruleIdentifier: "factor.exact-technology"
                }
              ],
              penaltyContributions: [
                {
                  factorCode: "PROJECT_ONLY",
                  label: "PROJECT ONLY",
                  value: -5,
                  explanation: "This candidate comes from project-only evidence.",
                  sourceRelationship: "candidate.restrictions",
                  configurationWeight: -5,
                  capped: false,
                  ruleIdentifier: "penalty.project_only"
                }
              ]
            }
          ]
        },
        {
          requirementId: "requirement-gap",
          itemType: "REQUIREMENT",
          category: "PREFERRED",
          requirementImportance: 0.75,
          kinds: ["CERTIFICATION"],
          originalText: "Active cloud certification preferred",
          correctedDisplayText: null,
          evidenceStrengthState: "RESTRICTED_ONLY",
          highestCandidateScore: null,
          eligibleCandidateCount: 0,
          restrictedCandidateCount: 0,
          ineligibleCandidateCount: 1,
          diagnostics: [
            {
              severity: "WARNING",
              code: "CURRENT_CERTIFICATION_ONLY_EXPIRED_EVIDENCE",
              message: "Certification evidence exists, but it is expired or otherwise restricted.",
              relatedRequirementId: "requirement-gap",
              relatedCandidateId: null
            }
          ],
          rankedCandidates: []
        }
      ]
    }
  }))
}));

describe("EvidenceScoringPage", () => {
  it("renders the scoring summary and ranked candidates without an overall match percentage", async () => {
    const page = await EvidenceScoringPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ runId: "scoring-run-1" })
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Platform Engineer" })).toBeVisible();
    expect(screen.getByText("scott-v1")).toBeVisible();
    expect(screen.getByText("Production PostgreSQL experience")).toBeVisible();
    expect(screen.getByText(/Score 78/)).toBeVisible();
    expect(screen.getByText("Positive Factors")).toBeVisible();
    expect(screen.getByText("Penalties")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Restricted Only" })).toBeVisible();
    expect(screen.queryByText(/match percentage/i)).not.toBeInTheDocument();
  });
});
