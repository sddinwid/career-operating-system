import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { ApplicationPriority, ApplicationStatus } from "@prisma/client";
import { canonicalizeJobUrl } from "@/lib/applications/opportunity-shared";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import {
  IMPORT_FIXTURE_FILENAME,
  IMPORT_FIXTURE_RELATIVE_PATH,
  importFieldDefinitions,
  type DuplicateMatch,
  type FieldMapping,
  type ImportFieldId,
  type ImportIssue,
  type ImportIssueCode,
  type ImportPreviewSummary,
  type NormalizedImportRow,
  type ProposedRecordType,
  type RecommendedHandling,
  type RowClassification,
  type WorkbookCellValue,
  type WorkbookInspection,
  type WorkbookRow,
  type WorkbookSheetInspection
} from "@/lib/imports/types";

type SheetMatrix = {
  rows: WorkbookRow[];
  columnKeys: string[];
};

type ExistingApplicationDuplicateCandidate = {
  id: string;
  companyName: string;
  normalizedCompanyName: string;
  role: string;
  normalizedRole: string;
  appliedDate: string | null;
  jobUrl: string | null;
};

const REQUIRED_TRACKER_HEADERS = new Set([
  "status",
  "date of application",
  "company",
  "position role"
]);

const statusMap: Record<string, ApplicationStatus> = {
  applied: "APPLIED",
  rejected: "REJECTED",
  offer: "OFFER",
  interviewing: "INTERVIEW",
  interview: "INTERVIEW",
  "in progress": "IN_PROGRESS",
  "on hold": "IN_PROGRESS",
  withdrawn: "WITHDRAWN",
  archived: "ARCHIVED",
  draft: "DRAFT"
};

const priorityMap: Record<string, ApplicationPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
  "very high": "URGENT"
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/:-]+/g, " ")
    .replace(/[?]/g, "")
    .replace(/\s+/g, " ");
}

function valueToString(value: boolean | number | string | null | undefined) {
  if (value == null) {
    return "";
  }

  return typeof value === "string" ? value.trim() : String(value);
}

function cleanTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function looksLikeUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  return /^(https?:\/\/|www\.)/i.test(value.trim());
}

function getCellPreferredLinkValue(cell?: WorkbookCellValue) {
  const hyperlink = cleanTrimmed(cell?.hyperlink);
  if (hyperlink) {
    return hyperlink;
  }

  const displayValue = cleanTrimmed(cell?.displayValue);
  if (looksLikeUrl(displayValue)) {
    return displayValue;
  }

  return undefined;
}

function serializeRawValue(value: unknown): boolean | number | string | null {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  return String(value);
}

function columnIndexToKey(index: number) {
  return XLSX.utils.encode_col(index);
}

function buildSheetMatrix(worksheet: XLSX.WorkSheet): SheetMatrix {
  const ref = worksheet["!ref"];
  if (!ref) {
    return { rows: [], columnKeys: [] };
  }

  const range = XLSX.utils.decode_range(ref);
  const rows: WorkbookRow[] = [];
  const columnKeys: string[] = [];

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    columnKeys.push(columnIndexToKey(column));
  }

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const cells: Record<string, WorkbookCellValue> = {};

    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ c: column, r: rowIndex });
      const columnKey = columnIndexToKey(column);
      const cell = worksheet[address];
      const rawValue = serializeRawValue(cell?.v);
      const displayValue = valueToString(cell?.w ?? cell?.v ?? "");

      cells[columnKey] = {
        address,
        columnKey,
        rawValue,
        displayValue,
        hyperlink: cleanTrimmed(cell?.l?.Target),
        formula: cell?.f,
        type: cell?.t ?? "z"
      };
    }

    rows.push({ rowNumber, cells });
  }

  return { rows, columnKeys };
}

function detectHeaderRow(rows: WorkbookRow[]) {
  let bestHeaderRow: WorkbookRow | null = null;
  let bestScore = 0;

  for (const row of rows.slice(0, 12)) {
    const values = Object.values(row.cells)
      .map((cell) => normalizeHeader(cell.displayValue))
      .filter(Boolean);

    const score = values.filter((value) => REQUIRED_TRACKER_HEADERS.has(value)).length;
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = row;
    }
  }

  return bestScore >= 4 ? bestHeaderRow : null;
}

