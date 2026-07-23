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

  it("extracts JobPosting JSON-LD content, preserves metadata, and returns static structured provenance", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>Platform Engineer</title>
            <script type="application/ld+json">
              {
                "@context":"https://schema.org",
                "@type":"JobPosting",
                "title":"Platform Engineer",
                "hiringOrganization":{"name":"Acme"},
                "jobLocation":{"address":{"addressLocality":"Chicago"}},
                "description":"<p>${"Build resilient TypeScript APIs and improve deployment safety across backend services. ".repeat(6)}</p>",
                "qualifications":"${"Distributed systems, observability, and incident response experience. ".repeat(4)}",
                "responsibilities":"${"Design and operate secure backend services at scale. ".repeat(4)}"
              }
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
    expect(result.provenance).toBe("STATIC_STRUCTURED_DATA");
    expect(result.extractedText).toContain("Title\nPlatform Engineer");
    expect(result.extractedText).toContain("Company\nAcme");
    expect(result.extractedText).toContain("Location\nChicago");
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

  it("extracts embedded serialized state before falling back to static DOM containers", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>Senior Platform Engineer</title>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "jobPosting": {
                      "title": "Senior Platform Engineer",
                      "company": "Acme",
                      "location": "Remote",
                      "description": "${"Lead the platform roadmap across reliability, deployment, and observability. ".repeat(6)}",
                      "responsibilities": "${"Own incident automation, release hardening, and service readiness. ".repeat(4)}"
                    }
                  }
                }
              }
            </script>
          </head>
          <body><div id="__next">Loading application shell</div></body>
        </html>`,
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/embedded");

    expect(result.provenance).toBe("EMBEDDED_STATE");
    expect(result.extractedText).toContain("Senior Platform Engineer");
    expect(result.extractedText).toContain("Own incident automation");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EMBEDDED_STATE_USED" })
      ])
    );
  });

  it("falls back to rendered DOM when the static page is a JavaScript shell", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><head><title>Jobs</title></head><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/rendered-dom", {
      renderedPageFetcher: vi.fn(async () => ({
        finalUrl: "https://example.com/jobs/rendered-dom",
        pageTitle: "NodeJS Developer",
        html: `<!doctype html>
          <html>
            <body>
              <header>Sign in Contact Careers</header>
              <main>
                <section class="job-description">
                  <h1>NodeJS Developer</h1>
                  <p>VDart</p>
                  <p>Pleasanton</p>
                  <h2>Requirements</h2>
                  <ul>
                    <li>Strong Experience in NodeJS</li>
                    <li>${"Build scalable backend APIs across distributed systems and data platforms. ".repeat(3)}</li>
                    <li>${"Collaborate with cross-functional teams to ship production-ready features with clear ownership. ".repeat(2)}</li>
                    <li>${"Own production support rotations, incident response, and release automation for backend services. ".repeat(2)}</li>
                  </ul>
                </section>
              </main>
              <footer>Instagram About Contact</footer>
            </body>
          </html>`
      }))
    });

    expect(result.provenance).toBe("RENDERED_DOM");
    expect(result.pageTitle).toBe("NodeJS Developer");
    expect(result.extractedText).toContain("NodeJS Developer");
    expect(result.extractedText).toContain("VDart");
    expect(result.extractedText).toContain("Pleasanton");
    expect(result.extractedText).toContain("Strong Experience in NodeJS");
    expect(result.extractedText).not.toContain("Instagram");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PAGE_REQUIRES_JAVASCRIPT" }),
        expect.objectContaining({ code: "RENDERED_FALLBACK_USED" })
      ])
    );
  });

  it("falls back to rendered structured data when the static page is a shell", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/rendered-jsonld", {
      renderedPageFetcher: vi.fn(async () => ({
        finalUrl: "https://example.com/jobs/rendered-jsonld",
        pageTitle: "Software Engineer",
        html: `<!doctype html>
          <html>
            <head>
              <script type="application/ld+json">
                {
                  "@context":"https://schema.org",
                  "@type":"JobPosting",
                  "title":"Software Engineer",
                  "hiringOrganization":{"name":"Skyflow"},
                  "jobLocation":{"address":{"addressLocality":"Remote"}},
                  "description":"${"Build privacy infrastructure and APIs for high-throughput systems. ".repeat(6)}",
                  "qualifications":"${"Strong backend engineering across distributed systems and event-driven architectures. ".repeat(4)}"
                }
              </script>
            </head>
            <body><main>Rendered page</main></body>
          </html>`
      }))
    });

    expect(result.provenance).toBe("RENDERED_STRUCTURED_DATA");
    expect(result.extractedText).toContain("Software Engineer");
    expect(result.extractedText).toContain("Skyflow");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RENDERED_JSON_LD_JOB_POSTING_USED" }),
        expect.objectContaining({ code: "RENDERED_FALLBACK_USED" })
      ])
    );
  });

  it("returns an explicit retry signal when the static page needs rendered fallback but the caller is still in the static phase", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    await expect(
      fetchJobDescriptionFromUrl("https://example.com/jobs/static-phase", {
        allowRenderedFallback: false
      })
    ).rejects.toMatchObject({
      status: 409,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "RENDERED_FALLBACK_RECOMMENDED" })
      ])
    });
  });

  it("surfaces the paste fallback message when both static and rendered extraction are insufficient", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    await expect(
      fetchJobDescriptionFromUrl("https://example.com/jobs/no-content", {
        renderedPageFetcher: vi.fn(async () => ({
          finalUrl: "https://example.com/jobs/no-content",
          pageTitle: "Jobs",
          html: `<!doctype html><html><body><main>Careers Home Contact About Us</main></body></html>`
        }))
      })
    ).rejects.toMatchObject({
      status: 422,
      message:
        "We could not extract usable job-description text from this site. Paste the description below to continue.",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "NO_JOB_CONTENT_FOUND" })
      ])
    });
  });

  it("does not invoke rendered fallback for access-denied pages", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>${"Access denied. ".repeat(40)}</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;
    const renderedPageFetcher = vi.fn();

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/blocked", {
      renderedPageFetcher
    });

    expect(result.provenance).toBe("STATIC_DOM");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ACCESS_DENIED" })])
    );
    expect(renderedPageFetcher).not.toHaveBeenCalled();
  });

  it("reports rendered browser timeouts cleanly", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    await expect(
      fetchJobDescriptionFromUrl("https://example.com/jobs/render-timeout", {
        renderedPageFetcher: vi.fn(async () => {
          throw Object.assign(new Error("The rendered page timed out."), {
            status: 408,
            diagnostics: [{ code: "RENDERED_TIMEOUT", message: "The rendered page timed out." }]
          });
        })
      })
    ).rejects.toMatchObject({
      status: 408
    });
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

  it("cleans large rendered navigation and footer noise from BestJobTool-shaped pages", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        `<!doctype html><html><body><main>Enable JavaScript to continue.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        }
      )
    ) as typeof global.fetch;

    const result = await fetchJobDescriptionFromUrl("https://example.com/jobs/bestjobtool", {
      renderedPageFetcher: vi.fn(async () => ({
        finalUrl: "https://example.com/jobs/bestjobtool",
        pageTitle: "NodeJS Developer",
        html: `<!doctype html>
          <html>
            <body>
              <header>
                <nav>Home Jobs Countries Instagram Facebook LinkedIn</nav>
              </header>
              <main>
                <section class="job-description">
                  <h1>NodeJS Developer</h1>
                  <p>VDart</p>
                  <p>Pleasanton</p>
                  <h2>You have</h2>
                  <ul>
                    <li>Strong Experience in NodeJS</li>
                    <li>${"Experience building REST APIs and distributed services for high-growth teams. ".repeat(3)}</li>
                    <li>${"Ownership of delivery quality, observability, and operational readiness across releases. ".repeat(2)}</li>
                    <li>${"Comfort working with production support, deployment automation, and collaborative debugging. ".repeat(2)}</li>
                  </ul>
                </section>
              </main>
              <footer>
                <p>Instagram</p>
                <p>Germany Canada Singapore Australia</p>
                <p>© 2025 All right reserved</p>
              </footer>
            </body>
          </html>`
      }))
    });

    expect(result.extractedText).toContain("NodeJS Developer");
    expect(result.extractedText).toContain("VDart");
    expect(result.extractedText).toContain("Pleasanton");
    expect(result.extractedText).toContain("Strong Experience in NodeJS");
    expect(result.extractedText).not.toContain("Instagram");
    expect(result.extractedText).not.toContain("© 2025 All right reserved");
    expect(result.extractedText).not.toContain("Germany Canada Singapore Australia");
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
});
