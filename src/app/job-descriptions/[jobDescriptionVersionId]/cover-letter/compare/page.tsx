import Link from "next/link";
import { notFound } from "next/navigation";
import { parseStoredCoverLetterCompositionVersion } from "@/lib/cover-letter-composition/service";
import { parseStoredCoverLetterRevisionVersion } from "@/lib/cover-letter-revision/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type PageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function toLabel(value: string) {
  return value.replace(/_/g, " ");
}

function compareStringLists(left: string[], right: string[]) {
  const removed = left.filter((value) => !right.includes(value));
  const added = right.filter((value) => !left.includes(value));

  if (removed.length === 0 && added.length === 0) {
    return "Provenance preserved";
  }

  return `Provenance changed: +${added.join(", ") || "None"} / -${removed.join(", ") || "None"}`;
}

export default async function CoverLetterComparePage({ params, searchParams }: PageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const revisionId = getStringParam(query.revisionId);
  const workspace = await getDefaultWorkspace();

  if (!revisionId) {
    notFound();
  }

  const revision = await parseStoredCoverLetterRevisionVersion(workspace.id, revisionId);
  const composition = await parseStoredCoverLetterCompositionVersion(
    workspace.id,
    revision.record.content.coverLetterCompositionVersionId
  );

  const baseParagraphs = composition.content.paragraphs;
  const revisedParagraphs = [...revision.record.content.paragraphs].sort((a, b) => a.order - b.order);
  const paragraphIds = Array.from(
    new Set([...baseParagraphs.map((paragraph) => paragraph.id), ...revisedParagraphs.map((paragraph) => paragraph.id)])
  );
  const latestAudit = revision.version.coverLetterAuditRuns[0] ?? null;
  const latestApproval = revision.version.coverLetterApprovals[0] ?? null;
  const activeApproval = revision.version.coverLetterApprovals.find((approval) => approval.status === "APPROVED") ?? null;
  const auditSummary =
    latestAudit?.summary && typeof latestAudit.summary === "object"
      ? (latestAudit.summary as {
          errorCount?: number;
          warningCount?: number;
          infoCount?: number;
        })
      : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">Cover-letter comparison</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">{revision.record.content.header.role}</h1>
            <p className="mt-3 text-base text-stone-600">{revision.record.content.header.company}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?revisionId=${revisionId}`}
            >
              Back to Revision
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter?versionId=${composition.version.id}`}
            >
              Return to Cover Letter
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Revision status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{toLabel(revision.version.status)}</p>
            <p className="mt-1 text-sm text-stone-600">
              {revision.record.summary.wordCountDelta >= 0 ? "+" : ""}
              {revision.record.summary.wordCountDelta} words
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Audit comparison</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestAudit?.renderingReadiness ? toLabel(latestAudit.renderingReadiness) : "Not audited"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {auditSummary
                ? `${auditSummary.errorCount ?? 0} blocking, ${auditSummary.warningCount ?? 0} warnings, ${auditSummary.infoCount ?? 0} info`
                : "No revision-backed audit is linked yet."}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Approval state</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {activeApproval ? "Active approval" : latestApproval ? toLabel(latestApproval.status) : "No approval"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {activeApproval
                ? `${toLabel(activeApproval.sourceType)} approved`
                : "Approval remains separate from editing and audit generation."}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Review notes</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">
              {revision.record.userNotes?.trim() || "No revision notes were recorded."}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Salutation and Closing</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Base salutation</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">{composition.content.header.salutation}</p>
            <p className="mt-4 text-sm font-medium text-stone-500">Base closing</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">{composition.content.closing}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Revised salutation</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">{revision.record.content.salutation}</p>
            <p className="mt-4 text-sm font-medium text-stone-500">Revised closing</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">{revision.record.content.closing}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Paragraph Diff</h2>
        <div className="mt-6 space-y-4">
          {paragraphIds.map((paragraphId, index) => {
            const paragraph = revisedParagraphs.find((item) => item.id === paragraphId) ?? null;
            const base = baseParagraphs.find((item) => item.id === paragraphId) ?? baseParagraphs[index] ?? null;
            const status = !base
              ? "Added"
              : !paragraph
                ? "Removed"
                : base.text !== paragraph.currentText || base.wordCount !== paragraph.wordCount || base.type !== paragraph.type
                  ? "Modified"
                  : "Unchanged";
            const revisedEvidenceIds = paragraph?.supportingEvidenceIds ?? [];
            const revisedRequirementIds = paragraph?.supportingRequirementIds ?? [];
            const revisedCareerRecordIds = paragraph?.sourceCareerRecordIds ?? [];
            const revisedText = paragraph?.currentText ?? "Not present";
            const revisedWordCount = paragraph?.wordCount ?? 0;

            return (
              <article key={paragraphId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
                      {toLabel(paragraph?.type ?? base?.type ?? "UNKNOWN")}
                    </p>
                    <p className="mt-2 text-base font-semibold text-stone-900">
                      {status} - word delta {revisedWordCount - (base?.wordCount ?? 0)}
                    </p>
                  </div>
                  <p className="text-sm text-stone-600">
                    {compareStringLists(base?.supportingEvidenceIds ?? [], revisedEvidenceIds)}
                  </p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Base</p>
                    <p className="mt-2 text-sm leading-6 text-stone-800">{base?.text ?? "Not present"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Revised</p>
                    <p className="mt-2 text-sm leading-6 text-stone-800">{revisedText}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-stone-700">
                  <p>Base evidence: {base?.supportingEvidenceIds.join(", ") || "None"}</p>
                  <p>Revised evidence: {revisedEvidenceIds.join(", ") || "None"}</p>
                  <p>Base requirements: {base?.supportingRequirementIds.join(", ") || "None"}</p>
                  <p>Revised requirements: {revisedRequirementIds.join(", ") || "None"}</p>
                  <p>Base career IDs: {base?.sourceCareerRecordIds.join(", ") || "None"}</p>
                  <p>Revised career IDs: {revisedCareerRecordIds.join(", ") || "None"}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Revision Diagnostics</h2>
        <div className="mt-6 space-y-4">
          {revision.record.diagnostics.length > 0 ? (
            revision.record.diagnostics.map((diagnostic, index) => (
              <article key={`${diagnostic.code}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-stone-900">
                  {diagnostic.severity} - {diagnostic.code}
                </p>
                <p className="mt-1 text-sm text-stone-700">{diagnostic.message}</p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
              No revision-specific diagnostics were recorded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