function inferSheetKind(name: string, headers: string[]) {
  const normalizedName = name.trim().toLowerCase();
  if (normalizedName === "tracker") {
    return "tracker" as const;
  }

  if (normalizedName === "dashboard") {
    return "dashboard" as const;
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  if (normalizedHeaders.some((header) => REQUIRED_TRACKER_HEADERS.has(header))) {
    return "tracker" as const;
  }

  if (normalizedHeaders.includes("job search command center")) {
    return "dashboard" as const;
  }

  return "unknown" as const;
}

function inferFieldMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};

  for (const definition of importFieldDefinitions) {
    const match = headers.find((header) =>
      definition.inferredHeaders.some(
        (candidate) => normalizeHeader(candidate) === normalizeHeader(header)
      )
    );

    if (match) {
      mapping[definition.id] = match;
    }
  }

  return mapping;
}

function getMappedCell(
  row: WorkbookRow,
  headerLookup: Map<string, string>,
  mapping: FieldMapping,
  fieldId: ImportFieldId
) {
  const header = mapping[fieldId];
  if (!header) {
    return undefined;
  }

  const columnKey = headerLookup.get(header);
  if (!columnKey) {
    return undefined;
  }

  return row.cells[columnKey];
}

function parseBooleanCell(cell?: WorkbookCellValue) {
  if (!cell) {
    return undefined;
  }

  if (typeof cell.rawValue === "boolean") {
    return cell.rawValue;
  }

  const value = normalizeHeader(cell.displayValue);
  if (value === "true" || value === "yes" || value === "1") {
    return true;
  }

  if (value === "false" || value === "no" || value === "0") {
    return false;
  }

  return undefined;
}

function parseDateCell(cell?: WorkbookCellValue) {
  if (!cell) {
    return { value: undefined, error: undefined };
  }

  if (typeof cell.rawValue === "number") {
    const parsed = XLSX.SSF.parse_date_code(cell.rawValue);
    if (!parsed) {
      return { value: undefined, error: `Invalid Excel date in ${cell.address}.` };
    }

    const year = String(parsed.y).padStart(4, "0");
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return { value: `${year}-${month}-${day}`, error: undefined };
  }

  const display = cell.displayValue.trim();
  if (!display) {
    return { value: undefined, error: undefined };
  }

  const parsed = new Date(display);
  if (Number.isNaN(parsed.getTime())) {
    return { value: undefined, error: `Invalid date value "${display}" in ${cell.address}.` };
  }

  return { value: parsed.toISOString().slice(0, 10), error: undefined };
}

function validateUrl(value: string | undefined, label: string, errors: string[]) {
  if (!value) {
    return;
  }

  try {
    new URL(value);
  } catch {
    errors.push(`${label} must be a valid URL.`);
  }
}

function validateEmail(value: string | undefined, errors: string[]) {
  if (!value) {
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(value)) {
    errors.push("Recruiter email must be a valid email address.");
  }
}

function createIssue(
  code: ImportIssueCode,
  severity: "warning" | "error",
  message: string
): ImportIssue {
  return { code, severity, message };
}

function getHeaderLookup(
  headerRow: WorkbookRow,
  columnKeys: string[]
) {
  const lookup = new Map<string, string>();

  for (const columnKey of columnKeys) {
    const header = headerRow.cells[columnKey]?.displayValue.trim();
    if (header) {
      lookup.set(header, columnKey);
    }
  }

  return lookup;
}

function buildIdentityKey(
  normalizedCompanyName: string | undefined,
  normalizedRole: string | undefined,
  appliedDate: string | undefined
) {
  if (!normalizedCompanyName || !normalizedRole || !appliedDate) {
    return null;
  }

  return `${normalizedCompanyName}::${normalizedRole}::${appliedDate}`;
}

