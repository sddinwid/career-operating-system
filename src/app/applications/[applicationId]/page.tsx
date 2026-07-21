import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentFormat } from "@prisma/client";
import {
  formatApplicationDate,
  formatApplicationDateTime,
  formatSalaryRange,
  formatWorkArrangement
} from "@/lib/applications/formatters";
import {
  archiveApplicationAction,
  restoreApplicationAction
} from "@/lib/applications/actions";
import { renderApprovedCoverLetterDocumentAction } from "@/lib/cover-letter-rendering/actions";
import { getLatestRenderedCoverLetterDocumentVersion } from "@/lib/cover-letter-rendering/service";
import { renderApprovedResumeDocumentAction } from "@/lib/document-rendering/actions";
import { getLatestRenderedResumeDocumentVersion } from "@/lib/document-rendering/service";
import { runResumeAuditAction } from "@/lib/resume-audit/actions";
import { getResumeAuditContext } from "@/lib/resume-audit/service";
import {
  getActiveResumeRenderingApproval,
  listResumeRenderingApprovalHistory
} from "@/lib/resume-rendering-approval/service";
import { getResumeRevisionContext } from "@/lib/resume-revision/service";
import { createResumeCompositionAction } from "@/lib/resume-composition/actions";
import { getResumeCompositionContext } from "@/lib/resume-composition/service";
import { createCoverLetterCompositionAction } from "@/lib/cover-letter-composition/actions";
import { getCoverLetterApprovalContext } from "@/lib/cover-letter-approval/service";
import { getCoverLetterAuditContext } from "@/lib/cover-letter-audit/service";
import { getCoverLetterCompositionContext } from "@/lib/cover-letter-composition/service";
import { getCoverLetterRevisionContext } from "@/lib/cover-letter-revision/service";
import { scoreRetrievedEvidenceAction } from "@/lib/evidence-scoring/actions";
import { getEvidenceScoringContext } from "@/lib/evidence-scoring/service";
import { generateMatchReportAction } from "@/lib/match-report/actions";
import { getMatchReportContext } from "@/lib/match-report/service";
import { createStructuredResumePlanAction } from "@/lib/structured-resume/actions";
import { getStructuredResumeContext } from "@/lib/structured-resume/service";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import { getEvidenceRetrievalContext } from "@/lib/evidence-retrieval/service";
import { parseJobDescriptionAction } from "@/lib/job-descriptions/parse-actions";
import { getJobRequirementAnalysisContext } from "@/lib/job-descriptions/requirement-analysis-service";
import { getApplicationDetail } from "@/lib/applications/service";
import { countJobDescriptionWords } from "@/lib/job-descriptions/normalize";
import { getDefaultWorkspace } from "@/lib/workspace";

