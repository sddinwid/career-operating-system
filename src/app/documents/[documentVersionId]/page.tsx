import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentVersionById } from "@/lib/document-rendering/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type DocumentDetailPageProps = {
  params: Promise<{ documentVersionId: string }>;
};

type DocumentValidationSummary = {
  requiredEntries?: string[];
  missingEntries?: string[];
  entries?: string[];
  documentXmlLength?: number;
  pageCount?: number;
  totalTextItemCount?: number;
  totalImageOperatorCount?: number;
  missingSnippets?: string[];
  forbiddenMetadataLeaks?: string[];
  metadata?: Record<string, string | null>;
  extractedTextLength?: number;
  forbiddenFragments?: string[];
  leakedUuid?: boolean;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentVersionId } = await params;
  const workspace = await getDefaultWorkspace();
  const version = await getDocumentVersionById(workspace.id, documentVersionId);

  if (!version) {
    notFound();
  }

  const validationSummary =
    version.validationSummary && typeof version.validationSummary === "object"
      ? (version.validationSummary as DocumentValidationSummary)
      : null;
  const checksumPreview = version.checksum.slice(0, 12);
  const renderChecksumPreview = version.renderInputChecksum.slice(0, 12);
  const formatLabel = version.format === "PDF" ? "PDF" : "DOCX";
  const isCoverLetter = version.document.type === "COVER_LETTER";
  const documentTypeLabel = isCoverLetter ? "Cover Letter" : "Resume";
  const backHref = isCoverLetter
    ? `/job-descriptions/${version.jobDescriptionVersionId}/cover-letter`
    : `/job-descriptions/${version.jobDescriptionVersionId}/resume`;
  const approvalId = isCoverLetter
    ? version.coverLetterApprovalId
    : version.resumeRenderingApprovalId;
  const auditId = isCoverLetter ? version.coverLetterAuditRunId : version.resumeAuditRunId;
  const compositionId = isCoverLetter
    ? version.coverLetterCompositionVersionId
    : version.resumeCompositionVersionId;
  const revisionId = isCoverLetter
    ? version.coverLetterRevisionVersionId
    : version.resumeRevisionVersionId;
  const companyName = version.jobDescriptionVersion.opportunity.company.name;
  const roleTitle = version.jobDescriptionVersion.opportunity.title;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Immutable document version
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {version.document.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {documentTypeLabel} | Version {version.versionNumber} | {version.renderStatus.replace(/_/g, " ")} | {formatLabel}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              {companyName} | {roleTitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {version.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${version.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={backHref}
            >
              Back to {documentTypeLabel.toLowerCase()}
            </Link>
            <a
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              href={`/api/documents/${version.id}/download`}
            >
              Download {formatLabel}
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Generated</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {version.generatedAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Filename</p>
            <p className="mt-2 break-all text-lg font-semibold text-stone-900">
              {version.originalFilename}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Size</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{version.sizeBytes} bytes</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Warnings</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{version.warningCount}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Lineage</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Approval</p>
              <p className="mt-2 break-all text-sm font-semibold text-stone-900">
              {approvalId}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Audit</p>
              <p className="mt-2 break-all text-sm font-semibold text-stone-900">
              {auditId}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Composition</p>
              <p className="mt-2 break-all text-sm font-semibold text-stone-900">
              {compositionId}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Revision</p>
              <p className="mt-2 break-all text-sm font-semibold text-stone-900">
              {revisionId ?? "Base composition"}
              </p>
            </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Checksum</p>
            <p className="mt-2 break-all text-sm font-semibold text-stone-900">{version.checksum}</p>
            <p className="mt-1 text-xs text-stone-600">Preview {checksumPreview}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Storage path</p>
            <p className="mt-2 break-all text-sm font-semibold text-stone-900">
              {version.storagePath}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Validation</h2>
        <div className="mt-6 space-y-4 text-sm text-stone-700">
          <p>Format: {formatLabel}</p>
          <p>Renderer version: {version.rendererVersion}</p>
          <p>Template version: {version.templateVersion}</p>
          <p>Contract version: {version.renderContractVersion}</p>
          <p>Configuration version: {version.configurationVersion}</p>
          <p>Render checksum: {version.renderInputChecksum}</p>
          <p>Render checksum preview: {renderChecksumPreview}</p>
          {version.format === "DOCX" ? (
            <>
              <p>
                Required ZIP entries: {validationSummary?.requiredEntries?.join(", ") ?? "Not recorded"}
              </p>
              <p>
                Missing ZIP entries: {validationSummary?.missingEntries?.join(", ") || "None"}
              </p>
              <p>`word/document.xml` length: {validationSummary?.documentXmlLength ?? 0}</p>
            </>
          ) : (
            <>
              <p>PDF pages: {validationSummary?.pageCount ?? 0}</p>
              <p>Extracted text items: {validationSummary?.totalTextItemCount ?? 0}</p>
              <p>Image operators: {validationSummary?.totalImageOperatorCount ?? 0}</p>
              <p>Extracted text length: {validationSummary?.extractedTextLength ?? 0}</p>
              <p>
                Missing expected snippets: {validationSummary?.missingSnippets?.join(", ") || "None"}
              </p>
              <p>
                Forbidden metadata leaks: {validationSummary?.forbiddenMetadataLeaks?.join(", ") || validationSummary?.forbiddenFragments?.join(", ") || "None"}
              </p>
              <p>PDF title metadata: {validationSummary?.metadata?.title ?? "Not recorded"}</p>
              <p>UUID leak detected: {validationSummary?.leakedUuid ? "Yes" : "No"}</p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Version History</h2>
        <p className="mt-2 text-sm text-stone-600">
          {version.document.versions.length} immutable version
          {version.document.versions.length === 1 ? "" : "s"} stored for this logical document.
        </p>
        <div className="mt-6 space-y-4">
          {version.document.versions.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900">Version {entry.versionNumber}</p>
              <p className="mt-1 text-sm text-stone-600">
                {entry.renderStatus.replace(/_/g, " ")} | {entry.format} | {entry.sizeBytes} bytes
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
