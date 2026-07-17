import Link from "next/link";
import { notFound } from "next/navigation";
import { compareResumeSources } from "@/lib/resume-comparison/service";
import { ResumeRenderingApprovalPanel } from "@/components/resume-studio/resume-rendering-approval-panel";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getResumeCompositionContext } from "@/lib/resume-composition/service";
import { getResumeRevisionContext, parseStoredResumeRevisionVersion } from "@/lib/resume-revision/service";
import {
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory
} from "@/lib/resume-rendering-approval/service";

type ComparePageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ResumeComparePage({ params, searchParams }: ComparePageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const mode = getStringParam(query.mode) ?? "BASE_VS_REVISION";
  const revisionId = getStringParam(query.revisionId);
  const workspace = await getDefaultWorkspace();
  const compositionContext = await getResumeCompositionContext(workspace.id, jobDescriptionVersionId);
  const revisionContext = await getResumeRevisionContext(workspace.id, jobDescriptionVersionId);

  if (!compositionContext?.reusableResumeCompositionVersion) {
    notFound();
  }

  const baseCompositionId = compositionContext.reusableResumeCompositionVersion.id;
  const finalizedRevisionId = revisionId ?? revisionContext?.latestFinalizedRevision?.id;

  if (!finalizedRevisionId) {
    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Comparison unavailable</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Finalize and audit a revision before using deterministic resume comparison.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume/studio`}
            >
              Open Resume Studio
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const revision = await parseStoredResumeRevisionVersion(workspace.id, finalizedRevisionId);
  const activeApproval = await getActiveResumeRenderingApproval(workspace.id, {
    jobDescriptionVersionId,
    applicationId: revision.version.applicationId
  });
  const history = await listResumeRenderingApprovalHistory(workspace.id, {
    jobDescriptionVersionId,
    applicationId: revision.version.applicationId
  });

  const comparisonArgs =
    mode === "PREDECESSOR_VS_REVISION"
      ? revision.record.content.predecessorRevisionId
        ? {
            comparisonMode: "PREDECESSOR_VS_REVISION" as const,
            leftSourceType: "FINALIZED_REVISION" as const,
            leftSourceId: revision.record.content.predecessorRevisionId,
            rightSourceType: "FINALIZED_REVISION" as const,
            rightSourceId: finalizedRevisionId
          }
        : null
      : mode === "CURRENT_APPROVAL_VS_PROPOSED"
        ? activeApproval
          ? {
              comparisonMode: "CURRENT_APPROVAL_VS_PROPOSED" as const,
              leftSourceType: activeApproval.sourceType,
              leftSourceId: activeApproval.sourceId,
              rightSourceType: "FINALIZED_REVISION" as const,
              rightSourceId: finalizedRevisionId
            }
          : null
        : {
            comparisonMode: "BASE_VS_REVISION" as const,
            leftSourceType: "BASE_COMPOSITION" as const,
            leftSourceId: baseCompositionId,
            rightSourceType: "FINALIZED_REVISION" as const,
            rightSourceId: finalizedRevisionId
          };

  if (!comparisonArgs) {
    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Comparison unavailable</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            {mode === "PREDECESSOR_VS_REVISION"
              ? "This finalized revision does not have a predecessor yet."
              : "There is no active rendering approval to compare against."}
          </p>
        </section>
      </div>
    );
  }

  const comparison = await compareResumeSources(
    workspace.id,
    {
      ...comparisonArgs,
      jobDescriptionVersionId
    }
  );
  const approvalEligibility = comparison.right.auditId
    ? await getResumeRenderingApprovalEligibility(workspace.id, {
        jobDescriptionVersionId,
        applicationId: comparison.applicationId,
        sourceType: comparison.right.sourceType,
        sourceId: comparison.right.sourceId,
        resumeAuditRunId: comparison.right.auditId
      })
    : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Resume comparison
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {revision.record.content.targetRole}
            </h1>
            <p className="mt-3 text-base text-stone-600">{revision.record.content.targetCompany}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume/studio?revisionId=${finalizedRevisionId}`}
            >
              Back to Revision
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume/audit?runId=${comparison.right.auditId ?? ""}`}
            >
              View Revision Audit
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            className={`rounded-full px-4 py-2 font-semibold ${mode === "BASE_VS_REVISION" ? "bg-stone-950 text-white" : "border border-stone-300 text-stone-700"}`}
            href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=BASE_VS_REVISION&revisionId=${finalizedRevisionId}`}
          >
            Base vs Current Revision
          </Link>
          <Link
            className={`rounded-full px-4 py-2 font-semibold ${mode === "PREDECESSOR_VS_REVISION" ? "bg-stone-950 text-white" : "border border-stone-300 text-stone-700"}`}
            href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=PREDECESSOR_VS_REVISION&revisionId=${finalizedRevisionId}`}
          >
            Compare with Predecessor
          </Link>
          <Link
            className={`rounded-full px-4 py-2 font-semibold ${mode === "CURRENT_APPROVAL_VS_PROPOSED" ? "bg-stone-950 text-white" : "border border-stone-300 text-stone-700"}`}
            href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=CURRENT_APPROVAL_VS_PROPOSED&revisionId=${finalizedRevisionId}`}
          >
            Compare with Current Approval
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Sections changed</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.summary.sectionsChanged}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Statements changed</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.summary.statementsChanged}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">New blocking findings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.summary.newBlockingFindings}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Remaining blocking findings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.summary.remainingBlockingFindings}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Comparison Header</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Left</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.left.label}</p>
            <p className="mt-1 text-sm text-stone-600">
              {comparison.left.sourceType.replace(/_/g, " ")} • {comparison.left.renderingReadiness?.replace(/_/g, " ") ?? "Not audited"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Right</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{comparison.right.label}</p>
            <p className="mt-1 text-sm text-stone-600">
              {comparison.right.sourceType.replace(/_/g, " ")} • {comparison.right.renderingReadiness?.replace(/_/g, " ") ?? "Not audited"}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Resume Diff</h2>
        <div className="mt-6 space-y-6">
          {comparison.sections.map((section) => (
            <article key={section.sectionType} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-stone-900">{section.sectionType.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {section.changeState.replace(/_/g, " ")} • {section.itemAdditions} additions • {section.itemRemovals} removals • {section.itemReorderings} reorderings
                  </p>
                </div>
                <p className="text-sm text-stone-600">
                  Findings resolved {section.auditImpactSummary.resolved} • remaining {section.auditImpactSummary.remaining} • introduced {section.auditImpactSummary.introduced}
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {section.statements
                  .filter((statement) => statement.changeState !== "UNCHANGED")
                  .map((statement) => (
                    <article key={statement.stableId} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-sm font-semibold text-stone-900">
                        {statement.itemType.replace(/_/g, " ")} • {statement.changeState.replace(/_/g, " ")}
                      </p>
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Original</p>
                          <p className="mt-2 text-sm leading-6 text-stone-700">{statement.leftText ?? "Removed"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Revised</p>
                          <p className="mt-2 text-sm leading-6 text-stone-700">{statement.rightText ?? "Not present"}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-stone-600">
                        Provenance {statement.provenancePreserved ? "preserved" : "changed"} • Audit impact {statement.auditFindingChanges.join(", ") || "none"}
                      </p>
                    </article>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Audit Comparison</h2>
        <div className="mt-6 space-y-3">
          {comparison.findingChanges.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
              No paired audit findings were available for comparison.
            </p>
          ) : (
            comparison.findingChanges.map((finding) => (
              <article key={`${finding.comparisonKey}-${finding.comparisonState}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                <p className="font-semibold text-stone-900">
                  {finding.comparisonState} • {finding.ruleId}
                </p>
                <p className="mt-1">
                  {finding.section?.replace(/_/g, " ") ?? "Global"} • {finding.category.replace(/_/g, " ")}
                </p>
                <p className="mt-1">
                  Left {finding.leftSeverity ?? "none"} • Right {finding.rightSeverity ?? "none"}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {approvalEligibility ? (
        <ResumeRenderingApprovalPanel
          applicationId={comparison.applicationId}
          initialActiveApproval={activeApproval}
          initialEligibility={approvalEligibility}
          initialHistory={history}
          jobDescriptionVersionId={jobDescriptionVersionId}
          sourceId={comparison.right.sourceId}
          sourceType={comparison.right.sourceType}
          title="Rendering Approval"
        />
      ) : null}
    </div>
  );
}
