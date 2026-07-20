import Link from "next/link";
import { notFound } from "next/navigation";
import { createCoverLetterCompositionAction } from "@/lib/cover-letter-composition/actions";
import {
  getCoverLetterCompositionContext,
  parseStoredCoverLetterCompositionVersion
} from "@/lib/cover-letter-composition/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type CoverLetterPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "cover-letter-created": "Cover letter composed successfully.",
    "cover-letter-reused":
      "The current cover-letter contract, engine, and configuration already had a successful result for these exact inputs, so the existing composition was reused."
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

export default async function CoverLetterPage({ params, searchParams }: CoverLetterPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const versionId = getStringParam(query.versionId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getCoverLetterCompositionContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedVersionId = versionId ?? context.reusableCoverLetterCompositionVersion?.id;
  if (!selectedVersionId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Cover-letter composition unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Generate a successful match report before composing a deterministic cover letter.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/match-report`}
            >
              Back to Match Report
            </Link>
            {context.compositionReady && context.reusableMatchReportRun ? (
              <form
                action={createCoverLetterCompositionAction.bind(
                  null,
                  context.reusableMatchReportRun.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/cover-letter`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Generate Cover Letter
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const { version, content } = await parseStoredCoverLetterCompositionVersion(
    workspace.id,
    selectedVersionId
  );

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Deterministic cover-letter preview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {content.header.role}
            </h1>
            <p className="mt-3 text-base text-stone-600">{content.header.company}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/match-report?runId=${version.matchReportRunId}`}
            >
              Back to Match Report
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume`}
            >
              Resume
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${version.requirementAnalysisId}`}
            >
              Requirements
            </Link>
            {version.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${version.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            <form
              action={createCoverLetterCompositionAction.bind(
                null,
                version.matchReportRunId,
                jobDescriptionVersionId,
                `/job-descriptions/${jobDescriptionVersionId}/cover-letter`
              )}
            >
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                type="submit"
              >
                Regenerate Cover Letter
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
            <p className="text-sm font-medium text-stone-500">Word count</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.wordCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Paragraphs</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.paragraphCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Warnings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.summary.warningCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Resume overlap</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {(content.summary.resumeOverlapRatio * 100).toFixed(0)}%
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Resume source</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {content.provenance.resumeSource?.sourceType.replace(/_/g, " ") ?? "None"}
            </p>
          </article>
        </div>

        <div className="mt-6 text-sm text-stone-600">
          Contract {version.contractVersion} - Engine {version.engineVersion} - Config{" "}
          {version.configurationVersion}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Cover Letter Preview</h2>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-6">
          <div className="space-y-1 text-sm text-stone-700">
            <p>{content.candidateName}</p>
            {content.header.email ? <p>{content.header.email}</p> : null}
            {content.header.phone ? <p>{content.header.phone}</p> : null}
            {content.header.location ? <p>{content.header.location}</p> : null}
            <p>{content.header.date}</p>
          </div>
          <div className="mt-6 space-y-5 text-base leading-7 text-stone-900">
            <p>{content.header.salutation}</p>
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph.id}>{paragraph.text}</p>
            ))}
            <p>{content.closing}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Paragraph Provenance</h2>
        <div className="mt-6 space-y-4">
          {content.paragraphs.map((paragraph) => (
            <article key={paragraph.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
                    {paragraph.type.replace(/_/g, " ")}
                  </p>
                  <p className="mt-2 text-base font-semibold text-stone-900">{paragraph.purpose}</p>
                </div>
                <p className="text-sm text-stone-600">{paragraph.wordCount} words</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-800">{paragraph.text}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-stone-700">
                <p>Evidence IDs: {paragraph.supportingEvidenceIds.join(", ") || "None"}</p>
                <p>Requirement IDs: {paragraph.supportingRequirementIds.join(", ") || "None"}</p>
                <p>Match IDs: {paragraph.supportingMatchReportConclusionIds.join(", ") || "None"}</p>
                <p>Career IDs: {paragraph.sourceCareerRecordIds.join(", ") || "None"}</p>
              </div>
              {paragraph.acknowledgements.length > 0 ? (
                <p className="mt-3 text-sm text-amber-700">
                  {paragraph.acknowledgements.join(" ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Diagnostics</h2>
        <div className="mt-6 space-y-3">
          {content.diagnostics.map((diagnostic, index) => (
            <article key={`${diagnostic.code}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm">
              <p className="font-semibold text-stone-900">
                {diagnostic.severity} - {diagnostic.code}
              </p>
              <p className="mt-1 text-stone-700">{diagnostic.message}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
