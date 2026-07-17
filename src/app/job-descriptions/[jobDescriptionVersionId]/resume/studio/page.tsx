import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResumeRenderingApprovalPanel } from "@/components/resume-studio/resume-rendering-approval-panel";
import { runResumeRevisionAuditAction } from "@/lib/resume-audit/actions";
import { parseStoredResumeAuditRun } from "@/lib/resume-audit/service";
import {
  getResumeRevisionVersionById,
  openResumeStudio,
  parseStoredResumeRevisionVersion
} from "@/lib/resume-revision/service";
import {
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory
} from "@/lib/resume-rendering-approval/service";
import { ResumeStudioEditor } from "@/components/resume-studio/resume-studio-editor";
import { getDefaultWorkspace } from "@/lib/workspace";

type ResumeStudioPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "revision-finalized": "Resume revision finalized successfully.",
    "audit-created": "Revision audit completed successfully.",
    "audit-reused":
      "The current audit contract, engine, and configuration already had a successful result for this exact revised resume, so the existing audit was reused."
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

export default async function ResumeStudioPage({
  params,
  searchParams
}: ResumeStudioPageProps) {
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
        revision: await getResumeRevisionVersionById(workspace.id, revisionId)
      }
    : await openResumeStudio(workspace.id, jobDescriptionVersionId, undefined, {
        createSuccessorDraft: newRevision === "1"
      });

  if (!opened.revision) {
    notFound();
  }

  if (!revisionId || opened.mode !== "direct") {
    redirect(
      `/job-descriptions/${jobDescriptionVersionId}/resume/studio?revisionId=${opened.revision.id}${
        success ? `&success=${success}` : ""
      }`
    );
  }

  const { version, record } = await parseStoredResumeRevisionVersion(workspace.id, opened.revision.id);
  const selectedAudit = runId ? await parseStoredResumeAuditRun(workspace.id, runId) : null;
  const latestAudit = selectedAudit
    ? {
        id: selectedAudit.run.id,
        status: selectedAudit.run.status,
        renderingReadiness: selectedAudit.result.renderingReadiness,
        summary: `${selectedAudit.result.summary.errorCount} errors • ${selectedAudit.result.summary.warningCount} warnings`
      }
    : version.resumeAuditRuns[0]
      ? {
          id: version.resumeAuditRuns[0].id,
          status: version.resumeAuditRuns[0].status,
          renderingReadiness: version.resumeAuditRuns[0].renderingReadiness,
          summary:
            version.resumeAuditRuns[0].summary && typeof version.resumeAuditRuns[0].summary === "object"
              ? `${((version.resumeAuditRuns[0].summary as { errorCount?: number }).errorCount ?? 0).toString()} errors • ${((version.resumeAuditRuns[0].summary as { warningCount?: number }).warningCount ?? 0).toString()} warnings`
              : null
        }
      : null;

  const readOnly = version.status !== "DRAFT";
  const activeApproval = await getActiveResumeRenderingApproval(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });
  const approvalHistory = await listResumeRenderingApprovalHistory(workspace.id, {
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
                Finalized revisions are read-only. Create a successor revision to continue editing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/studio?newRevision=1`}
              >
                Create New Revision
              </Link>
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=BASE_VS_REVISION&revisionId=${version.id}`}
              >
                Compare with Base
              </Link>
              {record.content.predecessorRevisionId ? (
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=PREDECESSOR_VS_REVISION&revisionId=${version.id}`}
                >
                  Compare with Predecessor
                </Link>
              ) : null}
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=CURRENT_APPROVAL_VS_PROPOSED&revisionId=${version.id}`}
              >
                Compare with Current Approval
              </Link>
              <form
                action={runResumeRevisionAuditAction.bind(
                  null,
                  version.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/resume/studio?revisionId=${version.id}`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Run Audit on Revised Resume
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <ResumeStudioEditor
        initialRecord={record}
        jobDescriptionVersionId={jobDescriptionVersionId}
        latestAudit={latestAudit}
        readOnly={readOnly}
      />

      {readOnly && latestAudit ? (
        <ResumeRenderingApprovalPanel
          applicationId={version.applicationId}
          initialActiveApproval={activeApproval}
          initialEligibility={await getResumeRenderingApprovalEligibility(workspace.id, {
            jobDescriptionVersionId,
            applicationId: version.applicationId,
            sourceType: "FINALIZED_REVISION",
            sourceId: version.id,
            resumeAuditRunId: latestAudit.id
          })}
          initialHistory={approvalHistory}
          jobDescriptionVersionId={jobDescriptionVersionId}
          sourceId={version.id}
          sourceType="FINALIZED_REVISION"
          title="Revision Approval"
        />
      ) : null}
    </div>
  );
}
