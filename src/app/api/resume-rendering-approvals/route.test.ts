import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/resume-rendering-approvals/route";
import { approveResumeForRendering } from "@/lib/resume-rendering-approval/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  approveResumeForRendering: vi.fn(),
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  getResumeRenderingApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: false,
    warningAcknowledgementRequired: false,
    sourceType: "FINALIZED_REVISION",
    sourceId: "revision-1",
    resumeAuditRunId: "audit-1",
    renderingReadiness: "READY_FOR_RENDERING",
    warningCount: 0,
    blockingCount: 0,
    contentChecksum: "checksum-1",
    diagnostics: []
  })),
  listResumeRenderingApprovalHistory: vi.fn(async () => []),
  ResumeRenderingApprovalServiceError: class ResumeRenderingApprovalServiceError extends Error {
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

const mockApproveResumeForRendering = vi.mocked(approveResumeForRendering);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/resume-rendering-approvals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("resume rendering approvals route", () => {
  it("returns approval payloads on success", async () => {
    mockApproveResumeForRendering.mockResolvedValueOnce({
      duplicate: false,
      approval: {
        approvalId: "approval-1",
        workspaceId: "workspace-1",
        resumeArtifactType: "RESUME",
        sourceType: "FINALIZED_REVISION",
        sourceId: "revision-1",
        resumeCompositionVersionId: null,
        resumeRevisionVersionId: "revision-1",
        resumeAuditRunId: "audit-1",
        structuredResumeVersionId: "structured-1",
        careerProfileVersionId: "career-1",
        matchReportRunId: "match-1",
        requirementAnalysisId: "analysis-1",
        jobDescriptionVersionId: "job-1",
        applicationId: "application-1",
        predecessorApprovalId: null,
        approverType: "WORKSPACE_OWNER",
        contractVersion: "1.0.0",
        engineVersion: "m6.2.0",
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
        approvedAt: "2026-07-17T12:00:00.000Z",
        revokedAt: null,
        supersededAt: null,
        createdAt: "2026-07-17T12:00:00.000Z"
      }
    } as never);

    const response = await POST(
      buildRequest({
        jobDescriptionVersionId: "job-1",
        applicationId: "application-1",
        sourceType: "FINALIZED_REVISION",
        sourceId: "revision-1",
        resumeAuditRunId: "audit-1",
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
