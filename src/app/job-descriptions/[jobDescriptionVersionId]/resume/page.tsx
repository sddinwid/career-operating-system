import Link from "next/link";
import { notFound } from "next/navigation";
import { runResumeAuditAction } from "@/lib/resume-audit/actions";
import { renderApprovedResumeDocumentAction } from "@/lib/document-rendering/actions";
import { getLatestRenderedResumeDocumentVersion } from "@/lib/document-rendering/service";
import { getResumeAuditContext } from "@/lib/resume-audit/service";
import { createResumeCompositionAction } from "@/lib/resume-composition/actions";
import { ResumeRenderingApprovalPanel } from "@/components/resume-studio/resume-rendering-approval-panel";
import {
  getResumeCompositionContext,
  parseStoredResumeCompositionVersion
} from "@/lib/resume-composition/service";
import { getResumeRevisionContext } from "@/lib/resume-revision/service";
import {
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory
} from "@/lib/resume-rendering-approval/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type ResumePageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "composition-created": "Targeted resume composed successfully.",
    "composition-reused":
      "The current composition contract, engine, and configuration already had a successful result for this exact structured plan and career profile, so the existing resume content was reused.",
    "audit-created": "Resume audit completed successfully.",
    "audit-reused":
      "The current audit contract, engine, and configuration already had a successful result for this exact composed resume, so the existing audit was reused.",
    "document-rendered": "Approved resume rendered to an immutable DOCX successfully.",
    "document-reused":
      "The active approved resume already had a matching immutable DOCX, so the existing document version was reused."
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

