import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cover-letter-approval/service", () => ({
  getActiveCoverLetterApproval: vi.fn()
}));

vi.mock("@/lib/cover-letter-audit/service", () => ({
  parseStoredCoverLetterAuditRun: vi.fn()
}));

vi.mock("@/lib/cover-letter-composition/service", () => ({
  parseStoredCoverLetterCompositionVersion: vi.fn()
}));

vi.mock("@/lib/cover-letter-revision/service", () => ({
  parseStoredCoverLetterRevisionVersion: vi.fn()
}));

import { getApprovedCoverLetterForRendering } from "@/lib/cover-letter-rendering/service";
import { getActiveCoverLetterApproval } from "@/lib/cover-letter-approval/service";
import { parseStoredCoverLetterAuditRun } from "@/lib/cover-letter-audit/service";
import { parseStoredCoverLetterCompositionVersion } from "@/lib/cover-letter-composition/service";
import { parseStoredCoverLetterRevisionVersion } from "@/lib/cover-letter-revision/service";

const mockGetActiveCoverLetterApproval = vi.mocked(getActiveCoverLetterApproval);
const mockParseStoredCoverLetterAuditRun = vi.mocked(parseStoredCoverLetterAuditRun);
const mockParseStoredCoverLetterCompositionVersion = vi.mocked(parseStoredCoverLetterCompositionVersion);
const mockParseStoredCoverLetterRevisionVersion = vi.mocked(parseStoredCoverLetterRevisionVersion);

describe("getApprovedCoverLetterForRendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves the exact approved base composition into a canonical render model", async () => {
    mockGetActiveCoverLetterApproval.mockResolvedValue({
      approvalId: "approval-1",
      workspaceId: "workspace-1",
      sourceType: "BASE_COMPOSITION",
      sourceId: "composition-1",
      coverLetterCompositionVersionId: "composition-1",
      coverLetterRevisionVersionId: null,
      coverLetterAuditRunId: "audit-1",
      applicationId: "application-1",
      jobOpportunityId: "job-1",
      jobDescriptionVersionId: "job-description-1",
      predecessorApprovalId: null,
      contractVersion: "1.0.0",
      engineVersion: "m8.2.0",
      configurationVersion: "local-first-v1",
      contentChecksum: "content-1",
      auditInputChecksum: "audit-input-1",
      status: "APPROVED",
      renderingReadiness: "READY_FOR_RENDERING",
      warningAcknowledged: false,
      warningCount: 0,
      blockingCount: 0,
      approvalNote: null,
      warningAcknowledgement: null,
      revocationReason: null,
      approvedAt: "2026-07-20T00:00:00.000Z",
      revokedAt: null,
      supersededAt: null,
      createdAt: "2026-07-20T00:00:00.000Z"
    });
    mockParseStoredCoverLetterAuditRun.mockResolvedValue({
      run: {
        id: "audit-1",
        sourceType: "BASE_COMPOSITION",
        coverLetterCompositionVersionId: "composition-1",
        coverLetterRevisionVersionId: null,
        jobDescriptionVersionId: "job-description-1",
        applicationId: "application-1"
      },
      result: {
        renderingReadiness: "READY_FOR_RENDERING",
        summary: {
          warningCount: 0,
          blockingFindingCount: 0
        }
      }
    } as never);
    mockParseStoredCoverLetterCompositionVersion.mockResolvedValue({
      version: {
        id: "composition-1"
      },
      content: {
        candidateName: "Scott Dinwiddie",
        header: {
          email: "scott@example.com",
          phone: "555-0100",
          location: "Chicago, IL",
          date: "2026-07-20",
          company: "Fieldguide",
          role: "Software Engineer",
          salutation: "Dear Hiring Team,"
        },
        paragraphs: [
          {
            id: "opening-1",
            text: "I am excited to apply for the Software Engineer role at Fieldguide.",
            supportingEvidenceIds: ["evidence-1"],
            supportingRequirementIds: ["requirement-1"],
            supportingMatchReportConclusionIds: ["match-1"],
            sourceCareerRecordIds: ["career-1"],
            sourceResumeSectionIds: ["resume-section-1"],
            acknowledgements: []
          }
        ],
        closing: "Thank you for your consideration.",
        provenance: {
          overallEvidenceIds: ["evidence-1"],
          overallRequirementIds: ["requirement-1"],
          overallCareerRecordIds: ["career-1"]
        }
      }
    } as never);

    const approved = await getApprovedCoverLetterForRendering("workspace-1", {
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1"
    });

    expect(approved.model.company).toBe("Fieldguide");
    expect(approved.model.role).toBe("Software Engineer");
    expect(approved.model.coverLetterRevisionVersionId).toBeNull();
    expect(approved.model.expectedSnippets).toContain("Dear Hiring Team,");
  });

  it("resolves the exact approved finalized revision into ordered revision paragraphs", async () => {
    mockGetActiveCoverLetterApproval.mockResolvedValue({
      approvalId: "approval-2",
      workspaceId: "workspace-1",
      sourceType: "FINALIZED_REVISION",
      sourceId: "revision-1",
      coverLetterCompositionVersionId: "composition-1",
      coverLetterRevisionVersionId: "revision-1",
      coverLetterAuditRunId: "audit-2",
      applicationId: null,
      jobOpportunityId: "job-1",
      jobDescriptionVersionId: "job-description-1",
      predecessorApprovalId: null,
      contractVersion: "1.0.0",
      engineVersion: "m8.2.0",
      configurationVersion: "local-first-v1",
      contentChecksum: "content-2",
      auditInputChecksum: "audit-input-2",
      status: "APPROVED",
      renderingReadiness: "READY_WITH_WARNINGS",
      warningAcknowledged: true,
      warningCount: 1,
      blockingCount: 0,
      approvalNote: null,
      warningAcknowledgement: "I acknowledge the remaining non-blocking warnings.",
      revocationReason: null,
      approvedAt: "2026-07-20T00:00:00.000Z",
      revokedAt: null,
      supersededAt: null,
      createdAt: "2026-07-20T00:00:00.000Z"
    });
    mockParseStoredCoverLetterAuditRun.mockResolvedValue({
      run: {
        id: "audit-2",
        sourceType: "FINALIZED_REVISION",
        coverLetterCompositionVersionId: "composition-1",
        coverLetterRevisionVersionId: "revision-1",
        jobDescriptionVersionId: "job-description-1",
        applicationId: null
      },
      result: {
        renderingReadiness: "READY_WITH_WARNINGS",
        summary: {
          warningCount: 1,
          blockingFindingCount: 0
        }
      }
    } as never);
    mockParseStoredCoverLetterRevisionVersion.mockResolvedValue({
      version: {
        id: "revision-1",
        status: "FINALIZED"
      },
      record: {
        userNotes: "Internal note that should not leak.",
        content: {
          candidateName: "Scott Dinwiddie",
          header: {
            email: "scott@example.com",
            phone: "555-0100",
            location: "Chicago, IL",
            date: "2026-07-20",
            company: "Fieldguide",
            role: "Software Engineer"
          },
          salutation: "Dear Fieldguide Team,",
          closing: "Thank you for your time.",
          overallProvenance: {
            overallEvidenceIds: ["evidence-2"],
            overallRequirementIds: ["requirement-2"],
            overallCareerRecordIds: ["career-2"]
          },
          paragraphs: [
            {
              id: "p2",
              order: 1,
              currentText: "I care about thoughtful product and engineering collaboration.",
              supportingEvidenceIds: [],
              supportingRequirementIds: [],
              supportingMatchReportConclusionIds: [],
              sourceCareerRecordIds: [],
              sourceResumeSectionIds: [],
              acknowledgements: []
            },
            {
              id: "p1",
              order: 0,
              currentText: "I have built TypeScript systems with strong ownership.",
              supportingEvidenceIds: [],
              supportingRequirementIds: [],
              supportingMatchReportConclusionIds: [],
              sourceCareerRecordIds: [],
              sourceResumeSectionIds: [],
              acknowledgements: []
            }
          ]
        }
      }
    } as never);

    const approved = await getApprovedCoverLetterForRendering("workspace-1", {
      jobDescriptionVersionId: "job-description-1"
    });

    expect(approved.model.coverLetterRevisionVersionId).toBe("revision-1");
    expect(approved.model.paragraphs[0]).toContain("TypeScript systems");
    expect(approved.model.warningCount).toBe(1);
  });

  it("rejects approved sources whose audit is no longer render-ready", async () => {
    mockGetActiveCoverLetterApproval.mockResolvedValue({
      approvalId: "approval-3",
      workspaceId: "workspace-1",
      sourceType: "BASE_COMPOSITION",
      sourceId: "composition-1",
      coverLetterCompositionVersionId: "composition-1",
      coverLetterRevisionVersionId: null,
      coverLetterAuditRunId: "audit-3",
      applicationId: null,
      jobOpportunityId: "job-1",
      jobDescriptionVersionId: "job-description-1",
      predecessorApprovalId: null,
      contractVersion: "1.0.0",
      engineVersion: "m8.2.0",
      configurationVersion: "local-first-v1",
      contentChecksum: "content-3",
      auditInputChecksum: "audit-input-3",
      status: "APPROVED",
      renderingReadiness: "READY_FOR_RENDERING",
      warningAcknowledged: false,
      warningCount: 0,
      blockingCount: 0,
      approvalNote: null,
      warningAcknowledgement: null,
      revocationReason: null,
      approvedAt: "2026-07-20T00:00:00.000Z",
      revokedAt: null,
      supersededAt: null,
      createdAt: "2026-07-20T00:00:00.000Z"
    });
    mockParseStoredCoverLetterAuditRun.mockResolvedValue({
      run: {
        id: "audit-3",
        sourceType: "BASE_COMPOSITION",
        coverLetterCompositionVersionId: "composition-1",
        coverLetterRevisionVersionId: null,
        jobDescriptionVersionId: "job-description-1",
        applicationId: null
      },
      result: {
        renderingReadiness: "BLOCKED",
        summary: {
          warningCount: 0,
          blockingFindingCount: 1
        }
      }
    } as never);

    await expect(
      getApprovedCoverLetterForRendering("workspace-1", {
        jobDescriptionVersionId: "job-description-1"
      })
    ).rejects.toThrow(/rendering gate/i);
  });
});
