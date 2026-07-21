import { render, screen } from "@testing-library/react";
import CoverLetterComparePage from "@/app/job-descriptions/[jobDescriptionVersionId]/cover-letter/compare/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-composition/service", () => ({
  parseStoredCoverLetterCompositionVersion: vi.fn(async () => ({
    version: {
      id: "cover-letter-1"
    },
    content: {
      header: {
        company: "Acme",
        role: "Senior Engineer",
        salutation: "Dear Hiring Team,"
      },
      closing: "Sincerely, Scott",
      paragraphs: [
        {
          id: "opening",
          type: "OPENING",
          text: "I am excited to apply.",
          wordCount: 5,
          purpose: "Opening",
          supportingEvidenceIds: ["evidence-1"],
          supportingRequirementIds: ["req-1"],
          sourceCareerRecordIds: ["career-1"]
        },
        {
          id: "closing-paragraph",
          type: "CLOSING",
          text: "Thank you for your consideration.",
          wordCount: 5,
          purpose: "Closing",
          supportingEvidenceIds: [],
          supportingRequirementIds: [],
          sourceCareerRecordIds: []
        }
      ]
    }
  }))
}));

vi.mock("@/lib/cover-letter-revision/service", () => ({
  parseStoredCoverLetterRevisionVersion: vi.fn(async () => ({
    version: {
      id: "revision-1",
      status: "FINALIZED",
      coverLetterAuditRuns: [
        {
          id: "audit-1",
          renderingReadiness: "READY_WITH_WARNINGS",
          summary: {
            errorCount: 0,
            warningCount: 1,
            infoCount: 2
          }
        }
      ],
      coverLetterApprovals: [
        {
          approvalId: "approval-1",
          status: "APPROVED",
          sourceType: "FINALIZED_REVISION"
        }
      ],
      content: {
        coverLetterCompositionVersionId: "cover-letter-1"
      }
    },
    record: {
      content: {
        header: {
          company: "Acme",
          role: "Senior Engineer"
        },
        salutation: "Dear Hiring Team,",
        closing: "Warm regards, Scott",
        paragraphs: [
          {
            id: "opening",
            type: "OPENING",
            currentText: "I am excited to apply and contribute immediately.",
            wordCount: 8,
            supportingEvidenceIds: ["evidence-1", "evidence-2"],
            supportingRequirementIds: ["req-1"],
            sourceCareerRecordIds: ["career-1"],
            purpose: "Opening"
          }
        ]
      },
      summary: {
        wordCountDelta: 3
      },
      diagnostics: [
        {
          severity: "WARNING",
          code: "TEST_WARNING",
          message: "Example warning."
        }
      ],
      userNotes: "Tightened the opening."
    }
  }))
}));

describe("CoverLetterComparePage", () => {
  it("shows structured paragraph and audit comparison details", async () => {
    const page = await CoverLetterComparePage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-1" }),
      searchParams: Promise.resolve({ revisionId: "revision-1" })
    });

    render(page);

    expect(screen.getByText("Cover-letter comparison")).toBeVisible();
    expect(screen.getByText("Audit comparison")).toBeVisible();
    expect(screen.getByText("Review notes")).toBeVisible();
    expect(screen.getByText("Tightened the opening.")).toBeVisible();
    expect(screen.getByText(/Modified - word delta 3/i)).toBeVisible();
    expect(screen.getByText(/Provenance changed:/i)).toBeVisible();
    expect(screen.getByText("Revision Diagnostics")).toBeVisible();
    expect(screen.getByText("Example warning.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Revision" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-1/cover-letter/studio?revisionId=revision-1"
    );
  });
});
