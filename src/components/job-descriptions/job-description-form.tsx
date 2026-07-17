"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/applications/submit-button";
import type { JobDescriptionFormState } from "@/lib/job-descriptions/schemas";
import { MAX_JOB_DESCRIPTION_CHARACTERS } from "@/lib/job-descriptions/normalize";

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
  defaultValues: JobDescriptionFormValues;
  existingJobUrl?: string | null;
  mode: "application" | "new-opportunity";
  pageTitle: string;
  pageDescription: string;
};

const initialState: JobDescriptionFormState = {};

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
  defaultValues,
  existingJobUrl,
  mode,
  pageTitle,
  pageDescription
}: JobDescriptionFormProps) {
  const [state, formAction] = useActionState(action, initialState);

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
        <h2 className="text-xl font-semibold text-stone-900">Source metadata</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Source URL</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.sourceUrl ?? defaultValues.jobUrl ?? ""}
              name="sourceUrl"
              placeholder="https://company.example/jobs/123"
              type="url"
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
              defaultValue={defaultValues.sourceTitle ?? ""}
              name="sourceTitle"
              placeholder="Senior Backend Engineer job posting"
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
            <h2 className="text-xl font-semibold text-stone-900">Original job description</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Paste the exact text you want preserved. The system stores the original
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
            defaultValue={defaultValues.descriptionText}
            name="descriptionText"
            placeholder="Paste the full job description here."
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
