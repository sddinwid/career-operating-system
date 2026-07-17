import { render, screen } from "@testing-library/react";
import ApplicationDetailPage from "@/app/applications/[applicationId]/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/applications/actions", () => ({
  archiveApplicationAction: vi.fn(),
  restoreApplicationAction: vi.fn()
}));

vi.mock("@/lib/applications/service", () => ({
  getApplicationDetail: vi.fn(async () => ({
    id: "application-1",
    status: "APPLIED",
    appliedAt: new Date("2026-07-10T15:00:00.000Z"),
    jobSearchDate: new Date("2026-07-10T00:00:00.000Z"),
    priority: "HIGH",
    notes: "Existing notes",
    archivedAt: null,
    opportunity: {
      title: "Senior Engineer",
      source: "LinkedIn",
      location: "Remote",
      workArrangement: "REMOTE",
      salaryMin: 150000,
      salaryMax: 170000,
      salaryCurrency: "USD",
      company: {
        name: "Acme"
      },
      _count: {
        jobDescriptionVersions: 2
      }
    },
    currentJobDescriptionVersion: {
      id: "job-description-2",
      versionNumber: 2,
      originalText: "Build systems.\n\nLead projects.",
      sourceUrl: "https://company.example/jobs/1",
      sourceType: "MANUAL_PASTE",
      capturedAt: new Date("2026-07-15T14:00:00.000Z"),
      active: true,
      checksum: "abcdef1234567890",
      parses: [
        {
          id: "parse-1",
          status: "SUCCESS_WITH_WARNINGS",
          parserVersion: "m3.2.0",
          createdAt: new Date("2026-07-16T12:00:00.000Z")
        }
      ]
    },
    statusHistoryEntries: []
  }))
}));

vi.mock("@/lib/job-descriptions/requirement-analysis-service", () => ({
  getJobRequirementAnalysisContext: vi.fn(async () => ({
    latestAnalysis: {
      status: "NEEDS_REVIEW"
    },
    latestConfirmedAnalysis: null,
    latestAnalysisContract: {
      summary: {
        requiredCount: 2,
        preferredCount: 1
      }
    }
  }))
}));

vi.mock("@/lib/evidence-retrieval/service", () => ({
  getEvidenceRetrievalContext: vi.fn(async () => ({
    latestCareerProfileVersion: {
      id: "career-version-1"
    },
    latestConfirmedRequirementAnalysis: null,
    reusableRun: null
  }))
}));

vi.mock("@/lib/evidence-scoring/service", () => ({
  getEvidenceScoringContext: vi.fn(async () => ({
    reusableScoringRun: {
      id: "scoring-run-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      configurationVersion: "scott-v1",
      engineVersion: "m4.2.0",
      contractVersion: "1.0.0"
    }
  }))
}));

vi.mock("@/lib/match-report/service", () => ({
  getMatchReportContext: vi.fn(async () => ({
    reusableMatchReportRun: {
      id: "report-run-1",
      evidenceScoringRunId: "scoring-run-1",
      configurationVersion: "scott-v1",
      engineVersion: "m4.3.0",
      contractVersion: "1.0.0",
      summary: {
        matchTier: "GOOD_ALIGNMENT",
        pursuitRecommendation: "APPLY",
        resumeReadinessState: "READY_WITH_LIMITATIONS",
        criticalRequiredGapCount: 0,
        strongRequiredCount: 2
      }
    }
  }))
}));

vi.mock("@/lib/structured-resume/service", () => ({
  getStructuredResumeContext: vi.fn(async () => ({
    planningReady: true,
    reusableStructuredResumeVersion: {
      id: "structured-resume-1",
      matchReportRunId: "report-run-1",
      summary: {
        targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
        selectedRoles: 2,
        selectedProjects: 1,
        budgetStatus: "WITHIN_TARGET"
      }
    }
  })),
  getStructuredResumeVersionById: vi.fn(async () => ({
    id: "structured-resume-1",
    inputChecksum: "structured-input-checksum",
    careerProfileVersionId: "career-version-1",
    status: "READY",
    careerProfileVersion: {
      checksum: "career-source-checksum"
    }
  }))
}));

vi.mock("@/lib/resume-composition/service", () => ({
  getResumeCompositionContext: vi.fn(async () => ({
    compositionReady: true,
    reusableStructuredResumeVersion: {
      id: "structured-resume-1"
    },
    reusableResumeCompositionVersion: {
      id: "resume-composition-1",
      summary: {
        estimatedPageCount: 1.6,
        bulletCount: 5,
        diagnosticWarningCount: 1
      }
    }
  }))
}));

vi.mock("@/lib/resume-audit/service", () => ({
  getResumeAuditContext: vi.fn(async () => ({
    auditReady: true,
    reusableResumeAuditRun: {
      id: "resume-audit-1",
      status: "PASSED_WITH_WARNINGS",
      summary: {
        renderingReadiness: "READY_WITH_WARNINGS",
        errorCount: 0,
        warningCount: 2
      }
    }
  }))
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  listResumeRenderingApprovalHistory: vi.fn(async () => [])
}));

describe("ApplicationDetailPage", () => {
  it("shows the job-description summary and replacement actions", async () => {
    const page = await ApplicationDetailPage({
      params: Promise.resolve({ applicationId: "application-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByText("Job description")).toBeVisible();
    expect(screen.getByText("2 versions")).toBeVisible();
    expect(screen.getByRole("link", { name: "View version" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2"
    );
    expect(
      screen.getByRole("link", { name: "View Parsed Job Description" })
    ).toHaveAttribute("href", "/job-descriptions/job-description-2/analysis");
    expect(screen.getByRole("link", { name: "Review Requirements" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2/requirements"
    );
    expect(screen.getByText("SUCCESS WITH WARNINGS")).toBeVisible();
    expect(screen.getByText("NEEDS REVIEW")).toBeVisible();
    expect(screen.getByText(/2 required/i)).toBeVisible();
    expect(screen.getByText("Evidence Scored")).toBeVisible();
    expect(screen.getByText("Resume Generation Ready With Limitations")).toBeVisible();
    expect(screen.getByText("GOOD ALIGNMENT")).toBeVisible();
    expect(screen.getByText("Structured Resume Plan Generated")).toBeVisible();
    expect(screen.getByText("Targeted Resume Composed")).toBeVisible();
    expect(screen.getByText(/NODE TYPESCRIPT BACKEND/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "View Match Report" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2/match-report?runId=report-run-1&scoringRunId=scoring-run-1"
    );
    expect(screen.getByRole("link", { name: "View Structured Resume Plan" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2/resume-plan?versionId=structured-resume-1&matchReportRunId=report-run-1"
    );
    expect(screen.getByRole("link", { name: "View Targeted Resume" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2/resume?versionId=resume-composition-1"
    );
    expect(screen.getByRole("link", { name: "View Resume Audit" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-2/resume/audit?runId=resume-audit-1"
    );
    expect(screen.getByText("Resume Audit Complete")).toBeVisible();
    expect(screen.getByText(/READY WITH WARNINGS/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Replace Job Description" })).toHaveAttribute(
      "href",
      "/applications/application-1/job-description"
    );
  });
});
