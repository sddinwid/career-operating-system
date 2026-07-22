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
      engineVersion: "m4.3.1",
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
      matchReportEngineVersion: "m4.3.1",
      matchReportConfigurationVersion: "scott-v1",
      scoringContractVersion: "1.0.0",
      scoringEngineVersion: "m4.2.1",
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
          strongestAlignmentLabel: "REST API Design",
          componentConclusions: [
            {
              componentId: "component-rest",
              label: "REST API Design",
              competencyId: "rest-api-design",
              competencyName: "REST API Design",
              supportState: "STRONG_DIRECT_SUPPORT",
              gapStatus: "SUPPORTED",
              strongestEvidenceLabel: "Senior Engineer - Acme",
              strongestEvidenceClusterId: "cluster-rest",
              strongestEvidenceCandidateId: "candidate-1",
              restrictionLabels: [],
              resumeGuidance: "Include REST API experience."
            }
          ],
          topEvidenceClusters: [
            {
              clusterId: "cluster-rest",
              primaryCandidateId: "candidate-1",
              primaryLabel: "Senior Engineer - Acme",
              evidenceType: "RESPONSIBILITY",
              context: "PROFESSIONAL",
              employer: "Acme",
              role: "Senior Engineer",
              project: null,
              recency: "CURRENT",
              technologies: ["TypeScript"],
              relatedRepresentationIds: ["candidate-1", "candidate-1-metric"],
              relatedRepresentationLabels: ["Related representation"],
              restrictionLabels: []
            }
          ],
          explanation: "Strong evidence supports this requirement.",
          resumeUseGuidance: "Supported for targeted resume composition at the demonstrated level.",
          provenance: {
            scoringRequirementId: "req-1",
            evidenceScoringRunId: "scoring-run-1"
          }
        },
        {
          requirementId: "req-2",
          requirementText: "Low-latency systems",
          category: "REQUIRED",
          kinds: ["EXPERIENCE"],
          evidenceStrengthState: "LIMITED_EVIDENCE",
          highestCandidateScore: 42,
          highestCandidateStrengthBand: "LIMITED",
          topCandidateIds: ["candidate-2"],
          professionalEvidenceCount: 1,
          projectEvidenceCount: 0,
          restrictedEvidenceCount: 0,
          gapTypes: ["INDIRECT_EVIDENCE_ONLY"],
          criticality: "MATERIAL",
          conclusionCode: "MATERIAL_GAP",
          strongestAlignmentLabel: "Throughput Optimization",
          componentConclusions: [
            {
              componentId: "component-throughput",
              label: "Throughput Optimization",
              competencyId: "throughput-optimization",
              competencyName: "Throughput Optimization",
              supportState: "GOOD_DIRECT_SUPPORT",
              gapStatus: "SUPPORTED",
              strongestEvidenceLabel: "Senior Engineer - Acme",
              strongestEvidenceClusterId: "cluster-throughput",
              strongestEvidenceCandidateId: "candidate-2",
              restrictionLabels: [],
              resumeGuidance:
                "Prioritize throughput optimization, but do not imply low-latency engineering."
            },
            {
              componentId: "component-latency",
              label: "Low-Latency Systems",
              competencyId: "latency-reduction",
              competencyName: "Low-Latency Systems",
              supportState: "NO_QUALIFYING_EVIDENCE",
              gapStatus: "UNSUPPORTED",
              strongestEvidenceLabel: null,
              strongestEvidenceClusterId: null,
              strongestEvidenceCandidateId: null,
              restrictionLabels: [],
              resumeGuidance: "Do not imply low-latency engineering unless direct evidence exists."
            }
          ],
          topEvidenceClusters: [
            {
              clusterId: "cluster-throughput",
              primaryCandidateId: "candidate-2",
              primaryLabel: "Senior Engineer - Acme",
              evidenceType: "ACCOMPLISHMENT",
              context: "PROFESSIONAL",
              employer: "Acme",
              role: "Senior Engineer",
              project: null,
              recency: "RECENT",
              technologies: ["Python"],
              relatedRepresentationIds: ["candidate-2", "candidate-2-story"],
              relatedRepresentationLabels: ["Related representation"],
              restrictionLabels: []
            }
          ],
          explanation:
            "Strongest support comes from Senior Engineer - Acme. Supports Throughput Optimization, but not Low-Latency Systems.",
          resumeUseGuidance:
            "Prioritize throughput optimization, but do not imply low-latency engineering.",
          provenance: {
            scoringRequirementId: "req-2",
            evidenceScoringRunId: "scoring-run-1"
          }
        },
        {
          requirementId: "resp-1",
          requirementText: "Lead architecture reviews",
          category: "RESPONSIBILITY",
          kinds: ["LEADERSHIP"],
          evidenceStrengthState: "LIMITED_EVIDENCE",
          highestCandidateScore: 38,
          highestCandidateStrengthBand: "LIMITED",
          topCandidateIds: ["candidate-3"],
          professionalEvidenceCount: 0,
          projectEvidenceCount: 1,
          restrictedEvidenceCount: 1,
          gapTypes: ["PROJECT_ONLY"],
          criticality: "MINOR",
          conclusionCode: "PROJECT_SUPPORTED",
          explanation: "Only project-based evidence currently supports this requirement.",
          resumeUseGuidance:
            "If used, label it clearly as project evidence rather than professional evidence.",
          provenance: {
            scoringRequirementId: "resp-1",
            evidenceScoringRunId: "scoring-run-1"
          }
        }
      ],
      strengths: [
        {
          strengthId: "strength:req-1:typescript",
          requirementIds: ["req-1"],
          strengthCategory: "REST API Design",
          explanation: "Strong evidence supports this requirement.",
          supportingEvidenceIds: ["candidate-1"],
          supportingEvidenceLabels: ["Senior Engineer - Acme"],
          supportingEvidenceClusterIds: ["cluster-rest"],
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
          requirementText: "Low-latency systems",
          gapType: "INDIRECT_EVIDENCE_ONLY",
          severity: "MATERIAL",
          explanation:
            "Strongest support comes from Senior Engineer - Acme. Supports Throughput Optimization, but not Low-Latency Systems.",
          strongestRelatedEvidenceLabels: ["Senior Engineer - Acme"],
          componentConclusions: [
            {
              componentId: "component-throughput",
              label: "Throughput Optimization",
              competencyId: "throughput-optimization",
              competencyName: "Throughput Optimization",
              supportState: "GOOD_DIRECT_SUPPORT",
              gapStatus: "SUPPORTED",
              strongestEvidenceLabel: "Senior Engineer - Acme",
              strongestEvidenceClusterId: "cluster-throughput",
              strongestEvidenceCandidateId: "candidate-2",
              restrictionLabels: [],
              resumeGuidance:
                "Prioritize throughput optimization, but do not imply low-latency engineering."
            },
            {
              componentId: "component-latency",
              label: "Low-Latency Systems",
              competencyId: "latency-reduction",
              competencyName: "Low-Latency Systems",
              supportState: "NO_QUALIFYING_EVIDENCE",
              gapStatus: "UNSUPPORTED",
              strongestEvidenceLabel: null,
              strongestEvidenceClusterId: null,
              strongestEvidenceCandidateId: null,
              restrictionLabels: [],
              resumeGuidance: "Do not imply low-latency engineering unless direct evidence exists."
            }
          ],
          availableRestrictedEvidence: [],
          availableProjectEvidence: [],
          availableStaleEvidence: [],
          resumeWarning:
            "Prioritize throughput optimization, but do not imply low-latency engineering.",
          interviewWarning: "Be ready to explain the limitation around low-latency systems.",
          provenance: {
            evidenceScoringRunId: "scoring-run-1",
            scoringRequirementIds: ["req-2"]
          }
        },
        {
          riskId: "risk:resp-1:minor",
          requirementIds: ["resp-1"],
          requirementText: "Lead architecture reviews",
          gapType: "PROJECT_ONLY",
          severity: "MINOR",
          explanation: "Only project-based evidence currently supports this requirement.",
          availableRestrictedEvidence: ["candidate-3"],
          availableProjectEvidence: ["candidate-3"],
          availableStaleEvidence: [],
          resumeWarning:
            "If used, label it clearly as project evidence rather than professional evidence.",
          interviewWarning:
            "Be ready to explain the limitation around lead architecture reviews.",
          provenance: {
            evidenceScoringRunId: "scoring-run-1",
            scoringRequirementIds: ["resp-1"]
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
            displayLabel: "Senior Engineer - Acme",
            recencyLabel: "2024-01 to 2026-05",
            supportedRequirementIds: ["req-1"],
            strongEvidenceCount: 1,
            relevantTechnologies: ["TypeScript"],
            relevantAccomplishments: ["Led production TypeScript services."],
            emphasisReason: "Senior Engineer - Acme supports REST API Design."
          }
        ],
        projectsToConsider: [],
        claimsToAvoid: [
          {
            concept: "Low-Latency Systems",
            reason: "Do not imply low-latency engineering unless direct evidence exists.",
            missingOrRestrictedEvidenceIds: ["candidate-2"],
            truthfulnessRule:
              "Do not overclaim unsupported, stale, expired, or project-only evidence as current professional support.",
            handling: "OMIT"
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
    expect(screen.getAllByText("REST API Design").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Required Gaps" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Responsibility Limitations" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Preferred Gaps" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Contextual Gaps" })).toBeVisible();
    expect(
      screen.getAllByText(/Supports Throughput Optimization, but not Low-Latency Systems./).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Prioritize throughput optimization/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Resume Guidance" })).toBeVisible();
    expect(screen.getAllByText(/Low-Latency Systems/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Senior Engineer - Acme/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Technical details").length).toBeGreaterThan(0);
    expect(screen.getByText(/not a hiring probability/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open application" })).toHaveAttribute(
      "href",
      "/applications/application-1"
    );
  });
});
