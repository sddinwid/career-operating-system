import { render, screen } from "@testing-library/react";
import ResumeStudioPage from "@/app/job-descriptions/[jobDescriptionVersionId]/resume/studio/page";

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn()
    })
  };
});

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-revision/service", () => ({
  getResumeRevisionVersionById: vi.fn(async () => ({
    id: "revision-1",
    status: "DRAFT",
    resumeAuditRuns: []
  })),
  openResumeStudio: vi.fn(async () => ({
    mode: "direct",
    revision: {
      id: "revision-1",
      status: "DRAFT",
      resumeAuditRuns: []
    }
  })),
  parseStoredResumeRevisionVersion: vi.fn(async () => ({
    version: {
      id: "revision-1",
      status: "DRAFT",
      resumeAuditRuns: []
    },
    record: {
      content: {
        revisionId: "revision-1",
        workspaceId: "workspace-1",
        baseResumeCompositionVersionId: "composition-1",
        predecessorRevisionId: null,
        structuredResumeVersionId: "structured-1",
        careerProfileVersionId: "career-1",
        requirementAnalysisId: "analysis-1",
        matchReportRunId: "report-1",
        jobDescriptionVersionId: "job-1",
        applicationId: "application-1",
        resumeRevisionContractVersion: "1.0.0",
        resumeRevisionEngineVersion: "m6.1.0",
        resumeRevisionConfigurationVersion: "scott-v1",
        sourceInputChecksum: "composition-checksum-1",
        inputChecksum: "revision-checksum-1",
        createdAt: "2026-07-17T12:00:00.000Z",
        updatedAt: "2026-07-17T12:00:00.000Z",
        status: "DRAFT",
        validationState: "VALID",
        targetCompany: "Acme",
        targetRole: "Senior Platform Engineer",
        targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
        stackFamily: "NODE_TYPESCRIPT_BACKEND",
        pageTarget: 2,
        header: [],
        sectionControls: [
          { sectionType: "HEADER", enabled: true, required: true },
          { sectionType: "PROFESSIONAL_SUMMARY", enabled: true, required: false },
          { sectionType: "CORE_SKILLS", enabled: true, required: false },
          { sectionType: "PROFESSIONAL_EXPERIENCE", enabled: true, required: true },
          { sectionType: "SELECTED_PROJECTS", enabled: false, required: false },
          { sectionType: "EDUCATION", enabled: false, required: false },
          { sectionType: "CERTIFICATIONS", enabled: false, required: false }
        ],
        sectionOrder: { profile: "STANDARD_ENGINEERING", reason: null },
        professionalSummary: {
          enabled: true,
          originalText: "Original summary.",
          currentText: "Original summary.",
          sentences: [],
          noteId: null
        },
        skillsGroups: [],
        professionalExperience: [],
        selectedProjects: [],
        education: [],
        certifications: [],
        sectionEstimates: []
      },
      changeSet: [],
      summary: {
        baseResumeCompositionVersionId: "composition-1",
        predecessorRevisionId: null,
        revisionStatus: "DRAFT",
        editedSummarySentenceCount: 0,
        editedBulletCount: 0,
        includedSkillChanges: 0,
        excludedSkillChanges: 0,
        includedRoleChanges: 0,
        includedProjectChanges: 0,
        reorderedItemCount: 0,
        qualificationCount: 0,
        reviewNoteCount: 0,
        unresolvedFindingCount: 0,
        estimatedPageCount: 1,
        localValidationState: "VALID",
        latestAuditStatus: null,
        changeCount: 0
      },
      diagnostics: [],
      reviewNotes: [],
      findingResolutions: []
    }
  }))
}));

vi.mock("@/lib/resume-audit/service", () => ({
  parseStoredResumeAuditRun: vi.fn()
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  getResumeRenderingApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: false,
    warningAcknowledgementRequired: false,
    sourceType: "FINALIZED_REVISION",
    sourceId: "revision-1",
    resumeAuditRunId: "resume-audit-1",
    renderingReadiness: "READY_FOR_RENDERING",
    warningCount: 0,
    blockingCount: 0,
    contentChecksum: "checksum-1",
    diagnostics: []
  })),
  listResumeRenderingApprovalHistory: vi.fn(async () => [])
}));

describe("ResumeStudioPage", () => {
  it("renders draft controls for a studio revision", async () => {
    const page = await ResumeStudioPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ revisionId: "revision-1" })
    });

    render(page);

    expect(screen.getByText("Resume Studio")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Finalize for Audit" })).toBeVisible();
    expect(screen.getByText("Section Controls")).toBeVisible();
    expect(screen.getByText("Change Summary")).toBeVisible();
  });
});
