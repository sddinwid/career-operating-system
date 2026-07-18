import { render, screen } from "@testing-library/react";
import ResumePage from "@/app/job-descriptions/[jobDescriptionVersionId]/resume/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-audit/service", () => ({
  getResumeAuditContext: vi.fn(async () => ({
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

vi.mock("@/lib/document-rendering/service", () => ({
  getLatestRenderedResumeDocumentVersion: vi.fn(async () => null)
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  getResumeRenderingApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: false,
    warningAcknowledgementRequired: false,
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

vi.mock("@/lib/resume-composition/service", () => ({
  getResumeCompositionContext: vi.fn(async () => ({
    reusableResumeCompositionVersion: {
      id: "resume-composition-1"
    }
  })),
  parseStoredResumeCompositionVersion: vi.fn(async () => ({
    version: {
      id: "resume-composition-1",
      structuredResumeVersionId: "structured-resume-1",
      applicationId: "application-1",
      contractVersion: "1.0.0",
      engineVersion: "m5.2.0"
    },
    content: {
      targetRole: "Senior Platform Engineer",
      targetCompany: "Acme",
      status: "READY_WITH_WARNINGS",
      summary: {
        estimatedPageCount: 1.6,
        bulletCount: 4,
        diagnosticWarningCount: 1,
        diagnosticErrorCount: 0,
        diagnosticInfoCount: 0
      },
      header: [
        { field: "EMAIL", value: "fixture@example.com", included: true }
      ],
      professionalSummary: {
        text: "Backend engineer focused on platform services. Improved throughput by 20 percent.",
        sentences: [
          {
            statementId: "summary:1",
            text: "Backend engineer focused on platform services.",
            provenance: {
              templateId: "summary.node_typescript_backend",
              truthfulnessClassification: "VERIFIED_COMPOSITE",
              sourceEvidenceIds: ["exp_fixture"]
            }
          }
        ]
      },
      skillsGroups: [
        {
          groupId: "BACKEND",
          groupLabel: "Backend",
          skills: [{ displayValue: "TypeScript" }]
        }
      ],
      professionalExperience: [
        {
          roleId: "exp_fixture",
          roleTitle: "Senior Engineer",
          employer: "Acme",
          location: "Chicago, IL",
          startDate: "2024-01",
          endDate: "2026-05",
          bullets: [{ statementId: "bullet-1", text: "Improved throughput by 20 percent." }]
        }
      ],
      selectedProjects: [],
      education: [
        {
          educationId: "edu-1",
          degree: "B.S.",
          field: "Computer Science",
          institution: "Example University",
          completionDate: "2018"
        }
      ]
    }
  }))
}));

describe("ResumePage", () => {
  it("renders composed resume content and provenance details", async () => {
    const page = await ResumePage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByText("Targeted resume preview")).toBeVisible();
    expect(screen.getByText("Senior Platform Engineer")).toBeVisible();
    expect(screen.getByText("Professional Summary")).toBeVisible();
    expect(screen.getAllByText(/Improved throughput by 20 percent/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Core Skills")).toBeVisible();
    expect(screen.getByText("Professional Experience")).toBeVisible();
    expect(screen.getByText("Education")).toBeVisible();
    expect(screen.getByText("Diagnostics & Provenance")).toBeVisible();
    expect(screen.getByText("Audit status")).toBeVisible();
    expect(screen.getByText("Rendering readiness")).toBeVisible();
    expect(screen.getByText("Rendering Output")).toBeVisible();
    expect(screen.getByRole("link", { name: "View Resume Audit" })).toHaveAttribute(
      "href",
      "/job-descriptions/job-description-1/resume/audit?runId=resume-audit-1"
    );
  });
});
