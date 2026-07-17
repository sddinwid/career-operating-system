import { render, screen } from "@testing-library/react";
import ResumeAuditPage from "@/app/job-descriptions/[jobDescriptionVersionId]/resume/audit/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-audit/service", () => ({
  getResumeAuditContext: vi.fn(async () => ({
    reusableResumeAuditRun: {
      id: "resume-audit-1"
    }
  })),
  parseStoredResumeAuditRun: vi.fn(async () => ({
    run: {
      id: "resume-audit-1",
      applicationId: "application-1",
      resumeCompositionVersionId: "resume-composition-1",
      structuredResumeVersionId: "structured-resume-1",
      matchReportRunId: "match-report-1",
      matchReportRun: {
        evidenceScoringRunId: "scoring-run-1",
        evidenceRetrievalRunId: "retrieval-run-1"
      },
      requirementAnalysisId: "analysis-1",
      contractVersion: "1.0.0",
      engineVersion: "m5.3.0",
      configurationVersion: "scott-v1"
    },
    result: {
      status: "PASSED_WITH_WARNINGS",
      renderingReadiness: "READY_WITH_WARNINGS",
      summary: {
        errorCount: 0,
        warningCount: 2,
        statementsVerified: 6,
        pageBudgetStatus: "WITHIN_TARGET"
      },
      sectionResults: [
        {
          sectionType: "PROFESSIONAL_SUMMARY",
          renderingReadiness: "READY_WITH_WARNINGS",
          warningFindingIds: ["summary.short"],
          errorFindingIds: []
        }
      ],
      statementResults: [
        {
          statementId: "summary:1",
          section: "PROFESSIONAL_SUMMARY",
          provenanceStatus: "VALID",
          truthfulnessStatus: "VERIFIED_COMPOSITE",
          renderingEligibility: "WARN",
          findingIds: ["summary.short"]
        }
      ],
      findings: [
        {
          findingId: "summary.short",
          ruleId: "summary.short",
          severity: "WARNING",
          category: "SEVEN_SECOND_SCAN",
          message: "Summary is shorter than the preferred minimum.",
          statementId: "summary:1",
          section: "PROFESSIONAL_SUMMARY",
          sourceEvidenceIds: [],
          sourceCareerRecordIds: [],
          requirementIds: [],
          actualValue: "9 words",
          expectedCondition: "35+ words",
          renderingImpact: "Warning only.",
          suggestedHandling: "Review upstream.",
          provenance: {
            templateId: "summary.role",
            sourcePath: null
          },
          blocksRendering: false,
          userReviewable: true
        }
      ]
    }
  }))
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  getResumeRenderingApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: true,
    warningAcknowledgementRequired: true,
    sourceType: "BASE_COMPOSITION",
    sourceId: "resume-composition-1",
    resumeAuditRunId: "resume-audit-1",
    renderingReadiness: "READY_WITH_WARNINGS",
    warningCount: 2,
    blockingCount: 0,
    contentChecksum: "checksum-1",
    diagnostics: []
  })),
  listResumeRenderingApprovalHistory: vi.fn(async () => [])
}));

describe("ResumeAuditPage", () => {
  it("renders the audit decision, findings, and provenance links", async () => {
    const page = await ResumeAuditPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByText("Resume audit report")).toBeVisible();
    expect(screen.getAllByText("READY WITH WARNINGS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Warnings").length).toBeGreaterThan(0);
    expect(screen.getByText(/Summary is shorter than the preferred minimum/i)).toBeVisible();
    expect(screen.getByText("Section Results")).toBeVisible();
    expect(screen.getByText("Statement Findings")).toBeVisible();
    expect(screen.getByRole("link", { name: "Resume Composition" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/resume?versionId=resume-composition-1"
    );
  });
});
