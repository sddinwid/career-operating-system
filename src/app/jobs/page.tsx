import Link from "next/link";
import { parseJobDescriptionAction } from "@/lib/job-descriptions/parse-actions";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import { listJobWorkspaceSummaries } from "@/lib/jobs/service";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  cardClassName,
  cx,
  mutedCardClassName,
  textActionClassName
} from "@/lib/ui";

type JobsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
  fallback: string
) {
  return typeof value === "string" ? value : fallback;
}

function statusBadgeClassName(label: string) {
  if (/ready|approved|retrieved|scored|generated|composed/i.test(label)) {
    return "status-badge status-badge-success";
  }

  if (/blocked|failed|critical/i.test(label)) {
    return "status-badge status-badge-danger";
  }

  if (/warning|review|gaps|limits/i.test(label)) {
    return "status-badge status-badge-warning";
  }

  return "status-badge";
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const query = (await searchParams) ?? {};
  const filters = {
    search: firstParam(query.q, ""),
    parseState: firstParam(query.parseState, "all") as
      | "all"
      | "parsed"
      | "unparsed"
      | "failed",
    reviewState: firstParam(query.reviewState, "all") as
      | "all"
      | "confirmed"
      | "needs-review"
      | "unreviewed",
    readiness: firstParam(query.readiness, "all") as
      | "all"
      | "ready"
      | "needs-review"
      | "blocked",
    applicationLink: firstParam(query.applicationLink, "all") as
      | "all"
      | "linked"
      | "unlinked",
    sort: firstParam(query.sort, "updated") as "updated" | "saved"
  };
  const workspace = await getDefaultWorkspace();
  const jobs = await listJobWorkspaceSummaries(workspace.id, filters);

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Jobs workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              Browse saved opportunities and downstream workflow state
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
              This workspace shows every saved job opportunity, including jobs that have a job
              description but no linked application yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonSecondaryClassName} href="/applications">
              Open applications
            </Link>
            <Link className={buttonPrimaryClassName} href="/jobs/new">
              New job
            </Link>
          </div>
        </div>

        <form className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-2 text-sm font-medium text-stone-700 xl:col-span-2">
            Search jobs
            <input
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.search}
              name="q"
              placeholder="Company, role, URL, or location"
              type="search"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Parse state
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.parseState}
              name="parseState"
            >
              <option value="all">All</option>
              <option value="parsed">Parsed</option>
              <option value="unparsed">Unparsed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Requirement review
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.reviewState}
              name="reviewState"
            >
              <option value="all">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="needs-review">Needs review</option>
              <option value="unreviewed">Unreviewed</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Downstream readiness
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.readiness}
              name="readiness"
            >
              <option value="all">All</option>
              <option value="ready">Ready</option>
              <option value="needs-review">Needs review</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Application link
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.applicationLink}
              name="applicationLink"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Sort
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.sort}
              name="sort"
            >
              <option value="updated">Most recently updated</option>
              <option value="saved">Most recently saved</option>
            </select>
          </label>
          <div className="flex items-end gap-3 xl:col-span-6">
            <button className={buttonPrimaryClassName} type="submit">
              Apply filters
            </button>
            <Link className={buttonSecondaryClassName} href="/jobs">
              Clear
            </Link>
          </div>
        </form>
      </section>

      {jobs.length === 0 ? (
        <section className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">No jobs found</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {filters.search ||
            filters.parseState !== "all" ||
            filters.reviewState !== "all" ||
            filters.readiness !== "all" ||
            filters.applicationLink !== "all"
              ? "No saved opportunities match the current filters."
              : "No job opportunities have been saved yet."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={buttonPrimaryClassName} href="/jobs/new">
              Capture a new job
            </Link>
            <Link className={buttonSecondaryClassName} href="/applications/new">
              Add application
            </Link>
          </div>
        </section>
      ) : (
        <section aria-label="Saved jobs" className="grid gap-5">
          {jobs.map((job) => (
            <article key={job.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
                    {job.companyName}
                  </p>
                  <h2 className="text-2xl font-semibold text-stone-900">{job.title}</h2>
                  <div className="flex flex-wrap gap-3 text-sm text-stone-600">
                    <span>{job.canonicalUrl ?? "No canonical URL"}</span>
                    <span>{job.location ?? "Location not captured"}</span>
                    <span>{job.workArrangement ?? "Work arrangement not captured"}</span>
                    <span>
                      {job.linkedApplication ? "Application linked" : "No application linked"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link className={buttonSecondaryClassName} href={`/jobs/${job.id}`}>
                    View job
                  </Link>
                  {job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}`}
                    >
                      View description
                    </Link>
                  ) : null}
                  {job.latestSuccessfulParse ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription?.id}/analysis`}
                    >
                      View parsed analysis
                    </Link>
                  ) : job.currentJobDescription ? (
                    <form
                      action={parseJobDescriptionAction.bind(
                        null,
                        job.currentJobDescription.id,
                        `/jobs/${job.id}`
                      )}
                    >
                      <button className={buttonSecondaryClassName} type="submit">
                        Parse description
                      </button>
                    </form>
                  ) : null}
                  {job.latestAnalysis ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={
                        job.latestConfirmedAnalysis
                          ? `/job-descriptions/${job.currentJobDescription?.id}/requirements?analysisId=${job.latestConfirmedAnalysis.id}`
                          : `/job-descriptions/${job.currentJobDescription?.id}/requirements`
                      }
                    >
                      {job.latestConfirmedAnalysis ? "View requirements" : "Review requirements"}
                    </Link>
                  ) : null}
                  {!job.retrievalRun &&
                  job.currentJobDescription &&
                  job.downstreamReadiness === "READY" ? (
                    <form
                      action={retrieveCareerEvidenceAction.bind(
                        null,
                        job.currentJobDescription.id,
                        `/jobs/${job.id}`
                      )}
                    >
                      <button className={buttonSecondaryClassName} type="submit">
                        Retrieve evidence
                      </button>
                    </form>
                  ) : null}
                  {job.retrievalRun && job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}/evidence?runId=${job.retrievalRun.id}`}
                    >
                      View evidence
                    </Link>
                  ) : null}
                  {job.scoringRun && job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}/evidence/scores?runId=${job.scoringRun.id}&retrievalRunId=${job.scoringRun.evidenceRetrievalRunId}`}
                    >
                      View scores
                    </Link>
                  ) : null}
                  {job.matchReportRun && job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}/match-report?runId=${job.matchReportRun.id}&scoringRunId=${job.matchReportRun.evidenceScoringRunId}`}
                    >
                      View match report
                    </Link>
                  ) : null}
                  {job.structuredResume && job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}/resume-plan?versionId=${job.structuredResume.id}`}
                    >
                      View resume plan
                    </Link>
                  ) : null}
                  {job.resumeComposition && job.currentJobDescription ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/job-descriptions/${job.currentJobDescription.id}/resume?versionId=${job.resumeComposition.id}`}
                    >
                      View resume
                    </Link>
                  ) : null}
                  {job.linkedApplication ? (
                    <Link
                      className={buttonSecondaryClassName}
                      href={`/applications/${job.linkedApplication.id}`}
                    >
                      Open application
                    </Link>
                  ) : null}
                  {(job.latestDocx || job.latestPdf) ? (
                    <Link className={buttonPrimaryClassName} href="/documents">
                      View documents
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Current job description</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">
                    {job.currentJobDescription
                      ? `Version ${job.currentJobDescription.versionNumber}`
                      : "No description"}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {job.currentJobDescription
                      ? `Saved ${job.currentJobDescription.capturedAt.toLocaleString("en-US", {
                          timeZone: "UTC"
                        })} UTC`
                      : "Capture a job description to start the workflow."}
                  </p>
                </article>
                {[
                  ["Parse", job.statusLabels.parse],
                  ["Requirements", job.statusLabels.requirement],
                  ["Downstream readiness", job.statusLabels.readiness],
                  ["Evidence retrieval", job.statusLabels.retrieval],
                  ["Evidence scoring", job.statusLabels.scoring],
                  ["Match report", job.statusLabels.matchReport],
                  ["Resume plan", job.statusLabels.plan],
                  ["Resume composition", job.statusLabels.composition],
                  ["Resume audit", job.statusLabels.audit],
                  ["Rendering approval", job.statusLabels.approval]
                ].map(([label, value]) => (
                  <article key={label} className={mutedCardClassName}>
                    <p className="text-sm font-medium text-stone-500">{label}</p>
                    <p className="mt-2">
                      <span className={statusBadgeClassName(value)}>{value}</span>
                    </p>
                  </article>
                ))}
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Artifacts</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-stone-700">
                    {job.latestDocx ? (
                      <Link className={textActionClassName} href={`/documents/${job.latestDocx.id}`}>
                        Latest DOCX
                      </Link>
                    ) : (
                      <span>No DOCX yet</span>
                    )}
                    {job.latestPdf ? (
                      <Link className={textActionClassName} href={`/documents/${job.latestPdf.id}`}>
                        Latest PDF
                      </Link>
                    ) : (
                      <span>No PDF yet</span>
                    )}
                  </div>
                </article>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
