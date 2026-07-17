import { render, screen } from "@testing-library/react";
import EvidenceRetrievalPage from "@/app/job-descriptions/[jobDescriptionVersionId]/evidence/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/evidence-retrieval/service", () => ({
  getEvidenceRetrievalContext: vi.fn(async () => ({
    jobDescriptionVersion: {
      opportunity: {
        title: "Senior Platform Engineer",
        company: {
          name: "Acme"
        }
      }
    },
    latestCareerProfileVersion: {
      id: "career-version-1"
    },
    latestConfirmedRequirementAnalysis: {
      id: "analysis-1"
    },
    reusableRun: {
      id: "run-1"
    }
  })),
  parseStoredEvidenceRetrievalRun: vi.fn(async () => ({
    run: {
      id: "run-1",
      applicationId: "application-1",
      engineVersion: "m4.1.0",
      contractVersion: "1.0.0",
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
      createdAt: "2026-07-17T12:00:00.000Z",
      status: "SUCCESS_WITH_WARNINGS",
      diagnostics: [
        {
          severity: "WARNING",
          code: "NO_CANDIDATES",
          message: "No candidate evidence was retrieved for this item.",
          relatedRequirementId: "requirement-gap",
          relatedCandidateId: null
        }
      ],
      summary: {
        totalRequirements: 2,
        includedRequirements: 2,
        excludedRequirements: 0,
        requiredWithCandidates: 1,
        preferredWithCandidates: 0,
        contextualWithCandidates: 0,
        responsibilitiesWithCandidates: 0,
        noCandidateCount: 1,
        limitedCandidateCount: 0,
        restrictedCandidateCount: 1,
        professionalCandidateCount: 1,
        projectCandidateCount: 1,
        educationCandidateCount: 0,
        certificationCandidateCount: 0,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 1,
        diagnosticInfoCount: 0
      },
      requirementResults: [
        {
          requirementId: "requirement-1",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          reviewStatus: "CONFIRMED",
          kinds: ["TECHNOLOGY", "EXPERIENCE"],
          originalText: "PostgreSQL experience required",
          correctedDisplayText: "Production PostgreSQL experience",
          technologies: ["PostgreSQL"],
          experienceText: "5+ years",
          sourceProvenance: {
            sourceSectionId: "section-1",
            parserStatementId: "statement-1",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [
            {
              candidateId: "role:exp_fixture",
              careerEvidenceId: "exp_fixture",
              evidenceType: "ROLE",
              displayTitle: "Software Engineer at Fixture Corp",
              claimText: "Built backend services for internal tools.",
              employer: "Fixture Corp",
              role: "Software Engineer",
              project: null,
              skill: null,
              technologies: ["Python", "PostgreSQL"],
              dateMetadata: {
                startDate: "2022-01",
                endDate: "2024-06",
                lastUsedDate: "2024-06",
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
              matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE"],
              matchedTechnologies: ["PostgreSQL"],
              restrictions: [],
              eligibility: "ELIGIBLE"
            },
            {
              candidateId: "project:project_fixture",
              careerEvidenceId: "project_fixture",
              evidenceType: "PROJECT",
              displayTitle: "Fixture Platform",
              claimText: "Internal Platform",
              employer: null,
              role: null,
              project: "Fixture Platform",
              skill: null,
              technologies: ["Python", "Docker"],
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
                sourceId: "project_fixture",
                sourcePath: "projects[0]"
              },
              retrievalReasons: [
                {
                  code: "ROLE_RESPONSIBILITY_MATCH",
                  explanation: "Responsibility concepts overlap deterministically.",
                  sourceRequirementConcept: "BACKEND_DEVELOPMENT",
                  sourceCareerField: "responsibilities",
                  confidence: "HIGH",
                  matchingRule: "responsibility.concept.dictionary"
                }
              ],
              matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE"],
              matchedTechnologies: [],
              restrictions: [
                {
                  code: "PROJECT_ONLY",
                  explanation: "This candidate comes from project-only evidence."
                },
                {
                  code: "MISSING_DATE",
                  explanation: "This candidate has no usable date metadata."
                }
              ],
              eligibility: "ELIGIBLE_WITH_RESTRICTIONS"
            }
          ],
          excludedEvidence: [],
          diagnostics: [],
          coverageState: "CANDIDATES_FOUND"
        },
        {
          requirementId: "requirement-gap",
          itemType: "REQUIREMENT",
          category: "PREFERRED",
          reviewStatus: "CONFIRMED",
          kinds: ["CERTIFICATION"],
          originalText: "Active cloud certification preferred",
          correctedDisplayText: null,
          technologies: [],
          experienceText: null,
          sourceProvenance: {
            sourceSectionId: "section-2",
            parserStatementId: "statement-2",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [],
          excludedEvidence: [],
          diagnostics: [
            {
              severity: "WARNING",
              code: "NO_CANDIDATES",
              message: "No candidate evidence was retrieved for this item.",
              relatedRequirementId: "requirement-gap",
              relatedCandidateId: null
            }
          ],
          coverageState: "NO_CANDIDATES"
        }
      ],
      recencyPolicy: {
        currentYears: 1,
        recentYears: 3,
        olderYears: 5,
        evaluatedAt: "2026-07-17"
      }
    }
  }))
}));

vi.mock("@/lib/evidence-scoring/service", () => ({
  getEvidenceScoringContext: vi.fn(async () => ({
    reusableScoringRun: {
      id: "scoring-run-1",
      evidenceRetrievalRunId: "run-1",
      configurationVersion: "scott-v1",
      engineVersion: "m4.2.0",
      contractVersion: "1.0.0"
    }
  }))
}));

describe("EvidenceRetrievalPage", () => {
  it("renders the run summary, candidate evidence, and gap summary", async () => {
    const page = await EvidenceRetrievalPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ runId: "run-1" })
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Platform Engineer" })).toBeVisible();
    expect(screen.getByText("SUCCESS WITH WARNINGS")).toBeVisible();
    expect(screen.getByText("career_knowledge_base_fixture_v1.json")).toBeVisible();
    expect(screen.getByText("Production PostgreSQL experience")).toBeVisible();
    expect(screen.getByText("Software Engineer at Fixture Corp")).toBeVisible();
    expect(screen.getAllByText(/Retrieved because:/)).toHaveLength(2);
    expect(screen.getByText(/Restrictions: PROJECT_ONLY, MISSING_DATE/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Gap Summary" })).toBeVisible();
    expect(screen.getAllByText("Active cloud certification preferred")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open application" })).toHaveAttribute(
      "href",
      "/applications/application-1"
    );
    expect(screen.getByRole("link", { name: "View Evidence Scores" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/evidence/scores?runId=scoring-run-1&retrievalRunId=run-1"
    );
    expect(screen.queryByText(/match percentage/i)).not.toBeInTheDocument();
  });
});
