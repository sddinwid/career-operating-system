import { render, screen } from "@testing-library/react";
import JobDescriptionDetailPage from "@/app/job-descriptions/[jobDescriptionVersionId]/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/job-descriptions/service", () => ({
  getJobDescriptionVersionById: vi.fn(async () => ({
    id: "job-description-1",
    versionNumber: 1,
    originalText: "Line one\n\nLine two",
    normalizedText: "Line one\n\nLine two",
    sourceUrl: "https://company.example/jobs/1",
    sourceType: "MANUAL_PASTE",
    capturedAt: new Date("2026-07-15T14:00:00.000Z"),
    publishedAt: new Date("2026-07-14T00:00:00.000Z"),
    checksum: "abcdef1234567890",
    active: false,
    sourceApplication: {
      id: "application-1"
    },
    currentForApplications: [{ id: "application-1" }],
    predecessor: null,
    successors: [],
    opportunity: {
      title: "Senior Engineer",
      company: {
        name: "Acme"
      }
    }
  }))
}));

vi.mock("@/lib/job-descriptions/parse-service", () => ({
  getJobDescriptionAnalysisContext: vi.fn(async () => ({
    latestParse: {
      id: "parse-1",
      status: "SUCCESS_WITH_WARNINGS",
      parserVersion: "m3.2.0"
    },
    latestSuccessfulParse: {
      id: "parse-1"
    },
    latestParseStatusCounts: {
      errors: 0,
      warnings: 1,
      info: 0
    }
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

describe("JobDescriptionDetailPage", () => {
  it("renders the read-only description detail with the superseded label", async () => {
    const page = await JobDescriptionDetailPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Engineer" })).toBeVisible();
    expect(screen.getByText("Superseded")).toBeVisible();
    expect(screen.getByText(/Line one\s+Line two/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open application" })).toHaveAttribute(
      "href",
      "/applications/application-1"
    );
    expect(
      screen.getByRole("link", { name: "View Parsed Job Description" })
    ).toHaveAttribute("href", "/job-descriptions/job-description-1/analysis");
    expect(
      screen.getByRole("link", { name: "Review Requirements" })
    ).toHaveAttribute("href", "/job-descriptions/job-description-1/requirements");
    expect(screen.getByText("SUCCESS WITH WARNINGS")).toBeVisible();
    expect(screen.getByText("NEEDS REVIEW")).toBeVisible();
    expect(screen.getByText("2 required • 1 preferred")).toBeVisible();
  });
});
