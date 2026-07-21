import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cover-letter-approvals/[approvalId]/revoke/route";
import { revokeCoverLetterApproval } from "@/lib/cover-letter-approval/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-approval/service", () => ({
  revokeCoverLetterApproval: vi.fn(async () => ({
    approvalId: "approval-1"
  })),
  getActiveCoverLetterApproval: vi.fn(async () => null),
  getCoverLetterApprovalEligibility: vi.fn(async () => null),
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

const mockRevokeCoverLetterApproval = vi.mocked(revokeCoverLetterApproval);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/cover-letter-approvals/approval-1/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("cover-letter approval revoke route", () => {
  it("returns a success payload on revoke", async () => {
    mockRevokeCoverLetterApproval.mockResolvedValueOnce({
      approvalId: "approval-1",
      status: "REVOKED"
    } as never);

    const response = await POST(
      buildRequest({
        approvalId: "approval-1",
        expectedActiveApprovalId: "approval-1",
        reason: "Pause approval",
        jobDescriptionVersionId: "job-1",
        applicationId: "application-1",
        sourceType: "FINALIZED_REVISION",
        sourceId: "revision-1",
        coverLetterAuditRunId: "audit-1"
      }),
      {
        params: Promise.resolve({ approvalId: "approval-1" })
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeApproval: null,
      history: []
    });
  });
});
