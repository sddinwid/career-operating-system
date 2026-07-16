import type { ImportJob, ImportRow, Prisma } from "@prisma/client";
import {
  confirmFixtureImportAction,
  prepareFixtureImportPreviewAction,
  retryFixtureImportRowsAction
} from "@/lib/imports/actions";
import {
  importFieldDefinitions,
  type FieldMapping,
  type ImportIssueCode,
  type ImportJobSummaryPayload,
  type WorkbookInspection
} from "@/lib/imports/types";

type ImportWizardProps = {
  inspection: WorkbookInspection;
  selectedMapping: FieldMapping;
  job: (ImportJob & { rows: ImportRow[] }) | null;
  rowFilter: string;
  success?: string;
};

type StoredNormalizedRow = {
  authoritativeData?: Record<string, string | boolean | undefined>;
  derivedData?: Record<string, string | undefined>;
  issueGroups?: Array<{
    code: ImportIssueCode;
    severity: "warning" | "error";
    message: string;
  }>;
  warnings?: string[];
  errors?: string[];
  duplicateMatches?: Array<{
    type: "strong" | "possible";
    reason: string;
    applicationId?: string;
  }>;
  classification?:
    | "valid"
    | "warning"
    | "invalid"
    | "duplicate"
    | "skipped_blank"
    | "skipped_informational";
  proposedRecordType?:
    | "submitted_application"
    | "saved_opportunity"
    | "outreach_only"
    | "informational"
    | "duplicate"
    | "unusable";
  recommendedHandling?:
    | "import_normally"
    | "import_as_incomplete_application"
    | "import_as_saved_opportunity"
    | "import_with_warning"
    | "skip_intentionally"
    | "requires_user_review";
  willImport?: boolean;
};

type StoredRawCell = {
  address: string;
  displayValue: string;
  hyperlink?: string;
};

function parseSummary(summary: Prisma.JsonValue | null) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return undefined;
  }

  return summary as unknown as ImportJobSummaryPayload;
}

function parseNormalizedRow(row: ImportRow) {
  const value = row.normalizedData;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as unknown as StoredNormalizedRow;
}

function parseRawData(row: ImportRow) {
  const value = row.rawData;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as unknown as Record<string, StoredRawCell>;
}

