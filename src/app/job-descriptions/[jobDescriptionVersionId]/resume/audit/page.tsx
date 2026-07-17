import Link from "next/link";
import { notFound } from "next/navigation";
import { ResumeRenderingApprovalPanel } from "@/components/resume-studio/resume-rendering-approval-panel";
import { runResumeAuditAction } from "@/lib/resume-audit/actions";
import {
  getResumeAuditContext,
  parseStoredResumeAuditRun
} from "@/lib/resume-audit/service";
import { getResumeRevisionContext } from "@/lib/resume-revision/service";
import {
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory
} from "@/lib/resume-rendering-approval/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type ResumeAuditPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "audit-created": "Resume audit completed successfully.",
    "audit-reused":
      "The current audit contract, engine, and configuration already had a successful result for this exact composed resume, so the existing audit was reused."
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

export default async function ResumeAuditPage({ params, searchParams }: ResumeAuditPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const runId = getStringParam(query.runId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getResumeAuditContext(workspace.id, jobDescriptionVersionId);
  const revisionContext = await getResumeRevisionContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedRunId = runId ?? context.reusableResumeAuditRun?.id;

  if (!selectedRunId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Resume audit unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Compose employer-facing resume content before running the deterministic truthfulness and readiness audit.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume`}
            >
              Back to Resume Preview
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { run, result } = await parseStoredResumeAuditRun(workspace.id, selectedRunId);
  const sourceType = run.resumeRevisionVersionId ? "FINALIZED_REVISION" : "BASE_COMPOSITION";
  const sourceId = run.resumeRevisionVersionId ?? run.resumeCompositionVersionId;
  const activeApproval = await getActiveResumeRenderingApproval(workspace.id, {
    jobDescriptionVersionId,
    applicationId: run.applicationId
  });
  const approvalHistory = await listResumeRenderingApprovalHistory(workspace.id, {
    jobDescriptionVersionId,
    applicationId: run.applicationId
  });
  const blockingFindings = result.findings.filter((finding) => finding.blocksRendering);
  const warningFindings = result.findings.filter((finding) => finding.severity === "WARNING");

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Resume audit report
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {result.renderingReadiness.replace(/_/g, " ")}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              Audit status {result.status.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume?versionId=${run.resumeCompositionVersionId}`}
            >
              Back to Resume Preview
            </Link>
            <form
              action={runResumeAuditAction.bind(
                null,
                run.resumeCompositionVersionId,
                jobDescriptionVersionId,
                `/job-descriptions/${jobDescriptionVersionId}/resume/audit`
              )}
            >
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                type="submit"
              >
                Run Resume Audit
              </button>
            </form>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={
                revisionContext?.latestDraft
                  ? `/job-descriptions/${jobDescriptionVersionId}/resume/studio?revisionId=${revisionContext.latestDraft.id}`
                  : revisionContext?.latestFinalizedRevision
                    ? `/job-descriptions/${jobDescriptionVersionId}/resume/studio?revisionId=${revisionContext.latestFinalizedRevision.id}`
                    : `/job-descriptions/${jobDescriptionVersionId}/resume/studio`
              }
            >
              {revisionContext?.latestFinalizedRevision ? "View Revision" : "Open Resume Studio"}
            </Link>
            {run.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${run.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Errors</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.errorCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Warnings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.warningCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Statements verified</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{result.summary.statementsVerified}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Page budget</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.summary.pageBudgetStatus.replace(/_/g, " ")}
            </p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Contract version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{run.contractVersion}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Engine version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{run.engineVersion}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Configuration version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{run.configurationVersion}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Blocking Findings</h2>
        <div className="mt-6 space-y-4">
          {blockingFindings.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              No blocking findings were detected.
            </p>
          ) : (
            blockingFindings.map((finding) => (
              <article key={finding.findingId} className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-sm font-semibold text-rose-900">{finding.message}</p>
                <p className="mt-2 text-sm text-rose-800">
                  {finding.ruleId} {finding.section ? `• ${finding.section.replace(/_/g, " ")}` : ""}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <ResumeRenderingApprovalPanel
        applicationId={run.applicationId}
        initialActiveApproval={activeApproval}
        initialEligibility={await getResumeRenderingApprovalEligibility(workspace.id, {
          jobDescriptionVersionId,
          applicationId: run.applicationId,
          sourceType,
          sourceId,
          resumeAuditRunId: run.id
        })}
        initialHistory={approvalHistory}
        jobDescriptionVersionId={jobDescriptionVersionId}
        sourceId={sourceId}
        sourceType={sourceType}
        title={sourceType === "BASE_COMPOSITION" ? "Base Composition Approval" : "Revision Approval"}
      />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Warnings</h2>
        <div className="mt-6 space-y-4">
          {warningFindings.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              No warnings were detected.
            </p>
          ) : (
            warningFindings.map((finding) => (
              <article key={finding.findingId} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-900">{finding.message}</p>
                <p className="mt-2 text-sm text-amber-800">
                  {finding.category.replace(/_/g, " ")} • {finding.ruleId}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Section Results</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.sectionResults.map((section) => (
            <article key={section.sectionType} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-base font-semibold text-stone-900">
                {section.sectionType.replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-sm text-stone-700">
                {section.renderingReadiness.replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-sm text-stone-600">
                {section.errorFindingIds.length} errors • {section.warningFindingIds.length} warnings
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Statement Findings</h2>
        <div className="mt-6 space-y-4">
          {result.statementResults.map((statement) => (
            <details key={statement.statementId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                {statement.statementId} • {statement.renderingEligibility.replace(/_/g, " ")}
              </summary>
              <div className="mt-3 space-y-2 text-sm text-stone-700">
                <p>Section: {statement.section.replace(/_/g, " ")}</p>
                <p>Provenance: {statement.provenanceStatus}</p>
                <p>Truthfulness: {statement.truthfulnessStatus.replace(/_/g, " ")}</p>
                <p>Findings: {statement.findingIds.join(", ") || "None"}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Provenance Links</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/resume?versionId=${run.resumeCompositionVersionId}`}
          >
            Resume Composition
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/resume-plan?versionId=${run.structuredResumeVersionId}`}
          >
            Structured Resume Plan
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/match-report?runId=${run.matchReportRunId}`}
          >
            Match Report
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${run.matchReportRun.evidenceScoringRunId}&retrievalRunId=${run.matchReportRun.evidenceRetrievalRunId}`}
          >
            Evidence Scores
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/evidence?runId=${run.matchReportRun.evidenceRetrievalRunId}`}
          >
            Evidence Retrieval
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href={`/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${run.requirementAnalysisId}`}
          >
            Requirement Analysis
          </Link>
        </div>
      </section>
    </div>
  );
}