function summarizeRows(rows: NormalizedImportRow[]): ImportPreviewSummary {
  const classificationCounts: Record<RowClassification, number> = {
    valid: 0,
    warning: 0,
    invalid: 0,
    duplicate: 0,
    skipped_blank: 0,
    skipped_informational: 0
  };
  const proposedRecordTypeCounts: Record<ProposedRecordType, number> = {
    submitted_application: 0,
    saved_opportunity: 0,
    outreach_only: 0,
    informational: 0,
    duplicate: 0,
    unusable: 0
  };
  const recommendedHandlingCounts: Record<RecommendedHandling, number> = {
    import_normally: 0,
    import_as_incomplete_application: 0,
    import_as_saved_opportunity: 0,
    import_with_warning: 0,
    skip_intentionally: 0,
    requires_user_review: 0
  };
  const groupedIssueCounts: Partial<Record<ImportIssueCode, number>> = {};

  for (const row of rows) {
    classificationCounts[row.classification] += 1;
    proposedRecordTypeCounts[row.proposedRecordType] += 1;
    recommendedHandlingCounts[row.recommendedHandling] += 1;
    for (const issue of row.issueGroups) {
      groupedIssueCounts[issue.code] = (groupedIssueCounts[issue.code] ?? 0) + 1;
    }
  }

  return {
    totalRows: rows.length,
    readyCount: rows.filter((row) => row.willImport).length,
    duplicateCount: rows.filter((row) => row.previewStatus === "DUPLICATE").length,
    warningCount: rows.reduce((count, row) => count + row.warnings.length, 0),
    errorCount: rows.reduce((count, row) => count + row.errors.length, 0),
    skippedCount: rows.filter((row) => !row.willImport).length,
    classificationCounts,
    proposedRecordTypeCounts,
    recommendedHandlingCounts,
    groupedIssueCounts
  };
}

export function getFixtureWorkbookPath() {
  return path.resolve(process.cwd(), IMPORT_FIXTURE_RELATIVE_PATH);
}

function readFixtureWorkbook() {
  const fixturePath = getFixtureWorkbookPath();
  const fileBuffer = readFileSync(fixturePath);

  return {
    fileBuffer,
    workbook: XLSX.read(fileBuffer, {
      type: "buffer",
      cellFormula: true,
      cellNF: true,
      cellText: true
    })
  };
}

export function readFixtureWorkbookInspection(): WorkbookInspection {
  const { workbook, fileBuffer } = readFixtureWorkbook();
  const checksum = createHash("sha256").update(fileBuffer).digest("hex");

  const sheets: WorkbookSheetInspection[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const matrix = buildSheetMatrix(worksheet);
    const headerRow = detectHeaderRow(matrix.rows);
    const headers = headerRow
      ? matrix.columnKeys.map((columnKey) => headerRow.cells[columnKey]?.displayValue ?? "")
      : [];
    const detectedKind = inferSheetKind(name, headers);
    const dataRows = headerRow
      ? matrix.rows.filter((row) => row.rowNumber > headerRow.rowNumber)
      : [];

    return {
      name,
      detectedKind,
      headerRowNumber: headerRow?.rowNumber ?? null,
      columnKeys: matrix.columnKeys,
      headers,
      dataRowCount: dataRows.length
    };
  });

  const trackerSheet = sheets.find((sheet) => sheet.detectedKind === "tracker") ?? null;
  const dashboardSheet = sheets.find((sheet) => sheet.detectedKind === "dashboard") ?? null;
  const trackerHeaders = trackerSheet?.headers.filter(Boolean) ?? [];

  return {
    filename: IMPORT_FIXTURE_FILENAME,
    checksum,
    sheets,
    trackerSheetName: trackerSheet?.name ?? null,
    dashboardSheetName: dashboardSheet?.name ?? null,
    trackerHeaderRowNumber: trackerSheet?.headerRowNumber ?? null,
    trackerHeaders,
    inferredMapping: inferFieldMapping(trackerHeaders)
  };
}

