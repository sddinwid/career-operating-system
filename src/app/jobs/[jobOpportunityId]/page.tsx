import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobWorkspaceDetail } from "@/lib/jobs/service";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  cardClassName,
  mutedCardClassName,
  textActionClassName
} from "@/lib/ui";

type JobDetailPageProps = {
  params: Promise<{ jobOpportunityId: string }>;
};

function toLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobOpportunityId } = await params;
  const workspace = await getDefaultWorkspace();
  const detail = await getJobWorkspaceDetail(workspace.id, jobOpportunityId);

  if (!detail) {
    notFound();
  }

  const { opportunity, summary } = detail;

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Opportunity detail
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">{opportunity.company.name}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-600">
              <span>{opportunity.jobUrl ?? "No canonical URL"}</span>
              <span>{opportunity.location ?? "Location not captured"}</span>
              <span>
                {opportunity.workArrangement ? toLabel(opportunity.workArrangement) : "Work arrangement not captured"}
              </span>
              <span>
                {summary?.linkedApplication ? "Application linked" : "No application linked"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonSecondaryClassName} href="/jobs">
              Back to jobs
            </Link>
            {summary?.linkedApplication ? (
              <Link
                className={buttonSecondaryClassName}
                href={`/applications/${summary.linkedApplication.id}`}
              >
                Open application
              </Link>
            ) : null}
            {summary?.currentJobDescription ? (
              <Link
                className={buttonPrimaryClassName}
                href={`/job-descriptions/${summary.currentJobDescription.id}`}
              >
                View current description
              </Link>
            ) : (
              <Link className={buttonPrimaryClassName} href="/jobs/new">
                Capture job description
              </Link>
            )}
          </div>
        </div>

        {summary ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Parse", summary.statusLabels.parse],
              ["Requirement review", summary.statusLabels.requirement],
              ["Downstream readiness", summary.statusLabels.readiness],
              ["Evidence retrieval", summary.statusLabels.retrieval],
              ["Evidence scoring", summary.statusLabels.scoring],
              ["Match report", summary.statusLabels.matchReport],
              ["Resume plan", summary.statusLabels.plan],
              ["Resume composition", summary.statusLabels.composition],
              ["Resume audit", summary.statusLabels.audit],
              ["Rendering approval", summary.statusLabels.approval]
            ].map(([label, value]) => (
              <article key={label} className={mutedCardClassName}>
                <p className="text-sm font-medium text-stone-500">{label}</p>
                <p className="mt-2 text-lg font-semibold text-stone-900">{value}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">Job description history</h2>
            <p className="mt-2 text-sm text-stone-600">
              Immutable saved versions remain visible here. Viewing this page does not mutate any
              job or application state.
            </p>
          </div>
        </div>

        {opportunity.jobDescriptionVersions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
            No job description has been saved for this opportunity yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {opportunity.jobDescriptionVersions.map((version) => {
              const latestParse = version.parses[0] ?? null;
              const latestAnalysis =
                version.requirementAnalyses
                  .slice()
                  .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
              const latestRetrieval = version.evidenceRetrievalRuns[0] ?? null;
              const latestScoring = version.evidenceScoringRuns[0] ?? null;
              const latestReport = version.matchReportRuns[0] ?? null;
              const latestPlan = version.structuredResumeVersions[0] ?? null;
              const latestComposition = version.resumeCompositionVersions[0] ?? null;
              const latestAudit = version.resumeAuditRuns[0] ?? null;
              const latestApproval = version.resumeRenderingApprovals[0] ?? null;
              const latestDocument = version.documentVersions[0] ?? null;

              return (
                <article key={version.id} className={mutedCardClassName}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-stone-900">
                        Version {version.versionNumber} {version.active ? "- Active" : "- Superseded"}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        Saved {version.capturedAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {version.currentForApplications.length > 0
                          ? `Current for ${version.currentForApplications.length} application record${version.currentForApplications.length === 1 ? "" : "s"}`
                          : "Not linked as the current description for an application"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link className={buttonSecondaryClassName} href={`/job-descriptions/${version.id}`}>
                        View description
                      </Link>
                      {latestParse ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/analysis`}
                        >
                          Parsed analysis
                        </Link>
                      ) : null}
                      {latestAnalysis ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/requirements`}
                        >
                          Requirement review
                        </Link>
                      ) : null}
                      {latestRetrieval ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/evidence?runId=${latestRetrieval.id}`}
                        >
                          Evidence
                        </Link>
                      ) : null}
                      {latestScoring ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/evidence/scores?runId=${latestScoring.id}&retrievalRunId=${latestScoring.evidenceRetrievalRunId}`}
                        >
                          Scores
                        </Link>
                      ) : null}
                      {latestReport ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/match-report?runId=${latestReport.id}&scoringRunId=${latestReport.evidenceScoringRunId}`}
                        >
                          Match report
                        </Link>
                      ) : null}
                      {latestPlan ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/resume-plan?versionId=${latestPlan.id}`}
                        >
                          Resume plan
                        </Link>
                      ) : null}
                      {latestComposition ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/resume?versionId=${latestComposition.id}`}
                        >
                          Resume
                        </Link>
                      ) : null}
                      {latestAudit ? (
                        <Link
                          className={buttonSecondaryClassName}
                          href={`/job-descriptions/${version.id}/resume/audit?runId=${latestAudit.id}`}
                        >
                          Resume audit
                        </Link>
                      ) : null}
                      {latestDocument ? (
                        <Link className={buttonPrimaryClassName} href={`/documents/${latestDocument.id}`}>
                          Latest artifact
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-stone-700">
                    <span>Parse: {latestParse ? `${toLabel(latestParse.status)} - ${latestParse.parserVersion}` : "Not parsed"}</span>
                    <span>
                      Requirements:{" "}
                      {latestAnalysis
                        ? `${toLabel(latestAnalysis.status)} - ${latestAnalysis.classifierVersion}`
                        : "Not reviewed"}
                    </span>
                    <span>
                      Evidence: {latestRetrieval ? "Retrieved" : "Not retrieved"}
                    </span>
                    <span>Match report: {latestReport ? "Generated" : "Not generated"}</span>
                    <span>Resume: {latestComposition ? "Composed" : "Not composed"}</span>
                    <span>
                      Approval:{" "}
                      {latestApproval ? latestApproval.renderingReadiness.replace(/_/g, " ") : "Not approved"}
                    </span>
                  </div>

                  {version.documentVersions.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      {version.documentVersions.map((document) => (
                        <Link
                          key={document.id}
                          className={textActionClassName}
                          href={`/documents/${document.id}`}
                        >
                          {document.format} artifact
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
