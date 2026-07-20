import { render, screen } from "@testing-library/react";
import CoverLetterPage from "@/app/job-descriptions/[jobDescriptionVersionId]/cover-letter/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-composition/service", () => ({
  getCoverLetterCompositionContext: vi.fn(async () => ({
    reusableMatchReportRun: {
      id: "match-report-1"
    },
    reusableCoverLetterCompositionVersion: {
      id: "cover-letter-1"
    },
    compositionReady: true
  })),
  parseStoredCoverLetterCompositionVersion: vi.fn(async () => ({
    version: {
      id: "cover-letter-1",
      matchReportRunId: "match-report-1",
      requirementAnalysisId: "analysis-1",
      applicationId: "application-1",
      contractVersion: "1.0.0",
      engineVersion: "m8.1.0",
      configurationVersion: "scott-v1"
    },
    content: {
      status: "SUCCESS_WITH_WARNINGS",
      candidateName: "Fixture Candidate",
      header: {
        email: "fixture@example.com",
        phone: "555-0100",
        location: "Chicago, IL",
        date: "2026-07-20",
        company: "Acme",
        role: "Senior Platform Engineer",
        salutation: "Dear Hiring Team,"
      },
      summary: {
        wordCount: 292,
        paragraphCount: 5,
        warningCount: 1,
        resumeOverlapRatio: 0.12,
        resumeSourceUsed: true
      },
      paragraphs: [
        {
          id: "opening",
          type: "OPENING",
          purpose: "Introduce the role.",
          text: "I'm interested in the Senior Platform Engineer role at Acme because it combines backend ownership with practical delivery.",
          wordCount: 18,
          supportingEvidenceIds: ["evidence-1"],
          supportingRequirementIds: ["req-1"],
          supportingMatchReportConclusionIds: ["theme-1"],
          sourceCareerRecordIds: ["role-1"],
          sourceResumeSectionIds: [],
          acknowledgements: [],
          claims: [],
          technologies: ["TypeScript"],
          companyReferences: ["Acme"],
          roleReferences: ["Senior Platform Engineer"],
          diagnostics: []
        }
      ],
      closing: "I'd welcome the chance to talk through how my background could support this work.",
      diagnostics: [
        {
          severity: "INFO",
          code: "PROFESSIONAL_EVIDENCE_PRIORITIZED",
          message: "Professional evidence was prioritized.",
          relatedRequirementId: null,
          relatedCandidateId: null
        }
      ],
      provenance: {
        resumeSource: {
          sourceType: "BASE_COMPOSITION",
          sourceId: "resume-composition-1",
          sourceInputChecksum: "checksum-1",
          plainText: "Backend engineer summary text."
        }
      }
    }
  }))
}));

describe("CoverLetterPage", () => {
  it("renders the read-only preview, provenance, and diagnostics", async () => {
    const page = await CoverLetterPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByText("Deterministic cover-letter preview")).toBeVisible();
    expect(screen.getByText("Senior Platform Engineer")).toBeVisible();
    expect(screen.getByText("Dear Hiring Team,")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Match Report" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/match-report?runId=match-report-1"
    );
    expect(screen.getByText("Cover Letter Preview")).toBeVisible();
    expect(screen.getByText("Paragraph Provenance")).toBeVisible();
    expect(screen.getByText("Diagnostics")).toBeVisible();
    expect(screen.getByText(/PROFESSIONAL_EVIDENCE_PRIORITIZED/)).toBeVisible();
  });
});