export function buildPreviewRowsFromFixture(
  mapping: FieldMapping,
  existingApplications: ExistingApplicationDuplicateCandidate[]
) {
  const { workbook } = readFixtureWorkbook();
  const inspection = readFixtureWorkbookInspection();

  if (!inspection.trackerSheetName || inspection.trackerHeaderRowNumber == null) {
    throw new Error("Tracker sheet or header row could not be detected in the fixture.");
  }

  const worksheet = workbook.Sheets[inspection.trackerSheetName];
  const matrix = buildSheetMatrix(worksheet);
  const headerRow = matrix.rows.find(
    (row) => row.rowNumber === inspection.trackerHeaderRowNumber
  );

  if (!headerRow) {
    throw new Error("Tracker header row could not be loaded.");
  }

  const headerLookup = getHeaderLookup(headerRow, matrix.columnKeys);
  const seenIdentityKeys = new Set<string>();
  const rows: NormalizedImportRow[] = [];

  for (const row of matrix.rows) {
    if (row.rowNumber <= headerRow.rowNumber) {
      continue;
    }

    const sourceColumns = Object.fromEntries(
      Object.entries(row.cells).filter(([, cell]) => cell.displayValue || cell.rawValue != null)
    );

    const mappedValues = {
      status: getMappedCell(row, headerLookup, mapping, "status"),
      appliedDate: getMappedCell(row, headerLookup, mapping, "appliedDate"),
      companyName: getMappedCell(row, headerLookup, mapping, "companyName"),
      role: getMappedCell(row, headerLookup, mapping, "role"),
      jobUrl: getMappedCell(row, headerLookup, mapping, "jobUrl"),
      recruiterLinkedIn: getMappedCell(row, headerLookup, mapping, "recruiterLinkedIn"),
      recruiterEmail: getMappedCell(row, headerLookup, mapping, "recruiterEmail"),
      priority: getMappedCell(row, headerLookup, mapping, "priority"),
      rejectionReason: getMappedCell(row, headerLookup, mapping, "rejectionReason"),
      notes: getMappedCell(row, headerLookup, mapping, "notes"),
      linkedinConnectionSent: getMappedCell(
        row,
        headerLookup,
        mapping,
        "linkedinConnectionSent"
      ),
      linkedinAccepted: getMappedCell(row, headerLookup, mapping, "linkedinAccepted"),
      linkedinFollowUpRequested: getMappedCell(
        row,
        headerLookup,
        mapping,
        "linkedinFollowUpRequested"
      ),
      linkedinMessageSentDate: getMappedCell(
        row,
        headerLookup,
        mapping,
        "linkedinMessageSentDate"
      ),
      linkedinResponse: getMappedCell(row, headerLookup, mapping, "linkedinResponse"),
      emailFollowUpRequested: getMappedCell(
        row,
        headerLookup,
        mapping,
        "emailFollowUpRequested"
      ),
      emailSentDate: getMappedCell(row, headerLookup, mapping, "emailSentDate"),
      emailResponse: getMappedCell(row, headerLookup, mapping, "emailResponse"),
      invitedToInterview: getMappedCell(row, headerLookup, mapping, "invitedToInterview"),
      firstInterviewDate: getMappedCell(row, headerLookup, mapping, "firstInterviewDate"),
      interviewStagesCompleted: getMappedCell(
        row,
        headerLookup,
        mapping,
        "interviewStagesCompleted"
      )
    };

    const isMeaningfulRow = Boolean(
      mappedValues.companyName?.displayValue ||
        mappedValues.role?.displayValue ||
        mappedValues.appliedDate?.displayValue ||
        mappedValues.jobUrl?.displayValue
    );

    if (!isMeaningfulRow) {
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const issueGroups: ImportIssue[] = [];
    const duplicateMatches: DuplicateMatch[] = [];

    const rawStatus = cleanTrimmed(mappedValues.status?.displayValue);
    const normalizedStatus = rawStatus ? statusMap[normalizeHeader(rawStatus)] : undefined;
    if (rawStatus && !normalizedStatus) {
      warnings.push(`Status "${rawStatus}" is not mapped yet and requires review.`);
      issueGroups.push(
        createIssue(
          "UNKNOWN_STATUS",
          "warning",
          `Status "${rawStatus}" is not mapped yet and requires review.`
        )
      );
    }

    const parsedAppliedDate = parseDateCell(mappedValues.appliedDate);
    if (parsedAppliedDate.error) {
      errors.push(parsedAppliedDate.error);
    }

    const rawCompanyName = cleanTrimmed(mappedValues.companyName?.displayValue);
    const rawRole = cleanTrimmed(mappedValues.role?.displayValue);
    const rawJobUrl = getCellPreferredLinkValue(mappedValues.jobUrl);
    const hasDisplayOnlyJobLink = Boolean(
      mappedValues.jobUrl?.displayValue && !rawJobUrl
    );
    const recruiterLinkedIn = getCellPreferredLinkValue(
      mappedValues.recruiterLinkedIn
    );
    const recruiterEmail = cleanTrimmed(mappedValues.recruiterEmail?.displayValue);
    const rejectionReason = cleanTrimmed(mappedValues.rejectionReason?.displayValue);
    const notes = cleanTrimmed(mappedValues.notes?.displayValue);
    const rawPriority = cleanTrimmed(mappedValues.priority?.displayValue);
    const normalizedPriority = rawPriority
      ? priorityMap[normalizeHeader(rawPriority)]
      : undefined;

    if (rawPriority && !normalizedPriority) {
      warnings.push(`Priority "${rawPriority}" is not mapped and will be preserved for review.`);
      issueGroups.push(
        createIssue(
          "UNKNOWN_PRIORITY",
          "warning",
          `Priority "${rawPriority}" is not mapped and will be preserved for review.`
        )
      );
    }

    if (rawPriority && normalizeHeader(rawPriority) === "very high") {
      warnings.push('Priority "Very High" is mapped to URGENT.');
    }

    const hasUsableResearchSignals = Boolean(
      rawJobUrl || recruiterLinkedIn || recruiterEmail
    );
    const shouldRequireCompanyAndRole = Boolean(
      rawCompanyName || rawRole || parsedAppliedDate.value || hasUsableResearchSignals
    );

    if (shouldRequireCompanyAndRole && !rawCompanyName) {
      errors.push("Company is required for import.");
      issueGroups.push(
        createIssue("MISSING_COMPANY", "error", "Company is required for import.")
      );
    }

    if (shouldRequireCompanyAndRole && !rawRole) {
      errors.push("Position or role is required for import.");
      issueGroups.push(
        createIssue(
          "MISSING_ROLE",
          "error",
          "Position or role is required for import."
        )
      );
    }

    if (rawJobUrl) {
      try {
        new URL(rawJobUrl);
      } catch {
        warnings.push("Job URL is invalid and will be preserved only in the raw import row.");
        issueGroups.push(
          createIssue(
            "INVALID_OPTIONAL_URL",
            "warning",
            "Job URL is invalid and will be preserved only in the raw import row."
          )
        );
      }
    } else if (hasDisplayOnlyJobLink) {
      issueGroups.push(
        createIssue(
          "FORMULA_OR_DISPLAY_ONLY_VALUE",
          "warning",
          "Job link is display-only text without a usable hyperlink target."
        )
      );
      warnings.push(
        "Job link is display-only text without a usable hyperlink target."
      );
    }

    if (recruiterLinkedIn) {
      try {
        new URL(recruiterLinkedIn);
      } catch {
        warnings.push(
          "Recruiter LinkedIn profile is invalid and will be preserved only in the raw import row."
        );
        issueGroups.push(
          createIssue(
            "INVALID_OPTIONAL_URL",
            "warning",
            "Recruiter LinkedIn profile is invalid and will be preserved only in the raw import row."
          )
        );
      }
    }

    if (recruiterEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(recruiterEmail)) {
        warnings.push(
          "Recruiter email is invalid and will be preserved only in the raw import row."
        );
        issueGroups.push(
          createIssue(
            "INVALID_OPTIONAL_EMAIL",
            "warning",
            "Recruiter email is invalid and will be preserved only in the raw import row."
          )
        );
      }
    }

    const linkedInMessageDate = parseDateCell(mappedValues.linkedinMessageSentDate);
    if (linkedInMessageDate.error) {
      errors.push(linkedInMessageDate.error);
      issueGroups.push(
        createIssue(
          "UNRECOGNIZED_DATE_FORMAT",
          "error",
          linkedInMessageDate.error
        )
      );
    }

    const emailSentDate = parseDateCell(mappedValues.emailSentDate);
    if (emailSentDate.error) {
      errors.push(emailSentDate.error);
      issueGroups.push(
        createIssue("UNRECOGNIZED_DATE_FORMAT", "error", emailSentDate.error)
      );
    }

    const firstInterviewDate = parseDateCell(mappedValues.firstInterviewDate);
    if (firstInterviewDate.error) {
      errors.push(firstInterviewDate.error);
      issueGroups.push(
        createIssue("UNRECOGNIZED_DATE_FORMAT", "error", firstInterviewDate.error)
      );
    }

    const normalizedCompanyName = rawCompanyName
      ? normalizeCompanyName(rawCompanyName)
      : undefined;
    const normalizedRole = rawRole?.trim().toLowerCase();
    const identityKey = buildIdentityKey(
      normalizedCompanyName,
      normalizedRole,
      parsedAppliedDate.value
    );

    const canonicalJobUrl = canonicalizeJobUrl(rawJobUrl);

    for (const existing of existingApplications) {
      const sameCompanyAndRole =
        existing.normalizedCompanyName === normalizedCompanyName &&
        existing.normalizedRole === normalizedRole;

      if (
        sameCompanyAndRole &&
        existing.appliedDate &&
        parsedAppliedDate.value &&
        Math.abs(
          Math.round(
            (new Date(existing.appliedDate).getTime() -
              new Date(parsedAppliedDate.value).getTime()) /
              86400000
          )
        ) <= 1
      ) {
        duplicateMatches.push({
          type: "strong",
          reason: "Same company, role, and application date within one day.",
          applicationId: existing.id
        });
        issueGroups.push(
          createIssue(
            "DUPLICATE_MATCH_STRONG",
            "warning",
            "Same company, role, and application date within one day."
          )
        );
      } else if (sameCompanyAndRole) {
        duplicateMatches.push({
          type: "possible",
          reason: "Same company and role as an existing application.",
          applicationId: existing.id
        });
        issueGroups.push(
          createIssue(
            "DUPLICATE_MATCH_POSSIBLE",
            "warning",
            "Same company and role as an existing application."
          )
        );
      } else if (
        existing.jobUrl &&
        canonicalJobUrl &&
        canonicalizeJobUrl(existing.jobUrl) === canonicalJobUrl
      ) {
        duplicateMatches.push({
          type:
            sameCompanyAndRole && !parsedAppliedDate.value ? "strong" : "possible",
          reason:
            sameCompanyAndRole && !parsedAppliedDate.value
              ? "Same company, role, and canonical job URL already exist."
              : "Job URL matches an existing application opportunity.",
          applicationId: existing.id
        });
        issueGroups.push(
          createIssue(
            sameCompanyAndRole && !parsedAppliedDate.value
              ? "DUPLICATE_MATCH_STRONG"
              : "DUPLICATE_MATCH_POSSIBLE",
            "warning",
            sameCompanyAndRole && !parsedAppliedDate.value
              ? "Same company, role, and canonical job URL already exist."
              : "Job URL matches an existing application opportunity."
          )
        );
      }
    }

    if (identityKey && seenIdentityKeys.has(identityKey)) {
      duplicateMatches.push({
        type: "strong",
        reason: "Same company, role, and application date already exists in this preview."
      });
      issueGroups.push(
        createIssue(
          "DUPLICATE_MATCH_STRONG",
          "warning",
          "Same company, role, and application date already exists in this preview."
        )
      );
    }

    if (identityKey) {
      seenIdentityKeys.add(identityKey);
    }

    if (recruiterLinkedIn && !recruiterEmail) {
      warnings.push(
        "Recruiter contact has a LinkedIn profile but no email address."
      );
    }

    if (
      parseBooleanCell(mappedValues.invitedToInterview) === true &&
      !firstInterviewDate.value
    ) {
      warnings.push(
        "Interview invitation is marked but no first interview date is present."
      );
    }

    if (
      parseBooleanCell(mappedValues.linkedinConnectionSent) === true &&
      !linkedInMessageDate.value
    ) {
      warnings.push(
        "LinkedIn outreach is marked without a sent date, so only the source flag will be preserved."
      );
      issueGroups.push(
        createIssue(
          "OUTREACH_WITHOUT_DATE",
          "warning",
          "LinkedIn outreach is marked without a sent date, so only the source flag will be preserved."
        )
      );
    }

    const derivedData: Partial<Record<ImportFieldId, string>> = {};
    for (const fieldId of [
      "outreachStage",
      "lastTouchDate",
      "nextStep",
      "dueDate",
      "daysOpen",
      "daysSinceLastTouch",
      "readyToday"
    ] as const) {
      const cell = getMappedCell(row, headerLookup, mapping, fieldId);
      if (cell?.displayValue) {
        derivedData[fieldId] = cell.displayValue;
      }
    }

    if (Object.keys(derivedData).length > 0) {
      warnings.push(
        "Derived tracker columns were classified for preview and will not be imported as authoritative facts."
      );
      issueGroups.push(
        createIssue(
          "DERIVED_COLUMN_CLASSIFIED",
          "warning",
          "Derived tracker columns were classified for preview and will not be imported as authoritative facts."
        )
      );
    }

    const strongMatch = duplicateMatches.find((match) => match.type === "strong");
    const hasMinimumApplicationFields = Boolean(
      rawCompanyName && rawRole && parsedAppliedDate.value
    );
    const hasMinimumOpportunityFields = Boolean(rawCompanyName && rawRole);
    const hasResearchSignals = Boolean(
      hasUsableResearchSignals || hasDisplayOnlyJobLink
    );

    let proposedRecordType: ProposedRecordType = "unusable";
    let classification: RowClassification = "invalid";
    let recommendedHandling: RecommendedHandling = "requires_user_review";
    let willImport = false;

    if (strongMatch) {
      proposedRecordType = "duplicate";
      classification = "duplicate";
      recommendedHandling = "skip_intentionally";
      willImport = false;
    } else if (hasMinimumApplicationFields) {
      proposedRecordType = "submitted_application";
      classification = warnings.length > 0 ? "warning" : "valid";
      recommendedHandling =
        warnings.length > 0 ? "import_with_warning" : "import_normally";
      willImport = true;
    } else if (hasMinimumOpportunityFields) {
      proposedRecordType = "saved_opportunity";
      classification = warnings.length > 0 ? "warning" : "valid";
      recommendedHandling = "import_as_saved_opportunity";
      willImport = true;

      if (!parsedAppliedDate.value) {
        issueGroups.push(
          createIssue(
            "ROW_REPRESENTS_RESEARCH_NOT_APPLICATION",
            "warning",
            "Company and role are present without an application date, so this row will import as a saved opportunity."
          )
        );
        warnings.push(
          "Company and role are present without an application date, so this row will import as a saved opportunity."
        );
      }
    } else if (hasUsableResearchSignals) {
      proposedRecordType = "unusable";
      classification = "invalid";
      recommendedHandling = "requires_user_review";
      willImport = false;
      issueGroups.push(
        createIssue(
          "ROW_REQUIRES_REVIEW",
          "error",
          "This row contains useful research signals, but not enough verified fields to import as an application or opportunity."
        )
      );
      warnings.push(
        "This row contains useful research signals, but not enough verified fields to import as an application or opportunity."
      );
    }

    if (
      hasDisplayOnlyJobLink &&
      !hasUsableResearchSignals &&
      !rawCompanyName &&
      !rawRole &&
      !parsedAppliedDate.value
    ) {
      proposedRecordType = "informational";
      classification = "skipped_informational";
      recommendedHandling = "skip_intentionally";
      willImport = false;
      warnings.push(
        "This row only contains display-only tracker placeholders and will be skipped intentionally."
      );
    }

    if (hasMinimumOpportunityFields && !parsedAppliedDate.value) {
      issueGroups.push(
        createIssue(
          "MISSING_APPLICATION_DATE",
          "warning",
          "Application date is missing, so the row cannot import as a submitted application."
        )
      );
    }

    if (errors.length > 0 && !strongMatch && !willImport) {
      classification = "invalid";
      recommendedHandling = hasResearchSignals
        ? "requires_user_review"
        : "skip_intentionally";
    }

    const normalizedRecruiterEmail =
      recruiterEmail && warnings.includes(
        "Recruiter email is invalid and will be preserved only in the raw import row."
      )
        ? undefined
        : recruiterEmail;
    const normalizedRecruiterLinkedIn =
      recruiterLinkedIn && warnings.includes(
        "Recruiter LinkedIn profile is invalid and will be preserved only in the raw import row."
      )
        ? undefined
        : recruiterLinkedIn;
    const normalizedJobUrl =
      rawJobUrl && warnings.includes(
        "Job URL is invalid and will be preserved only in the raw import row."
      )
        ? undefined
        : rawJobUrl;

    rows.push({
      sheetName: inspection.trackerSheetName,
      rowNumber: row.rowNumber,
      identityKey,
      sourceColumns,
      authoritativeData: {
        status: normalizedStatus,
        rawStatus,
        appliedDate: parsedAppliedDate.value,
        appliedAtPrecision: parsedAppliedDate.value ? "DATE_ONLY" : undefined,
        companyName: rawCompanyName,
        normalizedCompanyName,
        role: rawRole,
        normalizedRole,
        jobUrl: normalizedJobUrl,
        rawJobUrl,
        recruiterLinkedIn: normalizedRecruiterLinkedIn,
        rawRecruiterLinkedIn: recruiterLinkedIn,
        recruiterEmail: normalizedRecruiterEmail,
        rawRecruiterEmail: recruiterEmail,
        priority: normalizedPriority,
        rawPriority,
        rejectionReason,
        notes,
        linkedinConnectionSent: parseBooleanCell(mappedValues.linkedinConnectionSent),
        linkedinAccepted: parseBooleanCell(mappedValues.linkedinAccepted),
        linkedinFollowUpRequested: parseBooleanCell(
          mappedValues.linkedinFollowUpRequested
        ),
        linkedinMessageSentDate: linkedInMessageDate.value,
        linkedinMessageSentPrecision: linkedInMessageDate.value
          ? "DATE_ONLY"
          : undefined,
        linkedinResponse: parseBooleanCell(mappedValues.linkedinResponse),
        emailFollowUpRequested: parseBooleanCell(mappedValues.emailFollowUpRequested),
        emailSentDate: emailSentDate.value,
        emailSentPrecision: emailSentDate.value ? "DATE_ONLY" : undefined,
        emailResponse: parseBooleanCell(mappedValues.emailResponse),
        invitedToInterview: parseBooleanCell(mappedValues.invitedToInterview),
        firstInterviewDate: firstInterviewDate.value,
        firstInterviewPrecision: firstInterviewDate.value ? "DATE_ONLY" : undefined,
        interviewStagesCompleted: cleanTrimmed(
          mappedValues.interviewStagesCompleted?.displayValue
        )
      },
      derivedData,
      issueGroups,
      warnings,
      errors,
      duplicateMatches,
      matchedApplicationId: strongMatch?.applicationId,
      classification,
      proposedRecordType,
      recommendedHandling,
      willImport,
      previewStatus: strongMatch
        ? "DUPLICATE"
        : willImport
          ? "READY"
          : recommendedHandling === "skip_intentionally"
            ? "SKIPPED"
            : "INVALID"
    });
  }

  return {
    inspection,
    rows,
    summary: summarizeRows(rows)
  };
}
