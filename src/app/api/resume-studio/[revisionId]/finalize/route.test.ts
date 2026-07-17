import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/resume-studio/[revisionId]/finalize/route";
import { finalizeResumeRevision } from "@/lib/resume-revision/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-revision/service", () => ({
  finalizeResumeRevision: vi.fn()
}));

const mockFinalizeResumeRevision = vi.mocked(finalizeResumeRevision);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/resume-studio/revision-1/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("resume studio finalize route", () => {
  it("returns a finalized redirect payload on success", async () => {
    mockFinalizeResumeRevision.mockResolvedValueOnce({
      id: "revision-final",
      status: "READY_FOR_AUDIT"
    } as never);

    const response = await POST(buildRequest({
      updatedAt: "2026-07-17T12:00:00.000Z",
      returnTo: "/job-descriptions/job-1/resume/studio"
    }), {
      params: Promise.resolve({ revisionId: "revision-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      revisionId: "revision-final",
      status: "READY_FOR_AUDIT",
      redirectTo:
        "/job-descriptions/job-1/resume/studio?revisionId=revision-final&success=revision-finalized"
    });
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(buildRequest({
      updatedAt: "not-a-date",
      returnTo: ""
    }), {
      params: Promise.resolve({ revisionId: "revision-1" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid resume revision finalize payload."
    });
  });

  it("returns structured 422 validation errors for blocked revisions", async () => {
    mockFinalizeResumeRevision.mockRejectedValueOnce(
      Object.assign(new Error("Resume revision contains blocking validation findings."), {
        name: "ResumeRevisionValidationError",
        status: 422,
        code: "BLOCKED_VALIDATION"
      })
    );

    const response = await POST(buildRequest({
      updatedAt: "2026-07-17T12:00:00.000Z",
      returnTo: "/job-descriptions/job-1/resume/studio"
    }), {
      params: Promise.resolve({ revisionId: "revision-1" })
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Resume revision contains blocking validation findings.",
      code: "BLOCKED_VALIDATION"
    });
  });
});