type ApplicationDetailPageProps = {
  params: Promise<{ applicationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    created: "Application created successfully.",
    updated: "Application updated successfully.",
    restored: "Application restored.",
    "job-description-saved": "Job description saved successfully.",
    "job-description-duplicate":
      "That exact job description already existed for this opportunity, so the existing version was linked without creating a duplicate.",
    "parse-created": "Job description parsed successfully.",
    "parse-reused":
      "The current parser version already had a successful result, so the existing parse was reused.",
    "parse-failed": "Parsing completed with a failed result. Review diagnostics before retrying.",
    "retrieval-created": "Career evidence retrieval completed successfully.",
    "retrieval-reused":
      "The current retrieval contract and engine already had a successful result for these exact inputs, so the existing run was reused.",
    "scoring-created": "Evidence scoring completed successfully.",
    "scoring-reused":
      "The current scoring contract, engine, and configuration already had a successful result for this exact retrieval run, so the existing scoring run was reused.",
    "report-created": "Match report generated successfully.",
    "report-reused":
      "The current report contract, engine, and configuration already had a successful result for this exact scoring run, so the existing match report was reused.",
    "plan-created": "Structured resume plan created successfully.",
    "plan-reused":
      "The current structured resume contract, engine, and configuration already had a successful result for this exact match report and career profile, so the existing plan was reused.",
    "composition-created": "Targeted resume composed successfully.",
    "composition-reused":
      "The current composition contract, engine, and configuration already had a successful result for this exact structured plan and career profile, so the existing resume content was reused.",
    "cover-letter-created": "Cover letter composed successfully.",
    "cover-letter-reused":
      "The current cover-letter contract, engine, and configuration already had a successful result for these exact inputs, so the existing composition was reused.",
    "audit-created": "Resume audit completed successfully.",
    "audit-reused":
      "The current audit contract, engine, and configuration already had a successful result for this exact composed resume, so the existing audit was reused.",
    "pdf-document-rendered": "Approved resume rendered to an immutable PDF successfully.",
    "pdf-document-reused":
      "The active approved resume already had a matching immutable PDF, so the existing document version was reused.",
    "docx-document-rendered": "Approved resume rendered to an immutable DOCX successfully.",
    "docx-document-reused":
      "The active approved resume already had a matching immutable DOCX, so the existing document version was reused.",
    "cover-letter-pdf-document-rendered":
      "Approved cover letter rendered to an immutable PDF successfully.",
    "cover-letter-pdf-document-reused":
      "The active approved cover letter already had a matching immutable PDF, so the existing document version was reused.",
    "cover-letter-docx-document-rendered":
      "Approved cover letter rendered to an immutable DOCX successfully.",
    "cover-letter-docx-document-reused":
      "The active approved cover letter already had a matching immutable DOCX, so the existing document version was reused."
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

export default async function ApplicationDetailPage({
  params,
  searchParams
}: ApplicationDetailPageProps) {
  const { applicationId } = await params;
  const query = (await searchParams) ?? {};
  const success = typeof query.success === "string"
    ? query.success
    : typeof query.parse === "string"
      ? query.parse
      : undefined;
  const workspace = await getDefaultWorkspace();
  const application = await getApplicationDetail({
    workspaceId: workspace.id,
    applicationId
  });

  if (!application) {
    notFound();
  }

  const requirementContext = application.currentJobDescriptionVersion
    ? await getJobRequirementAnalysisContext(
        workspace.id,
        application.currentJobDescriptionVersion.id
      )
    : null;
  const retrievalContext = application.currentJobDescriptionVersion
    ? await getEvidenceRetrievalContext(
        workspace.id,
        application.currentJobDescriptionVersion.id
      )
    : null;
  const scoringContext = application.currentJobDescriptionVersion
    ? await getEvidenceScoringContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const reportContext = application.currentJobDescriptionVersion
    ? await getMatchReportContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const resumePlanContext = application.currentJobDescriptionVersion
    ? await getStructuredResumeContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const resumeCompositionContext = application.currentJobDescriptionVersion
    ? await getResumeCompositionContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const coverLetterContext = application.currentJobDescriptionVersion
    ? await getCoverLetterCompositionContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const coverLetterRevisionContext = application.currentJobDescriptionVersion
    ? await getCoverLetterRevisionContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const coverLetterAuditContext = application.currentJobDescriptionVersion
    ? await getCoverLetterAuditContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const coverLetterApprovalContext = application.currentJobDescriptionVersion
    ? await getCoverLetterApprovalContext(workspace.id, {
        jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
        applicationId: application.id
      })
    : null;
  const resumeAuditContext = application.currentJobDescriptionVersion
    ? await getResumeAuditContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const resumeRevisionContext = application.currentJobDescriptionVersion
    ? await getResumeRevisionContext(workspace.id, application.currentJobDescriptionVersion.id)
    : null;
  const resumeRenderingApproval =
    application.currentJobDescriptionVersion
      ? await getActiveResumeRenderingApproval(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id
        })
      : null;
  const resumeRenderingApprovalHistory =
    application.currentJobDescriptionVersion
      ? await listResumeRenderingApprovalHistory(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id
        })
      : [];
  const latestRenderedResumePdf =
    application.currentJobDescriptionVersion
      ? await getLatestRenderedResumeDocumentVersion(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id,
          format: DocumentFormat.PDF
        })
      : null;
  const latestRenderedResumeDocx =
    application.currentJobDescriptionVersion
      ? await getLatestRenderedResumeDocumentVersion(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id,
          format: DocumentFormat.DOCX
        })
      : null;
  const latestRenderedCoverLetterPdf =
    application.currentJobDescriptionVersion
      ? await getLatestRenderedCoverLetterDocumentVersion(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id,
          format: DocumentFormat.PDF
        })
      : null;
  const latestRenderedCoverLetterDocx =
    application.currentJobDescriptionVersion
      ? await getLatestRenderedCoverLetterDocumentVersion(workspace.id, {
          jobDescriptionVersionId: application.currentJobDescriptionVersion.id,
          applicationId: application.id,
          format: DocumentFormat.DOCX
        })
      : null;

  const isArchived = application.archivedAt !== null;
  const retrievalReady = Boolean(
    retrievalContext?.latestCareerProfileVersion &&
      retrievalContext?.latestConfirmedRequirementAnalysis &&
      application.currentJobDescriptionVersion?.parses[0]
  );
  const retrievalSummary =
    retrievalContext?.reusableRun?.summary &&
    typeof retrievalContext.reusableRun.summary === "object"
      ? (retrievalContext.reusableRun.summary as {
          noCandidateCount?: number;
          limitedCandidateCount?: number;
        })
      : null;
  const retrievalStateLabel = retrievalContext?.reusableRun
    ? (retrievalSummary?.noCandidateCount ?? 0) > 0 ||
      (retrievalSummary?.limitedCandidateCount ?? 0) > 0
      ? "Evidence Retrieval Has Gaps"
      : "Evidence Retrieved"
    : retrievalReady
      ? "Evidence Retrieval Ready"
      : "Evidence Retrieval Not Ready";
  const scoringSummary =
    scoringContext?.reusableScoringRun?.summary &&
    typeof scoringContext.reusableScoringRun.summary === "object"
      ? (scoringContext.reusableScoringRun.summary as {
          requiredStrongEvidenceCount?: number;
          requiredGoodEvidenceCount?: number;
          requiredNoEvidenceCount?: number;
        })
      : null;
  const scoringStateLabel = scoringContext?.reusableScoringRun
    ? "Evidence Scored"
    : retrievalContext?.reusableRun
      ? "Evidence Scoring Ready"
      : "Evidence Scoring Not Ready";
  const matchReportSummary =
    reportContext?.reusableMatchReportRun?.summary &&
    typeof reportContext.reusableMatchReportRun.summary === "object"
      ? (reportContext.reusableMatchReportRun.summary as {
          matchTier?: string;
          pursuitRecommendation?: string;
          resumeReadinessState?: string;
          criticalRequiredGapCount?: number;
          strongRequiredCount?: number;
        })
      : null;
  const matchReportStateLabel = reportContext?.reusableMatchReportRun
    ? (matchReportSummary?.criticalRequiredGapCount ?? 0) > 0
      ? "Match Report Has Critical Gaps"
      : matchReportSummary?.resumeReadinessState === "READY"
        ? "Resume Generation Ready"
        : matchReportSummary?.resumeReadinessState === "READY_WITH_LIMITATIONS"
          ? "Resume Generation Ready With Limitations"
          : "Match Report Generated"
    : scoringContext?.reusableScoringRun
      ? "Match Report Ready"
      : "Match Report Not Ready";
  const resumePlanSummary =
    resumePlanContext?.reusableStructuredResumeVersion?.summary &&
    typeof resumePlanContext.reusableStructuredResumeVersion.summary === "object"
      ? (resumePlanContext.reusableStructuredResumeVersion.summary as {
          targetRoleFamily?: string;
          selectedRoles?: number;
          selectedProjects?: number;
          budgetStatus?: string;
        })
      : null;
  const resumePlanStateLabel = resumePlanContext?.reusableStructuredResumeVersion
    ? "Structured Resume Plan Generated"
    : resumePlanContext?.planningReady
      ? "Resume Planning Ready"
      : "Resume Planning Not Ready";
  const resumeCompositionSummary =
    resumeCompositionContext?.reusableResumeCompositionVersion?.summary &&
    typeof resumeCompositionContext.reusableResumeCompositionVersion.summary === "object"
      ? (resumeCompositionContext.reusableResumeCompositionVersion.summary as {
          estimatedPageCount?: number;
          bulletCount?: number;
          diagnosticWarningCount?: number;
        })
      : null;
  const resumeCompositionStateLabel = resumeCompositionContext?.reusableResumeCompositionVersion
    ? "Targeted Resume Composed"
    : resumeCompositionContext?.compositionReady
      ? "Resume Composition Ready"
      : "Resume Composition Not Ready";
  const resumeAuditSummary =
    resumeAuditContext?.reusableResumeAuditRun?.summary &&
    typeof resumeAuditContext.reusableResumeAuditRun.summary === "object"
      ? (resumeAuditContext.reusableResumeAuditRun.summary as {
          renderingReadiness?: string;
          errorCount?: number;
          warningCount?: number;
        })
      : null;
  const resumeAuditStateLabel = resumeAuditContext?.reusableResumeAuditRun
    ? "Resume Audit Complete"
    : resumeAuditContext?.auditReady
      ? "Resume Audit Ready"
      : "Resume Audit Not Ready";
  const documentRenderingStateLabel = latestRenderedResumePdf
    ? "Immutable Resume PDF Ready"
    : resumeRenderingApproval
      ? "Resume PDF Rendering Ready"
      : "Resume PDF Rendering Not Ready";
  const coverLetterCompositionStateLabel = coverLetterContext?.reusableCoverLetterCompositionVersion
    ? "Cover Letter Composed"
    : coverLetterContext?.compositionReady
      ? "Cover Letter Ready"
      : "Cover Letter Not Ready";
  const coverLetterRevisionStateLabel = coverLetterRevisionContext?.latestDraft
    ? "Draft In Progress"
    : coverLetterRevisionContext?.latestFinalizedRevision
      ? "Revision Available"
      : coverLetterContext?.reusableCoverLetterCompositionVersion
        ? "Studio Ready"
        : "Studio Not Ready";
  const coverLetterAuditSummary =
    coverLetterAuditContext?.reusableAuditRun?.summary &&
    typeof coverLetterAuditContext.reusableAuditRun.summary === "object"
      ? (coverLetterAuditContext.reusableAuditRun.summary as {
          errorCount?: number;
          warningCount?: number;
          infoCount?: number;
        })
      : null;
  const coverLetterAuditStateLabel = coverLetterAuditContext?.reusableAuditRun
    ? "Cover Letter Audit Complete"
    : coverLetterAuditContext?.auditSource
      ? "Cover Letter Audit Ready"
      : "Cover Letter Audit Not Ready";
  const coverLetterApprovalStateLabel = coverLetterApprovalContext?.activeApproval
    ? "Active Approval"
    : coverLetterAuditContext?.reusableAuditRun
      ? "Ready for Approval"
      : "No Active Approval";
  const coverLetterPdfStateLabel = latestRenderedCoverLetterPdf
    ? "Immutable Cover Letter PDF Ready"
    : coverLetterApprovalContext?.activeApproval
      ? "Cover Letter PDF Rendering Ready"
      : "Cover Letter PDF Rendering Not Ready";

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Application overview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {application.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {application.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/applications/${application.id}/edit`}
            >
              Edit application
            </Link>
            {isArchived ? (
              <form action={restoreApplicationAction.bind(null, application.id)}>
                <button
                  className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  type="submit"
                >
                  Restore
                </button>
              </form>
            ) : (
              <form action={archiveApplicationAction.bind(null, application.id)}>
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.status.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Applied</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDateTime(application.appliedAt)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Job-search date</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDate(application.jobSearchDate)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Priority</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.priority ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Source</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.opportunity.source ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Location</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.opportunity.location ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Work arrangement</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatWorkArrangement(application.opportunity.workArrangement)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Salary</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatSalaryRange(
                application.opportunity.salaryMin,
                application.opportunity.salaryMax,
                application.opportunity.salaryCurrency
              )}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:col-span-2">
            <p className="text-sm font-medium text-stone-500">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {application.notes ?? "No notes yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">Job description</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Preserve the exact posting text for later deterministic parsing and
              document generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {application.currentJobDescriptionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion.id}`}
              >
                View version
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion?.parses[0] ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion.id}/analysis`}
              >
                View Parsed Job Description
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion?.parses[0] ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={
                  requirementContext?.latestConfirmedAnalysis
                    ? `/job-descriptions/${application.currentJobDescriptionVersion.id}/requirements?analysisId=${requirementContext.latestConfirmedAnalysis.id}`
                    : `/job-descriptions/${application.currentJobDescriptionVersion.id}/requirements`
                }
              >
                {requirementContext?.latestConfirmedAnalysis
                  ? "View Confirmed Requirements"
                  : "Review Requirements"}
              </Link>
            ) : null}
            {retrievalContext?.reusableRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/evidence?runId=${retrievalContext.reusableRun.id}`}
              >
                View Candidate Evidence
              </Link>
            ) : null}
            {scoringContext?.reusableScoringRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/evidence/scores?runId=${scoringContext.reusableScoringRun.id}&retrievalRunId=${scoringContext.reusableScoringRun.evidenceRetrievalRunId}`}
              >
                View Evidence Scores
              </Link>
            ) : null}
            {reportContext?.reusableMatchReportRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/match-report?runId=${reportContext.reusableMatchReportRun.id}&scoringRunId=${reportContext.reusableMatchReportRun.evidenceScoringRunId}`}
              >
                View Match Report
              </Link>
            ) : null}
            {resumePlanContext?.reusableStructuredResumeVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/resume-plan?versionId=${resumePlanContext.reusableStructuredResumeVersion.id}&matchReportRunId=${resumePlanContext.reusableStructuredResumeVersion.matchReportRunId}`}
              >
                View Structured Resume Plan
              </Link>
            ) : null}
            {resumeCompositionContext?.reusableResumeCompositionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/resume?versionId=${resumeCompositionContext.reusableResumeCompositionVersion.id}`}
              >
                View Targeted Resume
              </Link>
            ) : null}
            {coverLetterContext?.reusableCoverLetterCompositionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/cover-letter?versionId=${coverLetterContext.reusableCoverLetterCompositionVersion.id}`}
              >
                View Cover Letter
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion && coverLetterContext?.reusableCoverLetterCompositionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={
                  coverLetterRevisionContext?.latestDraft
                    ? `/job-descriptions/${application.currentJobDescriptionVersion.id}/cover-letter/studio?revisionId=${coverLetterRevisionContext.latestDraft.id}`
                    : coverLetterRevisionContext?.latestFinalizedRevision
                      ? `/job-descriptions/${application.currentJobDescriptionVersion.id}/cover-letter/studio?revisionId=${coverLetterRevisionContext.latestFinalizedRevision.id}`
                      : `/job-descriptions/${application.currentJobDescriptionVersion.id}/cover-letter/studio`
                }
              >
                {coverLetterRevisionContext?.latestFinalizedRevision ? "View Cover Letter Revision" : "Open Cover Letter Studio"}
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion && coverLetterRevisionContext?.latestFinalizedRevision ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion.id}/cover-letter/compare?revisionId=${coverLetterRevisionContext.latestFinalizedRevision.id}`}
              >
                View Cover Letter Comparison
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion && coverLetterAuditContext?.reusableAuditRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion.id}/cover-letter/audit?runId=${coverLetterAuditContext.reusableAuditRun.id}`}
              >
                View Cover Letter Audit
              </Link>
            ) : null}
            {resumeAuditContext?.reusableResumeAuditRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion?.id}/resume/audit?runId=${resumeAuditContext.reusableResumeAuditRun.id}`}
              >
                View Resume Audit
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={
                  resumeRevisionContext?.latestDraft
                    ? `/job-descriptions/${application.currentJobDescriptionVersion.id}/resume/studio?revisionId=${resumeRevisionContext.latestDraft.id}`
                    : resumeRevisionContext?.latestFinalizedRevision
                      ? `/job-descriptions/${application.currentJobDescriptionVersion.id}/resume/studio?revisionId=${resumeRevisionContext.latestFinalizedRevision.id}`
                      : `/job-descriptions/${application.currentJobDescriptionVersion.id}/resume/studio`
                }
              >
                {resumeRevisionContext?.latestFinalizedRevision ? "View Revision" : "Open Resume Studio"}
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion && resumeRevisionContext?.latestFinalizedRevision ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${application.currentJobDescriptionVersion.id}/resume/compare?mode=BASE_VS_REVISION&revisionId=${resumeRevisionContext.latestFinalizedRevision.id}`}
              >
                View Comparison
              </Link>
            ) : null}
            {application.currentJobDescriptionVersion && retrievalReady ? (
              <form
                action={retrieveCareerEvidenceAction.bind(
                  null,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Retrieve Career Evidence
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion && retrievalContext?.reusableRun ? (
              <form
                action={scoreRetrievedEvidenceAction.bind(
                  null,
                  retrievalContext.reusableRun.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Score Retrieved Evidence
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion && scoringContext?.reusableScoringRun ? (
              <form
                action={generateMatchReportAction.bind(
                  null,
                  scoringContext.reusableScoringRun.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Generate Match Report
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion &&
            coverLetterContext?.compositionReady &&
            reportContext?.reusableMatchReportRun ? (
              <form
                action={createCoverLetterCompositionAction.bind(
                  null,
                  reportContext.reusableMatchReportRun.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Generate Cover Letter
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion && resumePlanContext?.planningReady && reportContext?.reusableMatchReportRun ? (
              <form
                action={createStructuredResumePlanAction.bind(
                  null,
                  reportContext.reusableMatchReportRun.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Create Structured Resume Plan
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion &&
            resumeCompositionContext?.compositionReady &&
            resumePlanContext?.reusableStructuredResumeVersion ? (
              <form
                action={createResumeCompositionAction.bind(
                  null,
                  resumePlanContext.reusableStructuredResumeVersion.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Compose Targeted Resume
                </button>
              </form>
            ) : null}
            {application.currentJobDescriptionVersion &&
            resumeCompositionContext?.reusableResumeCompositionVersion ? (
              <form
                action={runResumeAuditAction.bind(
                  null,
                  resumeCompositionContext.reusableResumeCompositionVersion.id,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  {resumeAuditContext?.reusableResumeAuditRun ? "Run Resume Audit Again" : "Run Resume Audit"}
                </button>
              </form>
            ) : null}
            {latestRenderedCoverLetterPdf ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/documents/${latestRenderedCoverLetterPdf.id}`}
                >
                  View Cover Letter PDF
                </Link>
                <a
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/api/documents/${latestRenderedCoverLetterPdf.id}/download`}
                >
                  Download Cover Letter PDF
                </a>
              </>
            ) : null}
            {latestRenderedCoverLetterDocx ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/documents/${latestRenderedCoverLetterDocx.id}`}
                >
                  View Cover Letter DOCX
                </Link>
                <a
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/api/documents/${latestRenderedCoverLetterDocx.id}/download`}
                >
                  Download Cover Letter DOCX
                </a>
              </>
            ) : null}
            {application.currentJobDescriptionVersion && coverLetterApprovalContext?.activeApproval ? (
              <>
                <form
                  action={renderApprovedCoverLetterDocumentAction.bind(
                    null,
                    application.currentJobDescriptionVersion.id,
                    DocumentFormat.PDF,
                    application.id,
                    `/applications/${application.id}`
                  )}
                >
                  <button
                    className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    type="submit"
                  >
                    {latestRenderedCoverLetterPdf
                      ? "Render Cover Letter PDF Again"
                      : "Render Cover Letter PDF"}
                  </button>
                </form>
                <form
                  action={renderApprovedCoverLetterDocumentAction.bind(
                    null,
                    application.currentJobDescriptionVersion.id,
                    DocumentFormat.DOCX,
                    application.id,
                    `/applications/${application.id}`
                  )}
                >
                  <button
                    className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    type="submit"
                  >
                    {latestRenderedCoverLetterDocx
                      ? "Render Cover Letter DOCX Again"
                      : "Render Cover Letter DOCX"}
                  </button>
                </form>
              </>
            ) : null}
            {latestRenderedResumePdf ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/documents/${latestRenderedResumePdf.id}`}
                >
                  View Resume PDF
                </Link>
                <a
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/api/documents/${latestRenderedResumePdf.id}/download`}
                >
                  Download Resume PDF
                </a>
              </>
            ) : null}
            {latestRenderedResumeDocx ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/documents/${latestRenderedResumeDocx.id}`}
                >
                  View Resume DOCX
                </Link>
                <a
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/api/documents/${latestRenderedResumeDocx.id}/download`}
                >
                  Download Resume DOCX
                </a>
              </>
            ) : null}
            {application.currentJobDescriptionVersion && resumeRenderingApproval ? (
              <>
                <form
                  action={renderApprovedResumeDocumentAction.bind(
                    null,
                    application.currentJobDescriptionVersion.id,
                    DocumentFormat.PDF,
                    application.id,
                    `/applications/${application.id}`
                  )}
                >
                  <button
                    className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    type="submit"
                  >
                    {latestRenderedResumePdf ? "Render Resume PDF Again" : "Render Resume PDF"}
                  </button>
                </form>
                <form
                  action={renderApprovedResumeDocumentAction.bind(
                    null,
                    application.currentJobDescriptionVersion.id,
                    DocumentFormat.DOCX,
                    application.id,
                    `/applications/${application.id}`
                  )}
                >
                  <button
                    className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    type="submit"
                  >
                    {latestRenderedResumeDocx ? "Render Resume DOCX Again" : "Render Resume DOCX"}
                  </button>
                </form>
              </>
            ) : null}
            {application.currentJobDescriptionVersion ? (
              <form
                action={parseJobDescriptionAction.bind(
                  null,
                  application.currentJobDescriptionVersion.id,
                  `/applications/${application.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  {application.currentJobDescriptionVersion.parses[0]
                    ? "Reparse with Current Parser"
                    : "Parse Job Description"}
                </button>
              </form>
            ) : null}
            <Link
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              href={`/applications/${application.id}/job-description`}
            >
              {application.currentJobDescriptionVersion
                ? "Replace Job Description"
                : "Add Job Description"}
            </Link>
          </div>
        </div>

        {application.currentJobDescriptionVersion ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Linked version</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {application.currentJobDescriptionVersion.versionNumber}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {application.currentJobDescriptionVersion.active ? "Active" : "Superseded"}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Captured</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {formatApplicationDateTime(application.currentJobDescriptionVersion.capturedAt)}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">History</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {application.opportunity._count.jobDescriptionVersions} versions
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Parse status</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {application.currentJobDescriptionVersion.parses[0]?.status.replace(/_/g, " ") ??
                  "Not parsed"}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {application.currentJobDescriptionVersion.parses[0]?.parserVersion ??
                  "No parser result yet"}
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
                  : "Review from the latest successful parse"}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Evidence retrieval</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {retrievalStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {retrievalContext?.reusableRun
                  ? `${retrievalContext.reusableRun.engineVersion} â€¢ ${retrievalContext.reusableRun.contractVersion}`
                  : retrievalReady
                    ? "Ready to retrieve against the active career profile."
                    : "Requires an active career profile and a confirmed requirement analysis."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Evidence scoring</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {scoringStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {scoringContext?.reusableScoringRun
                  ? `${scoringContext.reusableScoringRun.configurationVersion} • ${scoringSummary?.requiredStrongEvidenceCount ?? 0} strong required • ${scoringSummary?.requiredGoodEvidenceCount ?? 0} good required • ${scoringSummary?.requiredNoEvidenceCount ?? 0} no-evidence required`
                  : retrievalContext?.reusableRun
                    ? "Ready to score the latest successful retrieval run."
                    : "Requires a successful evidence retrieval run."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Match report</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {matchReportStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {reportContext?.reusableMatchReportRun
                  ? `${matchReportSummary?.matchTier?.replace(/_/g, " ") ?? "Unknown tier"} • ${matchReportSummary?.pursuitRecommendation?.replace(/_/g, " ") ?? "Unknown recommendation"} • ${matchReportSummary?.resumeReadinessState?.replace(/_/g, " ") ?? "Unknown readiness"}`
                  : scoringContext?.reusableScoringRun
                    ? "Ready to generate a deterministic, read-only match report."
                    : "Requires a successful evidence scoring run."}
              </p>
            </article>
            {reportContext?.reusableMatchReportRun ? (
              <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:col-span-2">
                <p className="text-sm font-medium text-stone-500">Match report summary</p>
                <p className="mt-2 text-lg font-semibold text-stone-900">
                  {matchReportSummary?.matchTier?.replace(/_/g, " ") ?? "Unknown tier"}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {matchReportSummary?.pursuitRecommendation?.replace(/_/g, " ") ?? "Unknown recommendation"} • {matchReportSummary?.resumeReadinessState?.replace(/_/g, " ") ?? "Unknown readiness"}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  Critical gaps {matchReportSummary?.criticalRequiredGapCount ?? 0} • Strong required {matchReportSummary?.strongRequiredCount ?? 0}
                </p>
              </article>
            ) : null}
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Resume planning</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {resumePlanStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {resumePlanContext?.reusableStructuredResumeVersion
                  ? `${resumePlanSummary?.targetRoleFamily?.replace(/_/g, " ") ?? "Unknown role family"} â€¢ ${resumePlanSummary?.selectedRoles ?? 0} roles â€¢ ${resumePlanSummary?.selectedProjects ?? 0} projects â€¢ ${resumePlanSummary?.budgetStatus?.replace(/_/g, " ") ?? "Unknown budget"}`
                  : reportContext?.reusableMatchReportRun &&
                      matchReportSummary?.resumeReadinessState !== "NOT_READY"
                    ? "Ready to create a deterministic structured resume plan."
                    : "Requires a successful match report with usable resume readiness."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Source URL</p>
              <p className="mt-2 break-all text-sm leading-6 text-stone-700">
                {application.currentJobDescriptionVersion.sourceUrl ?? "Not set"}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Cover letter composition</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {coverLetterCompositionStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {coverLetterContext?.reusableCoverLetterCompositionVersion
                  ? "The deterministic base composition is available from the latest match report."
                  : coverLetterContext?.compositionReady
                    ? "Generate the cover letter from the current match report."
                    : "Requires a successful match report before composition can begin."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Cover letter revision</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {coverLetterRevisionStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {coverLetterRevisionContext?.latestDraft
                  ? "A mutable draft is available in Cover Letter Studio."
                  : coverLetterRevisionContext?.latestFinalizedRevision
                    ? `${coverLetterRevisionContext.latestFinalizedRevision.status.replace(/_/g, " ")} • latest finalized revision`
                    : coverLetterContext?.reusableCoverLetterCompositionVersion
                      ? "Open Cover Letter Studio to edit or finalize a revision."
                      : "Requires a deterministic base composition first."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Cover letter audit</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {coverLetterAuditStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {coverLetterAuditContext?.reusableAuditRun
                  ? `${coverLetterAuditContext.reusableAuditRun.sourceType.replace(/_/g, " ")} • ${coverLetterAuditSummary?.errorCount ?? 0} blocking findings • ${coverLetterAuditSummary?.warningCount ?? 0} warnings`
                  : coverLetterAuditContext?.auditSource
                    ? "Run the deterministic cover-letter audit from Preview or Studio."
                    : "Requires a base composition or finalized revision before audit can run."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Cover letter approval</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {coverLetterApprovalStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {coverLetterApprovalContext?.activeApproval
                  ? `${coverLetterApprovalContext.activeApproval.sourceType.replace(/_/g, " ")} • ${coverLetterApprovalContext.activeApproval.renderingReadiness.replace(/_/g, " ")}`
                  : coverLetterAuditContext?.reusableAuditRun
                    ? "Approve an audited base composition or finalized revision when ready."
                    : "Requires a successful matching audit before approval can be recorded."}
              </p>
              <p className="mt-2 text-sm text-stone-700">
                Approval history {coverLetterApprovalContext?.history.length ?? 0}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Resume composition</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {resumeCompositionStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {resumeCompositionContext?.reusableResumeCompositionVersion
                  ? `${resumeCompositionSummary?.estimatedPageCount ?? 0} pages • ${resumeCompositionSummary?.bulletCount ?? 0} bullets • ${resumeCompositionSummary?.diagnosticWarningCount ?? 0} warnings`
                  : resumePlanContext?.reusableStructuredResumeVersion
                    ? "Ready to compose employer-facing resume content from the current structured plan."
                    : "Requires a ready structured resume plan."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Resume audit</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {resumeAuditStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {resumeAuditContext?.reusableResumeAuditRun
                  ? `${resumeAuditSummary?.renderingReadiness?.replace(/_/g, " ") ?? "Unknown readiness"} • ${resumeAuditSummary?.errorCount ?? 0} blocking findings • ${resumeAuditSummary?.warningCount ?? 0} warnings`
                  : resumeCompositionContext?.reusableResumeCompositionVersion
                    ? "Ready to audit the current composed resume before any rendering step."
                    : "Requires a composed targeted resume."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Resume revision</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {resumeRevisionContext?.latestDraft
                  ? "Draft In Progress"
                  : resumeRevisionContext?.latestFinalizedRevision
                    ? "Revision Available"
                    : resumeCompositionContext?.reusableResumeCompositionVersion
                      ? "Studio Ready"
                      : "Studio Not Ready"}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {resumeRevisionContext?.latestDraft
                  ? "Resume Studio draft is available for continued editing."
                  : resumeRevisionContext?.latestFinalizedRevision
                    ? `${resumeRevisionContext.latestFinalizedRevision.status.replace(/_/g, " ")} â€¢ latest finalized revision`
                    : resumeCompositionContext?.reusableResumeCompositionVersion
                      ? "Open Resume Studio to revise the current composed resume."
                      : "Requires a composed targeted resume before revision can begin."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Rendering approval</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {resumeRenderingApproval ? "Active Approval" : "No Active Approval"}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {resumeRenderingApproval
                  ? `${resumeRenderingApproval.sourceType.replace(/_/g, " ")} • ${resumeRenderingApproval.renderingReadiness.replace(/_/g, " ")} • ${resumeRenderingApproval.warningCount} warnings`
                  : resumeAuditContext?.reusableResumeAuditRun
                    ? "Compare and approve an audited immutable resume before rendering."
                    : "Requires an eligible resume audit before approval can be recorded."}
              </p>
              <p className="mt-2 text-sm text-stone-700">
                Approval history {resumeRenderingApprovalHistory.length}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Resume PDF</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {documentRenderingStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {latestRenderedResumePdf
                  ? `Latest version ${latestRenderedResumePdf.versionNumber} is available for download.`
                  : resumeRenderingApproval
                    ? "An approved resume source is ready for immutable PDF rendering."
                    : "Approve a ready audited resume before rendering a PDF."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Cover Letter PDF</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {coverLetterPdfStateLabel}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {latestRenderedCoverLetterPdf
                  ? `Latest version ${latestRenderedCoverLetterPdf.versionNumber} is available for download.`
                  : coverLetterApprovalContext?.activeApproval
                    ? "An approved cover-letter source is ready for immutable PDF rendering."
                    : "Approve a ready audited cover letter before rendering a PDF."}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Text size</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {application.currentJobDescriptionVersion.originalText.length.toLocaleString()} characters
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {countJobDescriptionWords(
                  application.currentJobDescriptionVersion.originalText
                ).toLocaleString()} words
              </p>
            </article>
          </div>
        ) : (
          <p className="mt-6 text-sm text-stone-600">
            No job description has been saved for this application yet.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Status history</h2>
        <div className="mt-6 space-y-4">
          {application.statusHistoryEntries.length === 0 ? (
            <p className="text-sm text-stone-600">
              No status changes have been recorded yet.
            </p>
          ) : (
            application.statusHistoryEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {entry.fromStatus ? `${entry.fromStatus} -> ` : ""}
                  {entry.toStatus}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Occurred {formatApplicationDateTime(entry.occurredAt)}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Recorded {formatApplicationDateTime(entry.recordedAt)}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  {entry.reason ?? "No reason recorded"}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
