import Link from "next/link";
import { listDocumentWorkspaceEntries } from "@/lib/documents/service";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  cardClassName,
  mutedCardClassName,
  textActionClassName
} from "@/lib/ui";

type DocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
  fallback: string
) {
  return typeof value === "string" ? value : fallback;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const query = (await searchParams) ?? {};
  const filters = {
    search: firstParam(query.q, ""),
    type: firstParam(query.type, "all") as "all" | "resume" | "cover_letter" | "application_answer" | "interview_prep" | "portfolio" | "other",
    format: firstParam(query.format, "all") as "all" | "pdf" | "docx" | "txt" | "md" | "json" | "other",
    company: firstParam(query.company, ""),
    sort: firstParam(query.sort, "newest") as "newest" | "oldest"
  };
  const workspace = await getDefaultWorkspace();
  const documents = await listDocumentWorkspaceEntries(workspace.id, filters);

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Documents workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              Browse immutable rendered artifacts
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
              This corrective workspace indexes rendered document versions without starting the full
              future document-library milestone.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonSecondaryClassName} href="/jobs">
              Browse jobs
            </Link>
            <Link className={buttonPrimaryClassName} href="/applications">
              Open applications
            </Link>
          </div>
        </div>

        <form className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2 text-sm font-medium text-stone-700 xl:col-span-2">
            Search documents
            <input
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.search}
              name="q"
              placeholder="Title, filename, company, role, or format"
              type="search"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Type
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.type}
              name="type"
            >
              <option value="all">All</option>
              <option value="resume">Resume</option>
              <option value="cover_letter">Cover letter</option>
              <option value="application_answer">Application answer</option>
              <option value="interview_prep">Interview prep</option>
              <option value="portfolio">Portfolio</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Format
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.format}
              name="format"
            >
              <option value="all">All</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="txt">TXT</option>
              <option value="md">MD</option>
              <option value="json">JSON</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Company
            <input
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.company}
              name="company"
              placeholder="Exact company name"
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Sort
            <select
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              defaultValue={filters.sort}
              name="sort"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <div className="flex items-end gap-3 xl:col-span-5">
            <button className={buttonPrimaryClassName} type="submit">
              Apply filters
            </button>
            <Link className={buttonSecondaryClassName} href="/documents">
              Clear
            </Link>
          </div>
        </form>
      </section>

      {documents.length === 0 ? (
        <section className={cardClassName}>
          <h2 className="text-2xl font-semibold text-stone-900">No documents found</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {filters.search || filters.company || filters.type !== "all" || filters.format !== "all"
              ? "No immutable document versions match the current filters."
              : "No rendered document artifacts have been stored yet."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={buttonSecondaryClassName} href="/jobs">
              Browse jobs
            </Link>
            <Link className={buttonPrimaryClassName} href="/applications">
              Open applications
            </Link>
          </div>
        </section>
      ) : (
        <section aria-label="Document versions" className="grid gap-4">
          {documents.map((document) => (
            <article key={document.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
                    {document.typeLabel}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-900">{document.title}</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    {document.companyName} - {document.roleTitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    className={buttonPrimaryClassName}
                    href={`/api/documents/${document.id}/download`}
                  >
                    Download {document.formatLabel}
                  </a>
                  <Link className={buttonSecondaryClassName} href={`/documents/${document.id}`}>
                    Artifact detail
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Filename</p>
                  <p className="mt-2 break-all text-sm font-semibold text-stone-900">
                    {document.filename}
                  </p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Format</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">{document.formatLabel}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Generated</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {document.generatedAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
                  </p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Render status</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">{document.renderStatusLabel}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Approval state</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{document.approvalState}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Renderer version</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{document.rendererVersion}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Template version</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{document.templateVersion}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Application</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {document.applicationId ?? "No application linked"}
                  </p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">Logical document</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{document.documentId}</p>
                </article>
                <article className={mutedCardClassName}>
                  <p className="text-sm font-medium text-stone-500">File size</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {document.fileSizeBytes.toLocaleString()} bytes
                  </p>
                </article>
              </div>

              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                {document.applicationId ? (
                  <Link className={textActionClassName} href={`/applications/${document.applicationId}`}>
                    Open application
                  </Link>
                ) : null}
                <Link className={textActionClassName} href={`/jobs`}>
                  Browse related jobs
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
