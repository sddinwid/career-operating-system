import Link from "next/link";
import { notFound } from "next/navigation";
import { abbreviateChecksum, countJobDescriptionWords } from "@/lib/job-descriptions/normalize";
import { parseJobDescriptionAction } from "@/lib/job-descriptions/parse-actions";
import { getJobDescriptionAnalysisContext } from "@/lib/job-descriptions/parse-service";
import { getJobRequirementAnalysisContext } from "@/lib/job-descriptions/requirement-analysis-service";
import { getJobDescriptionVersionById } from "@/lib/job-descriptions/service";
import {
  formatApplicationDate,
  formatApplicationDateTime
} from "@/lib/applications/formatters";
import { getDefaultWorkspace } from "@/lib/workspace";

type JobDescriptionDetailPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    created: "Job description saved successfully.",
    duplicate: "This job description already existed for the opportunity, so no duplicate version was created.",
    "parse-created": "Job description parsed successfully.",
    "parse-reused": "The current parser version already had a successful result, so the existing parse was reused.",
    "parse-failed": "Parsing completed with a failed result. Review diagnostics before retrying."
  };

  if (!success || !messages[success]) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {messages[success]}
    </div>
  );
}

export default async function JobDescriptionDetailPage({
  params,
  searchParams
}: JobDescriptionDetailPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const success = typeof query.success === "string"
    ? query.success
    : typeof query.parse === "string"
      ? query.parse
      : undefined;
  const workspace = await getDefaultWorkspace();
  const [version, analysis] = await Promise.all([
    getJobDescriptionVersionById(workspace.id, jobDescriptionVersionId),
    getJobDescriptionAnalysisContext(workspace.id, jobDescriptionVersionId)
  ]);
  const requirementContext = await getJobRequirementAnalysisContext(
    workspace.id,
    jobDescriptionVersionId
  );

  if (!version || !analysis) {
    notFound();
  }

  const applicationLinkId = version.currentForApplications[0]?.id ?? version.sourceApplication?.id;
  const latestParse = analysis.latestParse;
  const latestSuccessfulParse = analysis.latestSuccessfulParse;

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Job description version
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {version.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {version.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={applicationLinkId ? `/applications/${applicationLinkId}` : "/applications"}
            >
              {applicationLinkId ? "Open application" : "Applications"}
            </Link>
            {latestSuccessfulParse ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${version.id}/analysis`}
              >
                View Parsed Job Description
              </Link>
            ) : null}
            {latestSuccessfulParse ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={
                  requirementContext?.latestConfirmedAnalysis
                    ? `/job-descriptions/${version.id}/requirements?analysisId=${requirementContext.latestConfirmedAnalysis.id}`
                    : `/job-descriptions/${version.id}/requirements`
                }
              >
                {requirementContext?.latestConfirmedAnalysis
                  ? "View Confirmed Requirements"
                  : "Review Requirements"}
              </Link>
            ) : null}
            <form
              action={parseJobDescriptionAction.bind(
                null,
                version.id,
                `/job-descriptions/${version.id}`
              )}
            >
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                type="submit"
              >
                {latestSuccessfulParse ? "Reparse with Current Parser" : "Parse Job Description"}
              </button>
            </form>
            {applicationLinkId ? (
              <Link
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                href={`/applications/${applicationLinkId}/job-description`}
              >
                Replace job description
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parse status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestParse?.status.replace(/_/g, " ") ?? "Not parsed"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parser version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestParse?.parserVersion ?? "Not parsed"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Diagnostics</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {analysis.latestParseStatusCounts
                ? `${analysis.latestParseStatusCounts.errors} errors, ${analysis.latestParseStatusCounts.warnings} warnings`
                : "No diagnostics yet"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Requirement review</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {requirementContext?.latestAnalysis?.status.replace(/_/g, " ") ?? "Not reviewed"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {requirementContext?.latestAnalysisContract
                ? `${requirementContext.latestAnalysisContract.summary.requiredCount} required • ${requirementContext.latestAnalysisContract.summary.preferredCount} preferred`
                : "Create from the latest successful parse"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {version.versionNumber}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">State</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {version.active ? "Active" : "Superseded"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Captured</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDateTime(version.capturedAt)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Publication date</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDate(version.publishedAt)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Checksum</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {abbreviateChecksum(version.checksum)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Source type</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {version.sourceType.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:col-span-2">
            <p className="text-sm font-medium text-stone-500">Source URL</p>
            <p className="mt-2 break-all text-sm leading-6 text-stone-700">
              {version.sourceUrl ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Text size</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {version.originalText.length.toLocaleString()} characters
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {countJobDescriptionWords(version.originalText).toLocaleString()} words
            </p>
          </article>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-stone-600">
          {version.predecessor ? (
            <Link
              className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${version.predecessor.id}`}
            >
              View predecessor (v{version.predecessor.versionNumber})
            </Link>
          ) : null}
          {version.successors.map((successor) => (
            <Link
              key={successor.id}
              className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${successor.id}`}
            >
              View successor (v{successor.versionNumber})
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Original text</h2>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-800">
          {version.originalText}
        </pre>
      </section>
    </div>
  );
}
