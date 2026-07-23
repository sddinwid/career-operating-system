import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/job-descriptions/fetch-url/route";
import {
  fetchJobDescriptionFromUrl,
  JobDescriptionUrlFetchError
} from "@/lib/job-descriptions/url-fetch";

vi.mock("@/lib/job-descriptions/url-fetch", () => ({
  fetchJobDescriptionFromUrl: vi.fn(),
  JobDescriptionUrlFetchError: class JobDescriptionUrlFetchError extends Error {
    status: number;
    diagnostics: unknown[];

    constructor(status: number, message: string, diagnostics: unknown[] = []) {
      super(message);
      this.status = status;
      this.diagnostics = diagnostics;
    }
  }
}));

const mockFetchJobDescriptionFromUrl = vi.mocked(fetchJobDescriptionFromUrl);

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/job-descriptions/fetch-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("job description fetch-url route", () => {
  beforeEach(() => {
    mockFetchJobDescriptionFromUrl.mockReset();
  });

  it("returns validated fetch previews", async () => {
    mockFetchJobDescriptionFromUrl.mockResolvedValueOnce({
      requestedUrl: "https://example.com/jobs/123",
      finalUrl: "https://example.com/jobs/123",
      resolvedUrl: null,
      status: 200,
      contentType: "text/html",
      retrievedAt: "2026-07-21T12:00:00.000Z",
      pageTitle: "Platform Engineer",
      extractorVersion: "m8.4.0",
      resolverVersion: null,
      provenance: "STATIC_DOM",
      extractionChecksum: "a".repeat(64),
      extractedText: "Build reliable systems.",
      diagnostics: []
    });

    const response = await POST(buildRequest({ url: "https://example.com/jobs/123" }));

    expect(response.status).toBe(200);
    expect(mockFetchJobDescriptionFromUrl).toHaveBeenCalledWith(
      "https://example.com/jobs/123",
      {
        allowRenderedFallback: true
      }
    );
    await expect(response.json()).resolves.toMatchObject({
      finalUrl: "https://example.com/jobs/123",
      extractionChecksum: "a".repeat(64)
    });
  });

  it("rejects invalid URLs before hitting the fetcher", async () => {
    const response = await POST(buildRequest({ url: "not-a-url" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Please provide a valid public URL."
    });
    expect(mockFetchJobDescriptionFromUrl).not.toHaveBeenCalled();
  });

  it("returns sanitized fetcher errors and diagnostics", async () => {
    mockFetchJobDescriptionFromUrl.mockRejectedValueOnce(
      new JobDescriptionUrlFetchError(422, "The fetched page did not contain enough usable job-description text.", [
        {
          code: "NO_JOB_CONTENT_FOUND",
          level: "ERROR",
          message: "The fetched page did not contain enough usable job-description text."
        }
      ])
    );

    const response = await POST(buildRequest({ url: "https://example.com/jobs/123" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "The fetched page did not contain enough usable job-description text.",
      diagnostics: [expect.objectContaining({ code: "NO_JOB_CONTENT_FOUND" })]
    });
  });

  it("marks retryable rendered fallback responses explicitly", async () => {
    mockFetchJobDescriptionFromUrl.mockRejectedValueOnce(
      new JobDescriptionUrlFetchError(
        409,
        "The initial page did not include the job description. Trying the rendered page...",
        [
          {
            code: "RENDERED_FALLBACK_RECOMMENDED",
            level: "INFO",
            message:
              "The initial page did not include the job description. Trying the rendered page..."
          }
        ]
      )
    );

    const response = await POST(
      buildRequest({ url: "https://example.com/jobs/123", allowRenderedFallback: false })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      retryableWithRenderedFallback: true,
      diagnostics: [expect.objectContaining({ code: "RENDERED_FALLBACK_RECOMMENDED" })]
    });
    expect(mockFetchJobDescriptionFromUrl).toHaveBeenCalledWith(
      "https://example.com/jobs/123",
      {
        allowRenderedFallback: false
      }
    );
  });

  it("returns a generic browser-facing error for unexpected failures", async () => {
    mockFetchJobDescriptionFromUrl.mockRejectedValueOnce(
      new Error("socket hang up: https://secret.example")
    );

    const response = await POST(buildRequest({ url: "https://example.com/jobs/123" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The job posting could not be fetched right now."
    });
  });
});
