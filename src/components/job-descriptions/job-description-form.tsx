"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { SubmitButton } from "@/components/applications/submit-button";
import type {
  JobDescriptionFetchResponse
} from "@/lib/job-descriptions/url-fetch-contract";
import type { JobDescriptionFormState } from "@/lib/job-descriptions/schemas";
import {
  MAX_JOB_DESCRIPTION_CHARACTERS,
  normalizeJobDescriptionText
} from "@/lib/job-descriptions/normalize";

const jobDescriptionSourceTypeOptions = [
  "MANUAL_PASTE",
  "LINKEDIN",
  "COMPANY_SITE",
  "RECRUITER",
  "EMAIL",
  "JOB_BOARD",
  "IMPORTED_FILE",
  "OTHER"
] as const;

type JobDescriptionSourceType = (typeof jobDescriptionSourceTypeOptions)[number];
type SourceMode = "paste" | "url";

type JobDescriptionFormValues = {
  companyName?: string;
  role?: string;
  jobUrl?: string | null;
  opportunitySource?: string | null;
  descriptionText: string;
  sourceUrl?: string | null;
  sourceType: JobDescriptionSourceType;
  sourceTitle?: string | null;
  sourceFilename?: string | null;
  publishedAt?: string | null;
};

type JobDescriptionFormProps = {
  action: (
    state: JobDescriptionFormState,
    formData: FormData
  ) => Promise<JobDescriptionFormState>;
  cancelHref: string;
  careerKnowledgeLabel: string;
  currentNormalizedText?: string | null;
  defaultValues: JobDescriptionFormValues;
  existingJobUrl?: string | null;
  initialSourceMode?: SourceMode;
  mode: "application" | "new-opportunity";
  pageTitle: string;
  pageDescription: string;
};

const initialState: JobDescriptionFormState = {};
const RENDERED_PAGE_MESSAGE =
  "The initial page did not include the job description. Trying the rendered page...";
const PASTE_FALLBACK_MESSAGE =
  "We could not extract usable job-description text from this site. Paste the description below to continue.";

function FieldError({
  errors,
  field
}: {
  errors?: Record<string, string[] | undefined>;
  field: string;
}) {
  const message = errors?.[field]?.[0];

  if (!message) {
    return null;
  }

  return <p className="text-sm text-red-700">{message}</p>;
}

