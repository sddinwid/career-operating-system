"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  ApplicationPriority,
  ApplicationStatus,
  WorkArrangement
} from "@prisma/client";
import { ApplicationFormState } from "@/lib/applications/schemas";
import {
  canonicalizeJobUrl,
  type OpportunityChoice
} from "@/lib/applications/opportunity-shared";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import {
  applicationPriorityOptions,
  applicationStatusOptions,
  workArrangementOptions
} from "@/lib/applications/options";
import { SubmitButton } from "@/components/applications/submit-button";

type CompanyChoice = {
  id: string;
  name: string;
  normalizedName: string;
};

type ApplicationFormValues = {
  companyName: string;
  role: string;
  appliedAtLocal: string;
  manualJobSearchDate?: string | null;
  jobUrl?: string | null;
  source?: string | null;
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency?: string | null;
  location?: string | null;
  workArrangement?: WorkArrangement | null;
  priority?: ApplicationPriority | null;
  status?: ApplicationStatus | null;
  notes?: string | null;
};

type ApplicationFormProps = {
  action: (
    state: ApplicationFormState,
    formData: FormData
  ) => Promise<ApplicationFormState>;
  companies: CompanyChoice[];
  opportunities: OpportunityChoice[];
  defaultValues: ApplicationFormValues;
  mode: "create" | "edit";
};

const initialState: ApplicationFormState = {};

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

export function ApplicationForm({
  action,
  companies,
  opportunities,
  defaultValues,
  mode
}: ApplicationFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [companyName, setCompanyName] = useState(defaultValues.companyName);
  const [role, setRole] = useState(defaultValues.role);
  const [jobUrl, setJobUrl] = useState(defaultValues.jobUrl ?? "");
  const duplicateCompany = useMemo(() => {
    const normalized = normalizeCompanyName(companyName);

    if (!normalized) {
      return null;
    }

    return companies.find((company) => company.normalizedName === normalized) ?? null;
  }, [companies, companyName]);
  const opportunityHints = useMemo(() => {
    const normalizedCompany = normalizeCompanyName(companyName);
    const normalizedRole = role.trim().toLowerCase();
    const canonicalUrl = canonicalizeJobUrl(jobUrl);

    if (!normalizedCompany || !normalizedRole) {
      return {
        exactUrlMatch: null as OpportunityChoice | null,
        similar: [] as OpportunityChoice[]
      };
    }

    const matchingCompanyOpportunities = opportunities.filter(
      (opportunity) =>
        opportunity.company.normalizedName === normalizedCompany &&
        opportunity.title.trim().toLowerCase() === normalizedRole
    );

    const exactUrlMatch =
      canonicalUrl
        ? matchingCompanyOpportunities.find(
            (opportunity) => opportunity.canonicalJobUrl === canonicalUrl
          ) ?? null
        : null;

    const similar = matchingCompanyOpportunities.filter(
      (opportunity) => opportunity.id !== exactUrlMatch?.id
    );

    return { exactUrlMatch, similar };
  }, [companyName, jobUrl, opportunities, role]);

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">
              {mode === "create" ? "Add application" : "Edit application"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Start with company, role, and local application time so a usable
              record can be saved in under a minute. Fill the rest now or come back
              later.
            </p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
            Required first: company, role, local time
          </span>
        </div>

        {state.formError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.formError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Company</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.companyName}
              name="companyName"
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Corp"
            />
            <FieldError errors={state.fieldErrors} field="companyName" />
            {duplicateCompany ? (
              <p className="text-sm text-amber-700">
                This matches existing company <strong>{duplicateCompany.name}</strong>.
                Saving will reuse that company record.
              </p>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Role</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.role}
              name="role"
              onChange={(event) => setRole(event.target.value)}
              placeholder="Senior Product Manager"
            />
            <FieldError errors={state.fieldErrors} field="role" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">
              Application date and time
            </span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.appliedAtLocal}
              name="appliedAtLocal"
              type="datetime-local"
            />
            <FieldError errors={state.fieldErrors} field="appliedAtLocal" />
            <p className="text-xs text-stone-500">
              Stored as a real timestamp using America/Chicago by default.
            </p>
          </label>

          {mode === "edit" ? (
            <label className="grid gap-2">
              <span className="text-sm font-medium text-stone-700">Status</span>
              <select
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={defaultValues.status ?? "APPLIED"}
                name="status"
              >
                {applicationStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors} field="status" />
            </label>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">
              Manual job-search date override
            </span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.manualJobSearchDate ?? ""}
              name="manualJobSearchDate"
              type="date"
            />
            <FieldError errors={state.fieldErrors} field="manualJobSearchDate" />
            <p className="text-xs text-stone-500">
              Optional. Leave blank to derive the reporting date from the 03:00 cutoff.
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900">Fill in later details</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          These fields are optional now and can be updated later without losing the
          original submission record.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-stone-700">Job URL</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.jobUrl ?? ""}
              name="jobUrl"
              onChange={(event) => setJobUrl(event.target.value)}
              placeholder="https://company.example/jobs/123"
              type="url"
            />
            <FieldError errors={state.fieldErrors} field="jobUrl" />
            {opportunityHints.exactUrlMatch ? (
              <p className="text-sm text-emerald-700">
                This exact canonical job URL matches an existing opportunity at{" "}
                <strong>{opportunityHints.exactUrlMatch.company.name}</strong>. Saving
                will reuse that opportunity.
              </p>
            ) : null}
            {opportunityHints.similar.length > 0 ? (
              <p className="text-sm text-amber-700">
                Similar opportunities already exist for this company and title. Saving
                will keep this as a separate opportunity unless the exact canonical URL
                matches an existing record.
              </p>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Source</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.source ?? ""}
              name="source"
              placeholder="LinkedIn"
            />
            <FieldError errors={state.fieldErrors} field="source" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Location</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.location ?? ""}
              name="location"
              placeholder="Chicago, IL"
            />
            <FieldError errors={state.fieldErrors} field="location" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">
              Work arrangement
            </span>
            <select
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.workArrangement ?? ""}
              name="workArrangement"
            >
              <option value="">Not set</option>
              {workArrangementOptions.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} field="workArrangement" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Priority</span>
            <select
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.priority ?? ""}
              name="priority"
            >
              <option value="">Not set</option>
              {applicationPriorityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors} field="priority" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Salary minimum</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.salaryMin ?? ""}
              name="salaryMin"
              placeholder="120000"
              type="number"
            />
            <FieldError errors={state.fieldErrors} field="salaryMin" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Salary maximum</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.salaryMax ?? ""}
              name="salaryMax"
              placeholder="150000"
              type="number"
            />
            <FieldError errors={state.fieldErrors} field="salaryMax" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-stone-700">Currency</span>
            <input
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.salaryCurrency ?? ""}
              name="salaryCurrency"
              placeholder="USD"
            />
            <FieldError errors={state.fieldErrors} field="salaryCurrency" />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-stone-700">Notes</span>
            <textarea
              className="min-h-36 rounded-2xl border border-stone-300 px-4 py-3 text-sm"
              defaultValue={defaultValues.notes ?? ""}
              name="notes"
              placeholder="Capture recruiter context, interview prep reminders, or anything worth preserving."
            />
            <FieldError errors={state.fieldErrors} field="notes" />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          idleLabel={mode === "create" ? "Save application" : "Save changes"}
          pendingLabel={mode === "create" ? "Saving..." : "Saving changes..."}
        />
      </div>
    </form>
  );
}
