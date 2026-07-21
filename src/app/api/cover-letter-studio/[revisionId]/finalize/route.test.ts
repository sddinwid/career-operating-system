import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cover-letter-studio/[revisionId]/finalize/route";
import { finalizeCoverLetterRevision } from "@/lib/cover-letter-revision/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-revision/service", () => ({
  finalizeCoverLetterRevision: vi.fn(),
  CoverLetterRevisionServiceError: class CoverLetterRevisionServiceError extends Error {
    status: number;
    code: string;

    constructor(args: { message: string; status: number; code: string }) {
      super(args.message);
      this.status = args.status;
      this.code = args.code;
    }
  }
}));

const mockFinalizeCoverLetterRevision = vi.mocked(finalizeCoverLetterRevision);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/cover-letter-studio/revision-1/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("cover-letter studio finalize route", () => {
  it("returns the finalized successor and redirect target", async () => {
    mockFinalizeCoverLetterRevision.mockResolvedValueOnce({
      id: "revision-2",
      status: "FINALIZED"
    } as never);

    const response = await POST(
      buildRequest({
        updatedAt: "2026-07-20T12:00:00.000Z",
        returnTo: "/job-descriptions/job-1/cover-letter/studio"
      }),
      {
        params: Promise.resolve({ revisionId: "revision-1" })
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      revisionId: "revision-2",
      status: "FINALIZED",
      redirectTo: "/job-descriptions/job-1/cover-letter/studio?revisionId=revision-2&success=revision-finalized"
    });
  });
});