export function JobDescriptionForm({
  action,
  cancelHref,
  careerKnowledgeLabel,
  currentNormalizedText,
  defaultValues,
  existingJobUrl,
  initialSourceMode = "paste",
  mode,
  pageTitle,
  pageDescription
}: JobDescriptionFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [sourceMode, setSourceMode] = useState<SourceMode>(initialSourceMode);
  const [urlToFetch, setUrlToFetch] = useState(defaultValues.sourceUrl ?? defaultValues.jobUrl ?? "");
  const [sourceUrl, setSourceUrl] = useState(defaultValues.sourceUrl ?? defaultValues.jobUrl ?? "");
  const [sourceTitle, setSourceTitle] = useState(defaultValues.sourceTitle ?? "");
  const [descriptionText, setDescriptionText] = useState(defaultValues.descriptionText);
  const [fetchPreview, setFetchPreview] = useState<JobDescriptionFetchResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStatusMessage, setFetchStatusMessage] = useState<string | null>(null);
  const [isFetching, startFetchTransition] = useTransition();

  const serializedDiagnostics = useMemo(
    () => (fetchPreview ? JSON.stringify(fetchPreview.diagnostics) : ""),
    [fetchPreview]
  );
  const comparisonState = useMemo(() => {
    if (!fetchPreview || !currentNormalizedText) {
      return null;
    }

    return normalizeJobDescriptionText(fetchPreview.extractedText) === currentNormalizedText
      ? "unchanged"
      : "changed";
  }, [currentNormalizedText, fetchPreview]);

  const fetchFromUrl = () => {
    setFetchError(null);
    setFetchStatusMessage("Fetching page...");

    startFetchTransition(async () => {
      const firstResponse = await fetch("/api/job-descriptions/fetch-url", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url: urlToFetch, allowRenderedFallback: false })
      });

      const firstPayload = (await firstResponse.json()) as
        | JobDescriptionFetchResponse
        | {
            error?: string;
            diagnostics?: Array<{ message: string }>;
            retryableWithRenderedFallback?: boolean;
          };

      if (!firstResponse.ok && "retryableWithRenderedFallback" in firstPayload && firstPayload.retryableWithRenderedFallback) {
        setFetchStatusMessage(RENDERED_PAGE_MESSAGE);

        const renderedResponse = await fetch("/api/job-descriptions/fetch-url", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ url: urlToFetch, allowRenderedFallback: true })
        });

        const renderedPayload = (await renderedResponse.json()) as
          | JobDescriptionFetchResponse
          | { error?: string; diagnostics?: Array<{ message: string }> };

        if (!renderedResponse.ok) {
          const renderedErrorMessage =
            "error" in renderedPayload && typeof renderedPayload.error === "string"
              ? renderedPayload.error
              : null;
          const renderedDiagnosticMessage =
            "diagnostics" in renderedPayload && Array.isArray(renderedPayload.diagnostics)
              ? renderedPayload.diagnostics[0]?.message
              : null;
          const nextError =
            renderedErrorMessage ??
            renderedDiagnosticMessage ??
            "The job posting could not be fetched.";
          setFetchError(nextError);
          setFetchStatusMessage(null);
          setFetchPreview(null);
          if (nextError === PASTE_FALLBACK_MESSAGE) {
            setSourceMode("paste");
          }
          return;
        }

        const renderedPreview = renderedPayload as JobDescriptionFetchResponse;
        setFetchPreview(renderedPreview);
        setDescriptionText(renderedPreview.extractedText);
        setSourceUrl(renderedPreview.resolvedUrl ?? renderedPreview.finalUrl);
        if (renderedPreview.pageTitle) {
          setSourceTitle((currentValue) => currentValue || renderedPreview.pageTitle || "");
        }
        setFetchStatusMessage(null);
        return;
      }

      if (!firstResponse.ok) {
        const errorMessage =
          "error" in firstPayload && typeof firstPayload.error === "string"
            ? firstPayload.error
            : null;
        const diagnosticMessage =
          "diagnostics" in firstPayload && Array.isArray(firstPayload.diagnostics)
            ? firstPayload.diagnostics[0]?.message
            : null;
        const nextError =
          errorMessage ?? diagnosticMessage ?? "The job posting could not be fetched.";
        setFetchError(nextError);
        setFetchStatusMessage(null);
        setFetchPreview(null);
        if (nextError === PASTE_FALLBACK_MESSAGE) {
          setSourceMode("paste");
        }
        return;
      }

      const preview = firstPayload as JobDescriptionFetchResponse;
      setFetchPreview(preview);
      setDescriptionText(preview.extractedText);
      setSourceUrl(preview.resolvedUrl ?? preview.finalUrl);
      if (preview.pageTitle) {
        setSourceTitle((currentValue) => currentValue || preview.pageTitle || "");
      }
      setFetchStatusMessage(null);
    });
  };

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Job description
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
              {pageTitle}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              {pageDescription}
            </p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
            {careerKnowledgeLabel}
          </span>
        </div>

        {state.formError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.formError}
          </div>
        ) : null}

        {mode === "application" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Company</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {defaultValues.companyName}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Role</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {defaultValues.role}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Existing job URL</p>
              <p className="mt-2 break-all text-sm text-stone-700">
                {existingJobUrl ?? "Not set"}
              </p>
            </article>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-stone-700">Company</span>
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={defaultValues.companyName ?? ""}
                name="companyName"
                placeholder="Acme Corp"
              />
              <FieldError errors={state.fieldErrors} field="companyName" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-stone-700">Role</span>
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={defaultValues.role ?? ""}
                name="role"
                placeholder="Senior Backend Engineer"
              />
              <FieldError errors={state.fieldErrors} field="role" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-stone-700">Job URL</span>
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={defaultValues.jobUrl ?? ""}
                name="jobUrl"
                placeholder="https://company.example/jobs/123"
                type="url"
              />
              <FieldError errors={state.fieldErrors} field="jobUrl" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-stone-700">Opportunity source</span>
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={defaultValues.opportunitySource ?? ""}
                name="opportunitySource"
                placeholder="LinkedIn"
              />
              <FieldError errors={state.fieldErrors} field="opportunitySource" />
            </label>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={
              sourceMode === "paste"
                ? "rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            }
            onClick={() => setSourceMode("paste")}
            type="button"
          >
            Paste Text
          </button>
          <button
            className={
              sourceMode === "url"
                ? "rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            }
            onClick={() => setSourceMode("url")}
            type="button"
          >
            Import from URL
          </button>
        </div>

        <input name="intakeMode" type="hidden" value={sourceMode} />
        <input name="fetchedRequestedUrl" type="hidden" value={fetchPreview?.requestedUrl ?? ""} />
        <input name="fetchedFinalUrl" type="hidden" value={fetchPreview?.finalUrl ?? ""} />
        <input name="fetchedResolvedUrl" type="hidden" value={fetchPreview?.resolvedUrl ?? ""} />
        <input name="fetchedStatus" type="hidden" value={fetchPreview?.status ?? ""} />
        <input name="fetchedContentType" type="hidden" value={fetchPreview?.contentType ?? ""} />
        <input name="fetchedRetrievedAt" type="hidden" value={fetchPreview?.retrievedAt ?? ""} />
        <input name="fetchedPageTitle" type="hidden" value={fetchPreview?.pageTitle ?? ""} />
        <input
          name="fetchedExtractorVersion"
          type="hidden"
          value={fetchPreview?.extractorVersion ?? ""}
        />
        <input
          name="fetchedResolverVersion"
          type="hidden"
          value={fetchPreview?.resolverVersion ?? ""}
        />
        <input name="fetchedProvenance" type="hidden" value={fetchPreview?.provenance ?? ""} />
        <input
          name="fetchedExtractionChecksum"
          type="hidden"
          value={fetchPreview?.extractionChecksum ?? ""}
        />
        <input name="fetchedDiagnostics" type="hidden" value={serializedDiagnostics} />

        {fetchStatusMessage ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {fetchStatusMessage}
          </div>
        ) : null}

        {fetchError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        ) : null}

        {sourceMode === "url" ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-700">Job posting URL</span>
                <input
                  className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                  onChange={(event) => setUrlToFetch(event.target.value)}
                  placeholder="https://company.example/jobs/123"
                  type="url"
                  value={urlToFetch}
                />
              </label>
              <div className="flex items-end">
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
                  disabled={isFetching || urlToFetch.trim().length === 0}
                  onClick={fetchFromUrl}
                  type="button"
                >
                  {isFetching
                    ? "Fetching page..."
                    : fetchPreview
                      ? "Fetch Again"
                      : "Fetch Job Description"}
                </button>
              </div>
            </div>

            {fetchPreview ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <article>
                    <p className="text-sm font-medium text-stone-500">Requested URL</p>
                    <p className="mt-1 break-all text-sm text-stone-800">{fetchPreview.requestedUrl}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Final URL</p>
                    <p className="mt-1 break-all text-sm text-stone-800">{fetchPreview.finalUrl}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Resolved posting URL</p>
                    <p className="mt-1 break-all text-sm text-stone-800">
                      {fetchPreview.resolvedUrl ?? "Not resolved"}
                    </p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">HTTP status</p>
                    <p className="mt-1 text-sm text-stone-800">{fetchPreview.status}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Content type</p>
                    <p className="mt-1 text-sm text-stone-800">{fetchPreview.contentType}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Retrieved at</p>
                    <p className="mt-1 text-sm text-stone-800">{fetchPreview.retrievedAt}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Extractor version</p>
                    <p className="mt-1 text-sm text-stone-800">{fetchPreview.extractorVersion}</p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Preview source</p>
                    <p className="mt-1 text-sm text-stone-800">
                      {fetchPreview.provenance === "RENDERED_STRUCTURED_DATA" ||
                      fetchPreview.provenance === "RENDERED_DOM"
                        ? "Rendered page"
                        : "Static page"}
                    </p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Resolver version</p>
                    <p className="mt-1 text-sm text-stone-800">
                      {fetchPreview.resolverVersion ?? "Not used"}
                    </p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Extraction checksum</p>
                    <p className="mt-1 break-all text-sm text-stone-800">
                      {fetchPreview.extractionChecksum}
                    </p>
                  </article>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <article>
                    <p className="text-sm font-medium text-stone-500">Page title</p>
                    <p className="mt-1 text-sm text-stone-800">
                      {fetchPreview.pageTitle ?? "Title not available"}
                    </p>
                  </article>
                  <article>
                    <p className="text-sm font-medium text-stone-500">Extraction warnings</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {fetchPreview.diagnostics.length > 0 ? (
                        fetchPreview.diagnostics.map((diagnostic) => (
                          <span
                            key={`${diagnostic.code}-${diagnostic.message}`}
                            className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600"
                          >
                            {diagnostic.code}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-stone-600">No extraction warnings.</span>
                      )}
                    </div>
                  </article>
                </div>

                {comparisonState ? (
                  <div
                    className={
                      comparisonState === "unchanged"
                        ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                        : "mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                    }
                  >
                    {comparisonState === "unchanged"
                      ? "No material change detected. Saving now will reuse the current immutable version."
                      : "Fetched content differs from the current reviewed source. Review edits before saving a successor version."}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
                Fetch a public job-posting URL to review the extracted text before saving it as the
                immutable source.
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-900">Source metadata</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Source URL</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              name="sourceUrl"
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://company.example/jobs/123"
              type="url"
              value={sourceUrl}
            />
            <FieldError errors={state.fieldErrors} field="sourceUrl" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Source type</span>
            <select
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.sourceType}
              name="sourceType"
            >
              {jobDescriptionSourceTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} field="sourceType" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Source title</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              name="sourceTitle"
              onChange={(event) => setSourceTitle(event.target.value)}
              placeholder="Senior Backend Engineer job posting"
              value={sourceTitle}
            />
            <FieldError errors={state.fieldErrors} field="sourceTitle" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Publication date</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.publishedAt ?? ""}
              name="publishedAt"
              type="date"
            />
            <FieldError errors={state.fieldErrors} field="publishedAt" />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Job description preview</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Review and edit the exact text that will be preserved. The system stores the original
              text and a deterministic normalized copy for later parsing.
            </p>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Max {MAX_JOB_DESCRIPTION_CHARACTERS.toLocaleString()} characters
          </span>
        </div>

        <label className="mt-6 grid gap-2">
          <span className="sr-only">Job description text</span>
          <textarea
            className="min-h-[28rem] rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6"
            name="descriptionText"
            onChange={(event) => setDescriptionText(event.target.value)}
            placeholder={
              sourceMode === "url"
                ? "Fetch a job posting URL, then review the extracted text here."
                : "Paste the full job description here."
            }
            value={descriptionText}
          />
          <FieldError errors={state.fieldErrors} field="descriptionText" />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton idleLabel="Save job description" pendingLabel="Saving..." />
        <Link
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          href={cancelHref as Route}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
