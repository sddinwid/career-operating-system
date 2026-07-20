import { render, screen } from "@testing-library/react";
import JobsPage from "@/app/jobs/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/jobs/service", () => ({
  listJobWorkspaceSummaries: vi.fn(async () => [
    {
      id: "job-1",
      companyName: "Fieldguide",
      title: "Software Engineer (All Levels)",
      canonicalUrl: "https://www.fieldguide.io/careers/software-engineer-all-levels",
      location: "Remote",
      workArrangement: "REMOTE",
      linkedApplication: null,
      currentJobDescription: {
        id: "jd-1",
        versionNumber: 1,
        capturedAt: new Date("2026-07-18T12:00:00.000Z")
      },
      latestParse: {
        id: "parse-1",
        status: "SUCCESS_WITH_WARNINGS",
        parserVersion: "m3.2.4"
      },
      latestSuccessfulParse: {
        id: "parse-1",
        status: "SUCCESS_WITH_WARNINGS",
        parserVersion: "m3.2.4"
      },
      latestAnalysis: {
        id: "analysis-1",
        status: "CONFIRMED",
        classifierVersion: "m3.3.2"
      },
      latestConfirmedAnalysis: {
        id: "analysis-1",
        status: "CONFIRMED",
        classifierVersion: "m3.3.2"
      },
      downstreamReadiness: "READY",
      retrievalRun: {
        id: "retrieval-1"
      },
      scoringRun: {
        id: "score-1",
        evidenceRetrievalRunId: "retrieval-1"
      },
      matchReportRun: {
        id: "report-1",
        evidenceScoringRunId: "score-1"
      },
      structuredResume: null,
      resumeComposition: null,
      resumeAudit: null,
      renderingApproval: null,
      latestDocx: null,
      latestPdf: null,
      statusLabels: {
        parse: "SUCCESS WITH WARNINGS",
        requirement: "CONFIRMED",
        readiness: "Ready",
        retrieval: "Evidence retrieved",
        scoring: "Evidence scored",
        matchReport: "Resume generation ready",
        plan: "Blocked",
        composition: "Blocked",
        audit: "Blocked",
        approval: "Blocked"
      }
    }
  ])
}));

describe("JobsPage", () => {
  it("renders discoverable Fieldguide workflow state and unlinked application messaging", async () => {
    const page = await JobsPage({
      searchParams: Promise.resolve({})
    });
    render(page);

    expect(screen.getByRole("heading", { name: /Browse saved opportunities/i })).toBeVisible();
    expect(screen.getByText("Fieldguide")).toBeVisible();
    expect(screen.getByText("Software Engineer (All Levels)")).toBeVisible();
    expect(screen.getByText("No application linked")).toBeVisible();
    expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("link", { name: "View parsed analysis" })).toHaveAttribute(
      "href",
      "/job-descriptions/jd-1/analysis"
    );
  });
});
