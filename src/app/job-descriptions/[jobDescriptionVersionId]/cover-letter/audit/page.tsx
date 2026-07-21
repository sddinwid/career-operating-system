import Link from "next/link";
import { notFound } from "next/navigation";
import { runCoverLetterAuditAction } from "@/lib/cover-letter-audit/actions";
import { getCoverLetterAuditContext, parseStoredCoverLetterAuditRun } from "@/lib/cover-letter-audit/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type PageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function CoverLetterAuditPage({ params, searchParams }: PageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const runId = getStringParam(query.runId);
  const workspace = await getDefaultWorkspace();
  const context = await getCoverLetterAuditContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedRunId = runId ?? context.reusableAuditRun?.id;
  if (!selectedRunId) {
    return (
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Cover-letter audit unavailable</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
          Create a cover-letter composition or finalize a revision before running the deterministic audit.
        </p>
      </section>
    );
  }

  const { run, result } = await parseStoredCoverLetterAuditRun(workspace.id, selectedRunId);
  const grouped = {
    blocking: result.findings.filter((finding) => finding.blocksFinalization),
    warnings: result.findings.filter((finding) => finding.severity === "WARNING"),
    information: result.findings.filter((finding) => finding.severity === "INFORMATION")
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">Cover-letter audit report</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {result.renderingReadiness.replace(/_/g, " ")}
            </h1>
            <p className="mt-3 text-base text-stone-600">Audit status {result.status.replace(/_/g, " ")}</p>
            <p className="mt-2 text-sm text-stone-500">
              Source {result.sourceType === "FINALIZED_REVISION" ? "Finalized Revision" : "Base Composition"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {run.coverLetterRevisionVersionId ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?revisionId=${run.coverLetterRevisionVersionId}`}
                >
                  Back to Studio
                </Link>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/compare?revisionId=${run.coverLetterRevisionVersionId}`}
                >
                  View Comparison
                </Link>
              </>
            ) : (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter?versionId=${run.coverLetterCompositionVersionId}`}
              >
                Back to Preview
              </Link>
            )}
            <form
              action={runCoverLetterAuditAction.bind(
                null,
                result.sourceType,
                result.sourceType === "FINALIZED_REVISION"
                  ? (run.coverLetterRevisionVersionId as string)
                  : run.coverLetterCompositionVersionId,
                jobDescriptionVersionId,
                `/job-descriptions/${jobDescriptionVersionId}/cover-letter/audit`
              )}
            >
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                type="submit"
              >
                Run Audit
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Blocking</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.blockingFindingCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Warnings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.warningCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Information</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.informationCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Checksum</p>
            <p className="mt-2 break-all text-sm font-semibold text-stone-900">{result.contentChecksum}</p>
          </article>
        </div>
      </section>

      {(["blocking", "warnings", "information"] as const).map((group) => (
        <section key={group} className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            {group === "blocking" ? "Blocking Findings" : group === "warnings" ? "Warnings" : "Information"}
          </h2>
          <div className="mt-6 space-y-4">
            {grouped[group].length === 0 ? (
              <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
                No {group} findings were detected.
              </p>
            ) : (
              grouped[group].map((finding) => (
                <article key={finding.findingId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                  <p className="text-sm font-semibold text-stone-900">{finding.message}</p>
                  <p className="mt-2 text-sm text-stone-700">
                    {finding.ruleId} {finding.paragraphId ? `- paragraph ${finding.paragraphId}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    Evidence {finding.sourceEvidenceIds.join(", ") || "None"} - Requirements{" "}
                    {finding.sourceRequirementIds.join(", ") || "None"}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
