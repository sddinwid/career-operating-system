import { render, screen } from "@testing-library/react";
import JobDetailPage from "@/app/jobs/[jobOpportunityId]/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/jobs/service", () => ({
  getJobWorkspaceDetail: vi.fn(async () => ({
    opportunity: {
      id: "job-1",
      title: "Senior Engineer",
      jobUrl: "https://company.example/jobs/1",
      source: "LinkedIn",
      location: "Remote",
      workArrangement: "REMOTE",
      capturedAt: new Date("2026-07-10T00:00:00.000Z"),
      company: {
        name: "Acme"
      },
      applications: [
        {
          id: "application-1",
          status: "APPLIED",
          createdAt: new Date("2026-07-11T00:00:00.000Z")
        }
      ],
      jobDescriptionVersions: [
        {
          id: "job-description-1",
          versionNumber: 1,
          active: true,
          capturedAt: new Date("2026-07-12T00:00:00.000Z"),
          createdAt: new Date("2026-07-12T00:00:00.000Z"),
          sourceUrl: "https://company.example/jobs/1",
          currentForApplications: [{ id: "application-1" }],
          parses: [{ id: "parse-1", status: "SUCCESS", parserVersion: "m3.2.5", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          requirementAnalyses: [{ id: "analysis-1", status: "CONFIRMED", classifierVersion: "m3.3.3", confirmedAt: new Date("2026-07-12T00:00:00.000Z"), createdAt: new Date("2026-07-12T00:00:00.000Z"), analysis: {} }],
          evidenceRetrievalRuns: [{ id: "retrieval-1", status: "SUCCESS", summary: {}, createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          evidenceScoringRuns: [{ id: "scoring-1", status: "SUCCESS", evidenceRetrievalRunId: "retrieval-1", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          matchReportRuns: [{ id: "report-1", status: "SUCCESS", evidenceScoringRunId: "scoring-1", summary: {}, createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          structuredResumeVersions: [{ id: "plan-1", status: "READY", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          coverLetterCompositionVersions: [{ id: "cover-letter-1", status: "SUCCESS", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          coverLetterRevisionVersions: [{ id: "cover-letter-revision-1", status: "FINALIZED", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          coverLetterAuditRuns: [{ id: "cover-letter-audit-1", status: "SUCCESS", renderingReadiness: "READY_WITH_WARNINGS", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          coverLetterApprovals: [{ id: "cover-letter-approval-1", status: "APPROVED", renderingReadiness: "READY_WITH_WARNINGS", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          resumeCompositionVersions: [{ id: "resume-1", status: "READY", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          resumeAuditRuns: [{ id: "resume-audit-1", status: "PASSED", result: {}, createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          resumeRenderingApprovals: [{ id: "resume-approval-1", renderingReadiness: "READY_FOR_RENDERING", createdAt: new Date("2026-07-12T00:00:00.000Z") }],
          documentVersions: []
        }
      ]
    },
    summary: {
      linkedApplication: {
        id: "application-1"
      },
      currentJobDescription: {
        id: "job-description-1"
      },
      statusLabels: {
        parse: "SUCCESS",
        requirement: "CONFIRMED",
        readiness: "Ready",
        retrieval: "Evidence retrieved",
        scoring: "Evidence scored",
        matchReport: "Match report generated",
        plan: "Structured plan generated",
        coverLetterComposition: "Cover letter composed",
        coverLetterRevision: "Finalized revision available",
        coverLetterAudit: "Ready with warnings",
        coverLetterApproval: "Approved with warnings",
        composition: "Resume composed",
        audit: "Ready for rendering",
        approval: "Approved for rendering"
      }
    }
  }))
}));

describe("JobDetailPage", () => {
  it("shows cover-letter lifecycle state and navigation", async () => {
    const page = await JobDetailPage({
      params: Promise.resolve({ jobOpportunityId: "job-1" })
    });

    render(page);

    expect(screen.getByText("Cover letter composition")).toBeVisible();
    expect(screen.getByText("Cover letter revision")).toBeVisible();
    expect(screen.getByRole("link", { name: "Cover letter" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/cover-letter?versionId=cover-letter-1"
    );
    expect(screen.getByRole("link", { name: "Cover letter studio" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/cover-letter/studio?revisionId=cover-letter-revision-1"
    );
    expect(screen.getByRole("link", { name: "Cover letter comparison" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/cover-letter/compare?revisionId=cover-letter-revision-1"
    );
    expect(screen.getByRole("link", { name: "Cover letter audit" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/cover-letter/audit?runId=cover-letter-audit-1"
    );
    expect(screen.getByText(/Cover letter approval: READY WITH WARNINGS/i)).toBeVisible();
  });
});
