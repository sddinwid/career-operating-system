import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoverLetterApprovalPanel } from "@/components/cover-letter-studio/cover-letter-approval-panel";
import { CoverLetterStudioEditor } from "@/components/cover-letter-studio/cover-letter-studio-editor";
import { runCoverLetterAuditAction } from "@/lib/cover-letter-audit/actions";
import { parseStoredCoverLetterAuditRun } from "@/lib/cover-letter-audit/service";
import {
  getActiveCoverLetterApproval,
  getCoverLetterApprovalEligibility,
  listCoverLetterApprovalHistory
} from "@/lib/cover-letter-approval/service";
import {
  getCoverLetterRevisionVersionById,
  openCoverLetterStudio,
  parseStoredCoverLetterRevisionVersion
} from "@/lib/cover-letter-revision/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type PageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "revision-finalized": "Cover-letter revision finalized successfully.",
    "audit-created": "Cover-letter audit completed successfully.",
    "audit-reused":
      "The current audit contract, engine, and configuration already had a successful result for this exact revised cover letter, so the existing audit was reused."
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

export default async function CoverLetterStudioPage({ params, searchParams }: PageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const revisionId = getStringParam(query.revisionId);
  const runId = getStringParam(query.runId);
  const success = getStringParam(query.success);
  const newRevision = getStringParam(query.newRevision);
  const workspace = await getDefaultWorkspace();

  const opened = revisionId
    ? {
        mode: "direct" as const,
        revision: await getCoverLetterRevisionVersionById(workspace.id, revisionId)
      }
    : await openCoverLetterStudio(workspace.id, jobDescriptionVersionId, undefined, {
        createSuccessorDraft: newRevision === "1"
      });

  if (!opened.revision) {
    notFound();
  }

  if (!revisionId || opened.mode !== "direct") {
    redirect(
      `/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?revisionId=${opened.revision.id}${
        success ? `&success=${success}` : ""
      }`
    );
  }

  const { version, record } = await parseStoredCoverLetterRevisionVersion(workspace.id, opened.revision.id);
  const selectedAudit = runId ? await parseStoredCoverLetterAuditRun(workspace.id, runId) : null;
  const latestAudit = selectedAudit
    ? {
        id: selectedAudit.run.id,
        status: selectedAudit.run.status,
        renderingReadiness: selectedAudit.result.renderingReadiness,
        summary: `${selectedAudit.result.summary.errorCount} errors - ${selectedAudit.result.summary.warningCount} warnings`
      }
    : version.coverLetterAuditRuns[0]
      ? {
          id: version.coverLetterAuditRuns[0].id,
          status: version.coverLetterAuditRuns[0].status,
          renderingReadiness: version.coverLetterAuditRuns[0].renderingReadiness,
          summary:
            version.coverLetterAuditRuns[0].summary && typeof version.coverLetterAuditRuns[0].summary === "object"
              ? `${((version.coverLetterAuditRuns[0].summary as { errorCount?: number }).errorCount ?? 0).toString()} errors - ${((version.coverLetterAuditRuns[0].summary as { warningCount?: number }).warningCount ?? 0).toString()} warnings`
              : null
        }
      : null;

  const readOnly = version.status !== "DRAFT";
  const activeApproval = await getActiveCoverLetterApproval(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });
  const approvalHistory = await listCoverLetterApprovalHistory(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      {readOnly ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">Revision actions</h2>
              <p className="mt-2 text-sm text-stone-600">
                Finalized revisions are read-only. Create a successor draft to continue editing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?newRevision=1`}
              >
                Create Successor Draft
              </Link>
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/compare?revisionId=${version.id}`}
              >
                View Comparison
              </Link>
              <form
                action={runCoverLetterAuditAction.bind(
                  null,
                  "FINALIZED_REVISION",
                  version.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?revisionId=${version.id}`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Run Audit
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <CoverLetterStudioEditor
        initialRecord={record}
        jobDescriptionVersionId={jobDescriptionVersionId}
        latestAudit={latestAudit}
        readOnly={readOnly}
      />

      {readOnly && latestAudit ? (
        <CoverLetterApprovalPanel
          applicationId={version.applicationId}
          coverLetterAuditRunId={latestAudit.id}
          sourceType="FINALIZED_REVISION"
          sourceId={version.id}
          initialActiveApproval={activeApproval}
          initialEligibility={await getCoverLetterApprovalEligibility(workspace.id, {
            jobDescriptionVersionId,
            applicationId: version.applicationId,
            sourceType: "FINALIZED_REVISION",
            sourceId: version.id,
            coverLetterAuditRunId: latestAudit.id
          })}
          initialHistory={approvalHistory}
          jobDescriptionVersionId={jobDescriptionVersionId}
        />
      ) : null}
    </div>
  );
}
