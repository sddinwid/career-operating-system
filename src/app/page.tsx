import Link from "next/link";
import { getHealthStatus } from "@/lib/health";
import { HealthSummary } from "@/components/health-summary";
import { listJobWorkspaceSummaries } from "@/lib/jobs/service";
import { listDocumentWorkspaceEntries } from "@/lib/documents/service";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  cardClassName,
  textActionClassName
} from "@/lib/ui";

export default async function HomePage() {
  const workspace = await getDefaultWorkspace();
  const [status, jobs, documents] = await Promise.all([
    getHealthStatus(),
    listJobWorkspaceSummaries(workspace.id, { sort: "updated" }),
    listDocumentWorkspaceEntries(workspace.id, { sort: "newest" })
  ]);

  const jobsNeedingDescription = jobs.filter((job) => !job.currentJobDescription).slice(0, 5);
  const jobsNeedingReview = jobs
    .filter((job) => job.readiness.primaryAction.label === "Continue Requirement Review")
    .slice(0, 5);
  const jobsReadyForEvidence = jobs
    .filter((job) => job.readiness.primaryAction.label === "Retrieve Evidence")
    .slice(0, 5);
  const jobsReadyForResume = jobs
    .filter((job) =>
      [
        "Create Resume Plan",
        "Create Resume Composition",
        "Open Resume Studio"
      ].includes(job.readiness.primaryAction.label)
    )
    .slice(0, 5);
  const jobsReadyForCoverLetter = jobs
    .filter((job) =>
      ["Generate Cover Letter", "Open Cover Letter Studio"].includes(
        job.readiness.primaryAction.label
      )
    )
    .slice(0, 5);
  const recentlyRenderedArtifacts = documents.slice(0, 5);

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
          Career Operating System
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
          Browse active workflows across applications, jobs, and rendered documents
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          Start from pasted text or a public posting URL, then move through parsing, evidence,
          resume work, cover-letter work, and rendered artifacts without hunting for internal
          routes.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={buttonPrimaryClassName} href="/applications">
            Open applications
          </Link>
          <Link className={buttonSecondaryClassName} href="/jobs">
            Browse jobs
          </Link>
          <Link className={buttonSecondaryClassName} href="/documents">
            Browse documents
          </Link>
          <Link className={buttonSecondaryClassName} href="/jobs/new?sourceMode=url">
            Add Job from URL
          </Link>
          <Link className={buttonSecondaryClassName} href="/jobs/new">
            Paste Job Description
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link className={textActionClassName} href="/applications/new">
            New application
          </Link>
          <Link className={textActionClassName} href="/jobs/new">
            New job
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Jobs needing description</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Save the immutable source text before any downstream job workflow can begin.
          </p>
          <div className="mt-5 space-y-3">
            {jobsNeedingDescription.length > 0 ? jobsNeedingDescription.map((job) => (
              <Link
                key={job.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/jobs/${job.id}`}
              >
                {job.companyName} - {job.title}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>

        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Jobs needing requirement review</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Confirm the parsed requirements before evidence retrieval and later document stages.
          </p>
          <div className="mt-5 space-y-3">
            {jobsNeedingReview.length > 0 ? jobsNeedingReview.map((job) => (
              <Link
                key={job.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/jobs/${job.id}`}
              >
                {job.companyName} - {job.title}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>

        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Jobs ready for evidence</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            These jobs are confirmed and ready for evidence retrieval or scoring work.
          </p>
          <div className="mt-5 space-y-3">
            {jobsReadyForEvidence.length > 0 ? jobsReadyForEvidence.map((job) => (
              <Link
                key={job.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/jobs/${job.id}`}
              >
                {job.companyName} - {job.title}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>

        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Jobs ready for resume</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Resume planning, composition, Studio review, or rendering is the next valid step.
          </p>
          <div className="mt-5 space-y-3">
            {jobsReadyForResume.length > 0 ? jobsReadyForResume.map((job) => (
              <Link
                key={job.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/jobs/${job.id}`}
              >
                {job.companyName} - {job.title}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>

        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Jobs ready for cover letter</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Cover-letter composition, Studio review, approval, or rendering is next.
          </p>
          <div className="mt-5 space-y-3">
            {jobsReadyForCoverLetter.length > 0 ? jobsReadyForCoverLetter.map((job) => (
              <Link
                key={job.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/jobs/${job.id}`}
              >
                {job.companyName} - {job.title}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>

        <article className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">Recently rendered artifacts</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Rediscover the latest immutable outputs without re-rendering them.
          </p>
          <div className="mt-5 space-y-3">
            {recentlyRenderedArtifacts.length > 0 ? recentlyRenderedArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-400"
                href={`/documents/${artifact.id}`}
              >
                {artifact.title} - {artifact.companyName} - {artifact.formatLabel}
              </Link>
            )) : <p className="text-sm text-stone-600">Nothing to show right now.</p>}
          </div>
        </article>
      </section>

      <details className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">
          Diagnostics
        </summary>

        <div className="mt-5 space-y-4">
          <HealthSummary status={status} />
          <div className="flex flex-wrap gap-3">
            <Link className={textActionClassName} href="/health">
              Open health page
            </Link>
            <Link className={textActionClassName} href="/api/health">
              View JSON health
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
