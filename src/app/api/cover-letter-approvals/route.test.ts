import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cover-letter-approvals/route";
import { approveCoverLetterRevision } from "@/lib/cover-letter-approval/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-approval/service", () => ({
  approveCoverLetterRevision: vi.fn(),
  getActiveCoverLetterApproval: vi.fn(async () => null),
  getCoverLetterApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: false,
    warningAcknowledgementRequired: false,
    sourceType: "FINALIZED_REVISION",
    sourceId: "revision-1",
    coverLetterCompositionVersionId: "composition-1",
    coverLetterRevisionVersionId: "revision-1",
    coverLetterAuditRunId: "audit-1",
    renderingReadiness: "READY_FOR_RENDERING",
    warningCount: 0,
    blockingCount: 0,
    contentChecksum: "checksum-1",
    diagnostics: []
  })),
  listCoverLetterApprovalHistory: vi.fn(async () => []),
  CoverLetterApprovalServiceError: class CoverLetterApprovalServiceError extends Error {
    status: number;
    code: string;
    diagnostics?: unknown[];

    constructor(args: { message: string; status: number; code: string; diagnostics?: unknown[] }) {
      super(args.message);
      this.status = args.status;
      this.code = args.code;
      this.diagnostics = args.diagnostics;
    }
  }
}));

const mockApproveCoverLetterRevision = vi.mocked(approveCoverLetterRevision);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/cover-letter-approvals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("cover-letter approvals route", () => {
  it("returns approval payloads on success", async () => {
    mockApproveCoverLetterRevision.mockResolvedValueOnce({
      duplicate: false,
      approval: {
        approvalId: "approval-1",
        workspaceId: "workspace-1",
        sourceType: "FINALIZED_REVISION",
        sourceId: "revision-1",
        coverLetterCompositionVersionId: "composition-1",
        coverLetterRevisionVersionId: "revision-1",
        coverLetterAuditRunId: "audit-1",
        applicationId: "application-1",
        jobOpportunityId: "opportunity-1",
        jobDescriptionVersionId: "job-1",
        predecessorApprovalId: null,
        contractVersion: "1.0.0",
        engineVersion: "m8.2.0",
        configurationVersion: "scott-v1",
        contentChecksum: "checksum-1",
        auditInputChecksum: "audit-checksum-1",
        status: "APPROVED",
        renderingReadiness: "READY_FOR_RENDERING",
        warningAcknowledged: false,
        warningCount: 0,
        blockingCount: 0,
        approvalNote: null,
        warningAcknowledgement: null,
        revocationReason: null,
        approvedAt: "2026-07-20T12:00:00.000Z",
        revokedAt: null,
        supersededAt: null,
        createdAt: "2026-07-20T12:00:00.000Z"
      }
    } as never);

    const response = await POST(
      buildRequest({
        jobDescriptionVersionId: "job-1",
        applicationId: "application-1",
        sourceType: "FINALIZED_REVISION",
        sourceId: "revision-1",
        coverLetterAuditRunId: "audit-1",
        expectedContentChecksum: "checksum-1"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      duplicate: false,
      approval: {
        approvalId: "approval-1",
        sourceType: "FINALIZED_REVISION"
      }
    });
  });
});
