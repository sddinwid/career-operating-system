import dns from "node:dns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJobDescriptionFromUrl } from "@/lib/job-descriptions/url-fetch";

const lookupMock = vi.spyOn(dns.promises, "lookup");

function mockSafeLookup() {
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
}

describe("fetchJobDescriptionFromUrl", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    mockSafeLookup();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts JobPosting JSON-LD content and returns an extraction checksum", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>Platform Engineer</title>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"JobPosting","description":"<p>${"Build resilient TypeScript APIs and improve deployment safety across backend services. ".repeat(6)}</p>"}
            </script>
          </head>
          <body><main>Fallback body text</main></body>
        </html>`,
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/123");

    expect(result.pageTitle).toBe("Platform Engineer");
    expect(result.extractedText).toContain(
      "Build resilient TypeScript APIs and improve deployment safety across backend services."
    );
    expect(result.extractionChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "JSON_LD_JOB_POSTING_USED" })
      ])
    );
  });

  it("blocks private and loopback destinations after DNS resolution", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);

    await expect(fetchJobDescriptionFromUrl("https://example.com/jobs/123")).rejects.toMatchObject({
      status: 403,
      message: "That destination resolves to a blocked private or local address."
    });
  });

  it("rejects unsupported content types", async () => {
    global.fetch = vi.fn(async () =>
      new Response("binary", {
        status: 200,
        headers: {
          "content-type": "application/pdf"
        }
      })
    ) as typeof global.fetch;

    await expect(fetchJobDescriptionFromUrl("https://example.com/jobs/123")).rejects.toMatchObject({
      status: 415,
      diagnostics: [expect.objectContaining({ code: "CONTENT_TYPE_UNSUPPORTED" })]
    });
  });

  it("reports JavaScript, access-denied, and challenge diagnostics for weak pages", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<html><body><main>${"Enable JavaScript to continue. Access denied. Verify you are human. ".repeat(8)}</main></body></html>`,
        {
          status: 200,
          headers: {
            "content-type": "text/html"
          }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/123");

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PAGE_REQUIRES_JAVASCRIPT" }),
        expect.objectContaining({ code: "ACCESS_DENIED" }),
        expect.objectContaining({ code: "CAPTCHA_OR_BOT_CHALLENGE" })
      ])
    );
  });

  it("fails closed on timeout-like upstream aborts", async () => {
    global.fetch = vi.fn(async () => {
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      throw abortError;
    }) as typeof global.fetch;

    await expect(fetchJobDescriptionFromUrl("https://example.com/jobs/123")).rejects.toMatchObject({
      status: 408,
      diagnostics: [expect.objectContaining({ code: "REMOTE_TIMEOUT" })]
    });
  });

  it("revalidates redirect targets before following them", async () => {
    lookupMock.mockImplementation(async (hostname: string) => {
      if (hostname === "example.com") {
        return [{ address: "93.184.216.34", family: 4 }] as never;
      }

      return [{ address: "127.0.0.1", family: 4 }] as never;
    });
    global.fetch = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: "http://localhost/private"
        }
      })
    ) as typeof global.fetch;

    await expect(fetchJobDescriptionFromUrl("https://example.com/jobs/123")).rejects.toMatchObject({
      status: 403
    });
  });

  it("resolves embedded Ashby careers pages to the public job posting payload", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          `<!doctype html>
          <html>
            <head><title>Careers - Skyflow</title></head>
            <body>
              <main>${"Generic careers overview. ".repeat(30)}</main>
              <script>window.__ashbyBaseJobBoardUrl = "https://jobs.ashbyhq.com/skyflow"</script>
              <script src="https://jobs.ashbyhq.com/skyflow/embed"></script>
            </body>
          </html>`,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobs: [
              {
                id: "5caff613-773d-466d-9876-cd803811d30b",
                title: "Software Engineer",
                jobUrl: "https://jobs.ashbyhq.com/skyflow/5caff613-773d-466d-9876-cd803811d30b",
                descriptionPlain:
                  "About the role:\nYou have\n - Build APIs\nYou will\n - Ship backend systems\n"
              }
            ],
            apiVersion: "1"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl(
      "https://www.skyflow.com/careers?ashby_jid=5caff613-773d-466d-9876-cd803811d30b"
    );

    expect(result.finalUrl).toBe(
      "https://www.skyflow.com/careers?ashby_jid=5caff613-773d-466d-9876-cd803811d30b"
    );
    expect(result.resolvedUrl).toBe(
      "https://jobs.ashbyhq.com/skyflow/5caff613-773d-466d-9876-cd803811d30b"
    );
    expect(result.pageTitle).toBe("Software Engineer");
    expect(result.contentType).toBe("application/json");
    expect(result.resolverVersion).toBe("m8.4.1");
    expect(result.extractedText).toContain("Ship backend systems");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ASHBY_JOB_POSTING_ID_DETECTED" }),
        expect.objectContaining({ code: "ASHBY_JOB_BOARD_DISCOVERED" }),
        expect.objectContaining({ code: "ASHBY_PUBLIC_API_REQUESTED" }),
        expect.objectContaining({ code: "ASHBY_JOB_POSTING_RESOLVED" })
      ])
    );
  });

  it("rejects generic Ashby careers pages when the requested posting is missing from the public board", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          `<!doctype html>
          <html>
            <head><title>Careers - Skyflow</title></head>
            <body>
              <main>${"Generic careers overview. ".repeat(30)}</main>
              <script>window.__ashbyBaseJobBoardUrl = "https://jobs.ashbyhq.com/skyflow"</script>
              <script src="https://jobs.ashbyhq.com/skyflow/embed"></script>
            </body>
          </html>`,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobs: [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                title: "Different posting",
                jobUrl: "https://jobs.ashbyhq.com/skyflow/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                descriptionPlain: "Different job"
              }
            ],
            apiVersion: "1"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof global.fetch;

    await expect(
      fetchJobDescriptionFromUrl(
        "https://www.skyflow.com/careers?ashby_jid=5caff613-773d-466d-9876-cd803811d30b"
      )
    ).rejects.toMatchObject({
      status: 422,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "ASHBY_JOB_POSTING_NOT_FOUND" }),
        expect.objectContaining({ code: "GENERIC_CAREERS_PAGE_DETECTED" }),
        expect.objectContaining({ code: "NO_JOB_CONTENT_FOUND" })
      ])
    });
  });
});