function SuccessBanner({ success }: { success?: string }) {
  if (!success) {
    return null;
  }

  const messages: Record<string, string> = {
    preview:
      "Workbook preview prepared. Review mappings, reconciliation counts, and row-level handling before importing.",
    imported:
      "Import finished. Review the summary and any row-level warnings, reviews, or intentional skips.",
    retried: "Retry finished. Updated row results are shown below."
  };

  const message = messages[success];
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </div>
  );
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function ImportWizard({
  inspection,
  selectedMapping,
  job,
  rowFilter,
  success
}: ImportWizardProps) {
  const summary = job ? parseSummary(job.summary) : undefined;
  const trackerSheet = inspection.sheets.find((sheet) => sheet.detectedKind === "tracker");
  const blankRows = Math.max(
    0,
    (trackerSheet?.dataRowCount ?? 0) - (job?.rows.length ?? 0)
  );
  const filteredRows =
    job?.rows.filter((row) => {
      if (rowFilter === "all") {
        return true;
      }

      const normalized = parseNormalizedRow(row);
      if (rowFilter === "review") {
        return normalized.recommendedHandling === "requires_user_review";
      }

      return normalized.classification === rowFilter;
    }) ?? [];
  const jobQuery = job ? `jobId=${job.id}` : "";
  const filterHref = (filter: string) =>
    `/imports?${jobQuery}${jobQuery ? "&" : ""}filter=${filter}`;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Imports/Exports
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
            Fixture-driven Excel import wizard
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            Inspect the bundled July US tracker, review inferred mappings, reconcile
            every meaningful row, then confirm import only after duplicates,
            reviews, and warnings look right.
          </p>
        </div>
      </section>

      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">
              1. Inspect workbook
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              The fixture is read in place and never modified. Sheet detection and
              header discovery are based on the actual workbook structure.
            </p>
          </div>
          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
            <div>
              <strong>Fixture:</strong> {inspection.filename}
            </div>
            <div className="mt-1">
              <strong>Tracker header row:</strong>{" "}
              {inspection.trackerHeaderRowNumber ?? "Not found"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {inspection.sheets.map((sheet) => (
            <article
              key={sheet.name}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-stone-900">{sheet.name}</h3>
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-700">
                  {sheet.detectedKind}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-600">
                Header row: {sheet.headerRowNumber ?? "Not detected"}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Physical data rows after header: {sheet.dataRowCount}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {sheet.headers.filter(Boolean).slice(0, 8).map((header) => (
                  <span
                    key={`${sheet.name}-${header}`}
                    className="rounded-full bg-white px-3 py-1 text-xs text-stone-600"
                  >
                    {header}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">
            2. Map columns
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Inferred mappings are preselected from the real header row. Derived
            tracker helpers stay visible for preview, but they are classified and not
            imported as authoritative facts.
          </p>
        </div>

        <form action={prepareFixtureImportPreviewAction} className="mt-6 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            {importFieldDefinitions.map((field) => (
              <label className="grid gap-2" key={field.id}>
                <span className="text-sm font-medium text-stone-700">
                  {field.label}
                  {field.authoritative ? (
                    <span className="ml-2 text-xs uppercase tracking-[0.2em] text-stone-500">
                      Authoritative
                    </span>
                  ) : (
                    <span className="ml-2 text-xs uppercase tracking-[0.2em] text-amber-700">
                      Derived only
                    </span>
                  )}
                </span>
                <select
                  className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                  defaultValue={selectedMapping[field.id] ?? ""}
                  name={field.id}
                >
                  <option value="">Ignore</option>
                  {inspection.trackerHeaders.map((header) => (
                    <option key={`${field.id}-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <button
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            type="submit"
          >
            Preview workbook
          </button>
        </form>
      </section>

      {job ? (
        <>
          <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-stone-900">
                  3. Reconciliation preview
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Raw cells, normalized values, duplicate matches, proposed record
                  type, and handling are stored in this import job before anything is
                  written to applications data.
                </p>
              </div>
              <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
                <div>
                  <strong>Job id:</strong> {job.id}
                </div>
                <div className="mt-1">
                  <strong>Status:</strong> {job.status}
                </div>
              </div>
            </div>

            {summary?.preview ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Meaningful rows
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-stone-900">
                      {summary.preview.totalRows}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Blank rows
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-stone-900">
                      {blankRows}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                      Will import
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-900">
                      {summary.preview.readyCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                      Duplicate
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-amber-900">
                      {summary.preview.classificationCounts.duplicate}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-700">
                      Warning
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-sky-900">
                      {summary.preview.classificationCounts.warning}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-red-700">
                      Review/Error
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-red-900">
                      {summary.preview.classificationCounts.invalid}
                    </p>
                  </div>
                </div>

                <section className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <h3 className="text-lg font-semibold text-stone-900">
                    Grouped issue counts
                  </h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(summary.preview.groupedIssueCounts)
                      .sort(([, left], [, right]) => (right ?? 0) - (left ?? 0))
                      .map(([code, count]) => (
                        <div
                          className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
                          key={code}
                        >
                          <div className="font-medium text-stone-900">{code}</div>
                          <div className="mt-1">{count}</div>
                        </div>
                      ))}
                  </div>
                </section>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("all")}
                  >
                    All ({summary.preview.totalRows})
                  </a>
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("valid")}
                  >
                    Valid ({summary.preview.classificationCounts.valid})
                  </a>
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("warning")}
                  >
                    Warning ({summary.preview.classificationCounts.warning})
                  </a>
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("review")}
                  >
                    Review ({summary.preview.recommendedHandlingCounts.requires_user_review})
                  </a>
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("duplicate")}
                  >
                    Duplicate ({summary.preview.classificationCounts.duplicate})
                  </a>
                  <a
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={filterHref("invalid")}
                  >
                    Error ({summary.preview.classificationCounts.invalid})
                  </a>
                </div>
              </>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <form action={confirmFixtureImportAction}>
                <input name="jobId" type="hidden" value={job.id} />
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Confirm and import
                </button>
              </form>

              <form action={retryFixtureImportRowsAction}>
                <input name="jobId" type="hidden" value={job.id} />
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Retry failed rows
                </button>
              </form>
            </div>
          </section>

          {summary?.importResult ? (
            <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-stone-900">
                4. Import summary
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                    Success rows
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-900">
                    {summary.importResult.successCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                    Applications
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-900">
                    {summary.importResult.applicationCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                    Opportunities only
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-900">
                    {summary.importResult.opportunityOnlyCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                    Skipped
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">
                    {summary.importResult.skippedCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                    Duplicates
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-amber-900">
                    {summary.importResult.duplicateCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-700">
                    Warnings
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-sky-900">
                    {summary.importResult.warningCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-red-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-red-700">
                    Review/Error
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-red-900">
                    {summary.importResult.reviewCount}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-stone-900">Raw preview</h2>
              <div className="mt-6 space-y-4">
                {filteredRows.map((row) => {
                  const rawData = parseRawData(row);

                  return (
                    <article
                      className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                      key={row.id}
                    >
                      <p className="text-sm font-semibold text-stone-900">
                        {row.sheetName} row {row.rowNumber}
                      </p>
                      <dl className="mt-3 grid gap-2 text-sm text-stone-700">
                        {Object.entries(rawData)
                          .slice(0, 12)
                          .map(([columnKey, cell]) => (
                            <div className="grid grid-cols-[4rem_1fr] gap-3" key={columnKey}>
                              <dt className="font-medium text-stone-500">
                                {columnKey}
                              </dt>
                              <dd>{cell.displayValue || "-"}</dd>
                            </div>
                          ))}
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-stone-900">
                Reconciled rows
              </h2>
              <div className="mt-6 space-y-4">
                {filteredRows.map((row) => {
                  const normalized = parseNormalizedRow(row);

                  return (
                    <article
                      className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                      key={row.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-stone-900">
                          {row.sheetName} row {row.rowNumber}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-700">
                            {normalized.classification ?? row.status}
                          </span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-700">
                            {formatLabel(
                              normalized.proposedRecordType ?? "unusable"
                            )}
                          </span>
                        </div>
                      </div>

                      <dl className="mt-3 grid gap-2 text-sm text-stone-700">
                        {Object.entries(normalized.authoritativeData ?? {})
                          .filter(([, value]) => value !== undefined && value !== "")
                          .slice(0, 12)
                          .map(([key, value]) => (
                            <div className="grid grid-cols-[10rem_1fr] gap-3" key={key}>
                              <dt className="font-medium capitalize text-stone-500">
                                {key}
                              </dt>
                              <dd>{String(value)}</dd>
                            </div>
                          ))}
                      </dl>

                      <div className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
                        <div>
                          <strong>Will import:</strong>{" "}
                          {normalized.willImport ? "Yes" : "No"}
                        </div>
                        <div className="mt-1">
                          <strong>Recommended handling:</strong>{" "}
                          {formatLabel(
                            normalized.recommendedHandling ?? "requires_user_review"
                          )}
                        </div>
                      </div>

                      {normalized.derivedData &&
                      Object.keys(normalized.derivedData).length > 0 ? (
                        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Derived columns:{" "}
                          {Object.keys(normalized.derivedData).join(", ")}
                        </div>
                      ) : null}

                      {normalized.duplicateMatches?.length ? (
                        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {normalized.duplicateMatches
                            .map((match) => match.reason)
                            .join(" ")}
                        </div>
                      ) : null}

                      {normalized.issueGroups?.length ? (
                        <div className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
                          <p className="font-medium text-stone-900">Issue groups</p>
                          <ul className="mt-2 grid gap-2">
                            {normalized.issueGroups.map((issue, index) => (
                              <li key={`${issue.code}-${index}`}>
                                <strong>{issue.code}</strong>: {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {normalized.warnings?.length ? (
                        <ul className="mt-4 grid gap-2 text-sm text-sky-800">
                          {normalized.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}

                      {normalized.errors?.length ? (
                        <ul className="mt-4 grid gap-2 text-sm text-red-800">
                          {normalized.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