export default async function ResumePage({ params, searchParams }: ResumePageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const versionId = getStringParam(query.versionId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getResumeCompositionContext(workspace.id, jobDescriptionVersionId);
  const auditContext = await getResumeAuditContext(workspace.id, jobDescriptionVersionId);
  const revisionContext = await getResumeRevisionContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedVersionId = versionId ?? context.reusableResumeCompositionVersion?.id;

  if (!selectedVersionId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Resume composition unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Create a ready structured resume plan before composing employer-facing resume content.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume-plan`}
            >
              Back to Structured Resume Plan
            </Link>
            {context.compositionReady && context.reusableStructuredResumeVersion ? (
              <form
                action={createResumeCompositionAction.bind(
                  null,
                  context.reusableStructuredResumeVersion.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/resume`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Compose Targeted Resume
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const { version, content } = await parseStoredResumeCompositionVersion(workspace.id, selectedVersionId);
  const latestAudit = auditContext?.reusableResumeAuditRun;
  const activeApproval = await getActiveResumeRenderingApproval(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });
  const latestDocumentVersion = await getLatestRenderedResumeDocumentVersion(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });
  const approvalHistory = await listResumeRenderingApprovalHistory(workspace.id, {
    jobDescriptionVersionId,
    applicationId: version.applicationId
  });
  const latestAuditSummary =
    latestAudit?.summary && typeof latestAudit.summary === "object"
      ? (latestAudit.summary as {
          renderingReadiness?: string;
          errorCount?: number;
          warningCount?: number;
        })
      : null;

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Targeted resume preview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {content.targetRole}
            </h1>
            <p className="mt-3 text-base text-stone-600">{content.targetCompany}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume-plan?versionId=${version.structuredResumeVersionId}`}
            >
              Back to Structured Resume Plan
            </Link>
            {version.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${version.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {latestAudit ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/audit?runId=${latestAudit.id}`}
              >
                View Resume Audit
              </Link>
            ) : null}
            {revisionContext?.latestFinalizedRevision ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/compare?mode=BASE_VS_REVISION&revisionId=${revisionContext.latestFinalizedRevision.id}`}
              >
                Compare with Revision
              </Link>
            ) : null}
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
            <form
              action={runResumeAuditAction.bind(
                null,
                version.id,
                jobDescriptionVersionId,
                `/job-descriptions/${jobDescriptionVersionId}/resume`
              )}
            >
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                type="submit"
              >
                {latestAudit ? "Run Resume Audit Again" : "Run Resume Audit"}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.status.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Estimated pages</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.estimatedPageCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Bullets</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.bulletCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Warnings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.diagnosticWarningCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Audit status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestAudit?.status.replace(/_/g, " ") ?? "Not audited"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Rendering readiness</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestAuditSummary?.renderingReadiness?.replace(/_/g, " ") ?? "Not audited"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {latestAuditSummary
                ? `${latestAuditSummary.errorCount ?? 0} errors • ${latestAuditSummary.warningCount ?? 0} warnings`
                : "Run the deterministic audit before rendering."}
            </p>
          </article>
        </div>
        {latestAuditSummary?.renderingReadiness === "BLOCKED" ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Rendering is blocked until the current resume audit findings are resolved upstream.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-stone-600">
          Active rendering approval: {activeApproval ? activeApproval.sourceType.replace(/_/g, " ") : "None"}
        </p>
        {latestDocumentVersion ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
            Latest immutable DOCX version {latestDocumentVersion.versionNumber} is ready.
            {" "}
            <Link className="font-semibold text-stone-900 underline" href={`/documents/${latestDocumentVersion.id}`}>
              View document version
            </Link>
            {" "}
            or
            {" "}
            <a
              className="font-semibold text-stone-900 underline"
              href={`/api/documents/${latestDocumentVersion.id}/download`}
            >
              download the DOCX
            </a>
            .
          </div>
        ) : null}
      </section>

      {latestAudit ? (
        <ResumeRenderingApprovalPanel
          applicationId={version.applicationId}
          initialActiveApproval={activeApproval}
          initialEligibility={await getResumeRenderingApprovalEligibility(workspace.id, {
            jobDescriptionVersionId,
            applicationId: version.applicationId,
            sourceType: "BASE_COMPOSITION",
            sourceId: version.id,
            resumeAuditRunId: latestAudit.id
          })}
          initialHistory={approvalHistory}
          jobDescriptionVersionId={jobDescriptionVersionId}
          sourceId={version.id}
          sourceType="BASE_COMPOSITION"
          title="Base Composition Approval"
        />
      ) : null}

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">Rendering Output</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Render a DOCX only from the active approved resume source after the deterministic audit gate passes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {latestDocumentVersion ? (
              <>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/documents/${latestDocumentVersion.id}`}
                >
                  View Document Version
                </Link>
                <a
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/api/documents/${latestDocumentVersion.id}/download`}
                >
                  Download DOCX
                </a>
              </>
            ) : null}
            {activeApproval ? (
              <form
                action={renderApprovedResumeDocumentAction.bind(
                  null,
                  jobDescriptionVersionId,
                  version.applicationId,
                  `/job-descriptions/${jobDescriptionVersionId}/resume`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  {latestDocumentVersion ? "Render Approved DOCX Again" : "Render Approved DOCX"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {!activeApproval ? (
          <p className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            Approve either the base composition or a finalized revision before rendering an immutable resume document.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Header</h2>
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-stone-700">
          {content.header
            .filter((item) => item.included && item.value)
            .map((item) => (
              <span key={item.field}>{item.value}</span>
            ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Professional Summary</h2>
        <p className="mt-6 text-base leading-7 text-stone-800">{content.professionalSummary.text}</p>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Core Skills</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {content.skillsGroups.map((group) => (
            <article key={group.groupId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-base font-semibold text-stone-900">{group.groupLabel}</p>
              <p className="mt-2 text-sm text-stone-700">
                {group.skills.map((skill) => skill.displayValue).join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Professional Experience</h2>
        <div className="mt-6 space-y-6">
          {content.professionalExperience.map((role) => (
            <article key={role.roleId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-lg font-semibold text-stone-900">
                {role.roleTitle ?? role.roleId}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {[role.employer, role.location, role.startDate, role.endDate ?? "Present"]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-800">
                {role.bullets.map((bullet) => (
                  <li key={bullet.statementId}>- {bullet.text}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {content.selectedProjects.length > 0 ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">Selected Projects</h2>
          <div className="mt-6 space-y-6">
            {content.selectedProjects.map((project) => (
              <article key={project.projectId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-lg font-semibold text-stone-900">{project.projectName}</p>
                <p className="mt-1 text-sm text-stone-600">{project.contextLabel}</p>
                {project.projectOnlyDisclosure ? (
                  <p className="mt-2 text-sm text-amber-700">{project.projectOnlyDisclosure}</p>
                ) : null}
                <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-800">
                  {project.bullets.map((bullet) => (
                    <li key={bullet.statementId}>- {bullet.text}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {content.education.length > 0 ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">Education</h2>
          <div className="mt-6 space-y-3 text-sm text-stone-800">
            {content.education.map((entry) => (
              <p key={entry.educationId}>
                {[entry.degree, entry.field, entry.institution, entry.completionDate]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Diagnostics & Provenance</h2>
        <div className="mt-6 space-y-4">
          {content.professionalSummary.sentences.map((sentence) => (
            <details key={sentence.statementId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                {sentence.text}
              </summary>
              <div className="mt-3 text-sm text-stone-700">
                <p>Template: {sentence.provenance.templateId}</p>
                <p>Truthfulness: {sentence.provenance.truthfulnessClassification}</p>
                <p>Evidence: {sentence.provenance.sourceEvidenceIds.join(", ") || "None"}</p>
              </div>
            </details>
          ))}
          <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
            Diagnostics: {content.summary.diagnosticErrorCount} errors,{" "}
            {content.summary.diagnosticWarningCount} warnings, {content.summary.diagnosticInfoCount} info
          </p>
        </div>
      </section>
    </div>
  );
}
