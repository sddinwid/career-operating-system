import { render, screen } from "@testing-library/react";
import MatchReportPage from "@/app/job-descriptions/[jobDescriptionVersionId]/match-report/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/match-report/service", () => ({
  getMatchReportContext: vi.fn(async () => ({
    jobDescriptionVersion: {
      opportunity: {
        title: "Senior Platform Engineer",
        company: {
          name: "Acme"
        }
      }
    },
    reusableMatchReportRun: {
      id: "report-run-1"
    }
  })),
  parseStoredMatchReportRun: vi.fn(async () => ({
    run: {
      id: "report-run-1",
      applicationId: "application-1",
      contractVersion: "1.0.0",
      engineVersion: "m4.3.0",
      configurationVersion: "scott-v1",
      evidenceScoringRunId: "scoring-run-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      requirementAnalysisId: "analysis-1"
    },
    result: {
      runId: "report-run-1",
      workspaceId: "workspace-1",
      evidenceScoringRunId: "scoring-run-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      scoringInputChecksum: "scoring-input-checksum-1",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1",
      matchReportContractVersion: "1.0.0",
      matchReportEngineVersion: "m4.3.0",
      matchReportConfigurationVersion: "scott-v1",
      scoringContractVersion: "1.0.0",
      scoringEngineVersion: "m4.2.0",
      inputChecksum: "report-input-checksum-1",
      createdAt: "2026-07-17T12:00:00.000Z",
      status: "SUCCESS_WITH_WARNINGS",
      scoringStatus: "SUCCESS_WITH_WARNINGS",
      diagnostics: [],
      summary: {
        matchTier: "GOOD_ALIGNMENT",
        pursuitRecommendation: "APPLY",
        resumeReadinessState: "READY_WITH_LIMITATIONS",
        alignmentIndex: 67,
        requiredRequirementCount: 3,
        preferredRequirementCount: 1,
        responsibilityCount: 1,
        strongRequiredCount: 1,
        goodRequiredCount: 1,
        limitedRequiredCount: 0,
        weakRequiredCount: 0,
        requiredNoEvidenceCount: 1,
        requiredRestrictedOnlyCount: 0,
        criticalRequiredGapCount: 0,
        materialRequiredGapCount: 1,
        professionalCoreSupportCount: 2,
        projectOnlySupportCount: 1,
        staleSupportCount: 0,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 1,
        diagnosticInfoCount: 1
      },
      reportConfiguration: {},
      requirementConclusions: [
        {
          requirementId: "req-1",
          requirementText: "Production TypeScript experience",
          category: "REQUIRED",
          kinds: ["TECHNOLOGY"],
          evidenceStrengthState: "STRONG_EVIDENCE",
          highestCandidateScore: 94,
          highestCandidateStrengthBand: "STRONG",
          topCandidateIds: ["candidate-1"],
          professionalEvidenceCount: 1,
          projectEvidenceCount: 0,
          restrictedEvidenceCount: 0,
          gapTypes: ["NONE"],
          criticality: "NONE",
          conclusionCode: "CORE_STRENGTH",
          explanation: "Strong evidence supports this requirement.",
          resumeUseGuidance: "Safe to prioritize this in targeted resume composition.",
          provenance: {
            scoringRequirementId: "req-1",
            evidenceScoringRunId: "scoring-run-1"
          }
        }
      ],
      strengths: [
        {
          strengthId: "strength:req-1:typescript",
          requirementIds: ["req-1"],
          strengthCategory: "TypeScript",
          explanation: "Strong evidence supports this requirement.",
          supportingEvidenceIds: ["candidate-1"],
          evidenceContext: "PROFESSIONAL",
          technologies: ["TypeScript"],
          confidence: "HIGH",
          resumeRelevance: "PRIMARY"
        }
      ],
      risksAndGaps: [
        {
          riskId: "risk:req-2:material",
          requirementIds: ["req-2"],
          gapType: "PROJECT_ONLY",
          severity: "MATERIAL",
          explanation: "Only project-based evidence currently supports this requirement.",
          availableRestrictedEvidence: [],
          availableProjectEvidence: ["candidate-project"],
          availableStaleEvidence: [],
          resumeWarning:
            "If used, label it clearly as project evidence rather than professional evidence.",
          interviewWarning: "Be ready to explain the limitation around aws experience.",
          provenance: {
            evidenceScoringRunId: "scoring-run-1",
            scoringRequirementIds: ["req-2"]
          }
        }
      ],
      resumeGuidance: {
        priorityEvidenceThemes: [
          {
            themeId: "theme:typescript",
            label: "TypeScript",
            supportingRequirementIds: ["req-1"],
            supportingEvidenceIds: ["candidate-1"],
            strength: "STRONG",
            professionalSupportCount: 1,
            projectSupportCount: 0
          }
        ],
        priorityTechnologies: [
          {
            technology: "TypeScript",
            requirementImportance: 1,
            evidenceStrengthState: "STRONG_EVIDENCE",
            professionalEvidenceCount: 1,
            recency: "CURRENT",
            guidance: "INCLUDE"
          }
        ],
        rolesToEmphasize: [
          {
            roleId: "candidate-1",
            employer: "Acme",
            roleTitle: "Senior Engineer",
            supportedRequirementIds: ["req-1"],
            strongEvidenceCount: 1,
            relevantTechnologies: ["TypeScript"],
            relevantAccomplishments: ["Led production TypeScript services."],
            emphasisReason:
              "Professional evidence from Senior Engineer at Acme supports multiple report conclusions."
          }
        ],
        projectsToConsider: [],
        claimsToAvoid: [
          {
            concept: "AWS experience",
            reason: "Only project-based evidence currently supports this requirement.",
            missingOrRestrictedEvidenceIds: ["candidate-project"],
            truthfulnessRule:
              "Do not overclaim unsupported, stale, expired, or project-only evidence as current professional support.",
            handling: "PROJECT_ONLY"
          }
        ]
      }
    }
  }))
}));

vi.mock("@/lib/structured-resume/service", () => ({
  getStructuredResumeContext: vi.fn(async () => ({
    planningReady: true,
    reusableMatchReportRun: {
      id: "report-run-1"
    },
    reusableStructuredResumeVersion: null
  }))
}));

vi.mock("@/lib/cover-letter-composition/service", () => ({
  getCoverLetterCompositionContext: vi.fn(async () => ({
    compositionReady: true,
    reusableMatchReportRun: {
      id: "report-run-1"
    },
    reusableCoverLetterCompositionVersion: null
  }))
}));

describe("MatchReportPage", () => {
  it("renders the decision summary, strengths, gaps, and structured guidance", async () => {
    const page = await MatchReportPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ runId: "report-run-1" })
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Platform Engineer" })).toBeVisible();
    expect(screen.getByText("GOOD ALIGNMENT")).toBeVisible();
    expect(screen.getByText("READY WITH LIMITATIONS")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Strongest Alignment Areas" })).toBeVisible();
    expect(screen.getByText("TypeScript")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Required Gaps" })).toBeVisible();
    expect(
      screen.getByText(/Only project-based evidence currently supports this requirement./)
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Resume Guidance" })).toBeVisible();
    expect(screen.getByText(/AWS experience/i)).toBeVisible();
    expect(screen.getByText(/not a hiring probability/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open application" })).toHaveAttribute(
      "href",
      "/applications/application-1"
    );
  });
});
