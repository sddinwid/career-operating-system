import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobDescriptionSourceType } from "@prisma/client";
import { afterEach } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn()
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: useActionStateMock
  };
});

import { JobDescriptionForm } from "@/components/job-descriptions/job-description-form";

const pasteFallbackMessage =
  "We could not extract usable job-description text from this site. Paste the description below to continue.";

describe("JobDescriptionForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    useActionStateMock.mockReturnValue([{}, vi.fn()]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders application intake with prefilled metadata and the career-knowledge-ready indicator", () => {
    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge: Version 1.0.0 available"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "Original text",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.MANUAL_PASTE,
          publishedAt: "2026-07-15"
        }}
        existingJobUrl="https://company.example/jobs/1"
        mode="application"
        pageTitle="Add job description"
        pageDescription="Preserve the original text."
      />
    );

    expect(screen.getByText("Acme")).toBeVisible();
    expect(screen.getAllByText("Senior Engineer").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Career Knowledge: Version 1.0.0 available")
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Job description text" })
    ).toHaveValue("Original text");
  });

  it("renders validation and error state messages from the server action", () => {
    useActionStateMock.mockReturnValue([
      {
        formError: "Please fix the highlighted fields and try again.",
        fieldErrors: {
          descriptionText: ["Job description text is required"],
          sourceUrl: ["Use a valid URL"]
        }
      },
      vi.fn()
    ]);

    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge unavailable"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceType: JobDescriptionSourceType.MANUAL_PASTE
        }}
        mode="application"
        pageTitle="Add job description"
        pageDescription="Preserve the original text."
      />
    );

    expect(
      screen.getByText("Please fix the highlighted fields and try again.")
    ).toBeVisible();
    expect(screen.getByText("Job description text is required")).toBeVisible();
    expect(screen.getByText("Use a valid URL")).toBeVisible();
  });

  it("renders the standalone new-opportunity workflow with company and role inputs and a cancel link", () => {
    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications"
        careerKnowledgeLabel="Career Knowledge unavailable"
        defaultValues={{
          companyName: "",
          role: "",
          jobUrl: "",
          opportunitySource: "",
          descriptionText: "",
          sourceType: JobDescriptionSourceType.JOB_BOARD
        }}
        mode="new-opportunity"
        pageTitle="Capture a new job description"
        pageDescription="Create a saved opportunity."
      />
    );

    expect(screen.getByRole("textbox", { name: "Company" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Role" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/applications"
    );
  });

  it("fetches a URL preview, exposes metadata, and reports unchanged refetches without auto-saving", async () => {
    const action = vi.fn(async () => ({}));
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          requestedUrl: "https://company.example/jobs/1",
          finalUrl: "https://company.example/jobs/1?gh_jid=1",
          resolvedUrl: "https://jobs.ashbyhq.com/company/1",
          status: 200,
          contentType: "text/html",
          retrievedAt: "2026-07-21T12:00:00.000Z",
          pageTitle: "Senior Engineer",
          extractorVersion: "m8.4.0",
          resolverVersion: "m8.4.1",
          provenance: "STATIC_STRUCTURED_DATA",
          extractionChecksum: "b".repeat(64),
          extractedText: "Original text",
          diagnostics: [
            {
              code: "JSON_LD_JOB_POSTING_USED",
              level: "INFO",
              message: "Used JobPosting schema."
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    ) as typeof global.fetch;

    render(
      <JobDescriptionForm
        action={action}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge ready"
        currentNormalizedText="Original text"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.COMPANY_SITE
        }}
        existingJobUrl="https://company.example/jobs/1"
        initialSourceMode="url"
        mode="application"
        pageTitle="Replace job description"
        pageDescription="Preserve the original text."
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fetch Job Description" }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Job description text" })).toHaveValue(
        "Original text"
      )
    );

    expect(screen.getAllByText("https://company.example/jobs/1").length).toBeGreaterThan(0);
    expect(screen.getByText("https://company.example/jobs/1?gh_jid=1")).toBeVisible();
    expect(screen.getByText("https://jobs.ashbyhq.com/company/1")).toBeVisible();
    expect(screen.getAllByText("Senior Engineer").length).toBeGreaterThan(0);
    expect(screen.getByText("JSON_LD_JOB_POSTING_USED")).toBeVisible();
    expect(screen.getByText("m8.4.1")).toBeVisible();
    expect(screen.getByText("Static page")).toBeVisible();
    expect(screen.getByText("b".repeat(64))).toBeVisible();
    expect(
      screen.getByText(
        "No material change detected. Saving now will reuse the current immutable version."
      )
    ).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });

  it("shows fetch errors, supports switching back to paste, and highlights changed refetches", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "The job posting could not be fetched.",
            diagnostics: [{ code: "REMOTE_FETCH_FAILED", message: "Upstream failed." }]
          }),
          {
            status: 502,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestedUrl: "https://company.example/jobs/1",
            finalUrl: "https://company.example/jobs/1",
            resolvedUrl: null,
            status: 200,
            contentType: "text/html",
            retrievedAt: "2026-07-21T12:00:00.000Z",
            pageTitle: "Senior Engineer",
            extractorVersion: "m8.4.0",
            resolverVersion: null,
            provenance: "STATIC_DOM",
            extractionChecksum: "c".repeat(64),
            extractedText: "Changed text with more detail",
            diagnostics: []
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof global.fetch;

    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge ready"
        currentNormalizedText="Original text"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.COMPANY_SITE
        }}
        initialSourceMode="url"
        mode="application"
        pageTitle="Replace job description"
        pageDescription="Preserve the original text."
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fetch Job Description" }));
    await waitFor(() =>
      expect(screen.getByText("The job posting could not be fetched.")).toBeVisible()
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Fetch Job Description" })).toBeVisible()
    );
    fireEvent.click(screen.getByRole("button", { name: "Fetch Job Description" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Job description text" })).toHaveValue(
        "Changed text with more detail"
      )
    );
    expect(
      screen.getByText(
        "Fetched content differs from the current reviewed source. Review edits before saving a successor version."
      )
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Paste Text" }));
    expect(screen.queryByText("Requested URL")).not.toBeInTheDocument();
  });

  it("retries with the rendered page when the static page is a shell and labels the preview provenance", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "The initial page did not include the job description. Trying the rendered page...",
            diagnostics: [
              {
                code: "RENDERED_FALLBACK_RECOMMENDED",
                message:
                  "The initial page did not include the job description. Trying the rendered page..."
              }
            ],
            retryableWithRenderedFallback: true
          }),
          {
            status: 409,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestedUrl: "https://company.example/jobs/1",
            finalUrl: "https://company.example/jobs/1",
            resolvedUrl: null,
            status: 200,
            contentType: "text/html",
            retrievedAt: "2026-07-23T12:00:00.000Z",
            pageTitle: "Senior Engineer",
            extractorVersion: "m8.5.0",
            resolverVersion: null,
            provenance: "RENDERED_DOM",
            extractionChecksum: "d".repeat(64),
            extractedText: "Rendered job description with responsibilities and requirements",
            diagnostics: [
              {
                code: "RENDERED_FALLBACK_USED",
                level: "INFO",
                message: "The rendered page fallback supplied the extracted job-description preview."
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof global.fetch;

    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge ready"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.COMPANY_SITE
        }}
        initialSourceMode="url"
        mode="application"
        pageTitle="Replace job description"
        pageDescription="Preserve the original text."
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fetch Job Description" }));

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Job description text" })
      ).toHaveValue("Rendered job description with responsibilities and requirements")
    );

    expect(screen.getByText("Rendered page")).toBeVisible();
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/job-descriptions/fetch-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://company.example/jobs/1",
          allowRenderedFallback: false
        })
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/job-descriptions/fetch-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://company.example/jobs/1",
          allowRenderedFallback: true
        })
      })
    );
  });

  it("switches to paste mode when both extraction paths fail and preserves the typed URL", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "The initial page did not include the job description. Trying the rendered page...",
            diagnostics: [
              {
                code: "RENDERED_FALLBACK_RECOMMENDED",
                message:
                  "The initial page did not include the job description. Trying the rendered page..."
              }
            ],
            retryableWithRenderedFallback: true
          }),
          {
            status: 409,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error:
              "We could not extract usable job-description text from this site. Paste the description below to continue.",
            diagnostics: [
              {
                code: "NO_JOB_CONTENT_FOUND",
                message: "We could not extract usable job-description text from this site."
              }
            ]
          }),
          {
            status: 422,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof global.fetch;

    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge ready"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.COMPANY_SITE
        }}
        initialSourceMode="url"
        mode="application"
        pageTitle="Replace job description"
        pageDescription="Preserve the original text."
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Job posting URL" }), {
      target: { value: "https://company.example/jobs/rendered" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Fetch Job Description" }));

    await waitFor(() =>
      expect(screen.getByText(pasteFallbackMessage)).toBeVisible()
    );

    expect(screen.getByRole("button", { name: "Import from URL" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Fetch Job Description" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import from URL" }));
    expect(screen.getByRole("button", { name: "Fetch Job Description" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Job posting URL" })).toHaveValue(
      "https://company.example/jobs/rendered"
    );
  });
});
