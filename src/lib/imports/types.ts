import type {
  ApplicationPriority,
  ApplicationStatus,
  ActivityType,
  ImportJob,
  ImportJobStatus,
  ImportRow,
  ImportRowStatus,
  InterviewStatus
} from "@prisma/client";

export const IMPORT_FIXTURE_FILENAME = "job_outreach_tracker-July-US.xlsx";
export const IMPORT_FIXTURE_RELATIVE_PATH = `fixtures/${IMPORT_FIXTURE_FILENAME}`;

export const importFieldDefinitions = [
  {
    id: "status",
    label: "Application status",
    authoritative: true,
    inferredHeaders: ["Status"]
  },
  {
    id: "appliedDate",
    label: "Application date",
    authoritative: true,
    inferredHeaders: ["Date of Application"]
  },
  {
    id: "companyName",
    label: "Company",
    authoritative: true,
    inferredHeaders: ["Company"]
  },
  {
    id: "role",
    label: "Position or role",
    authoritative: true,
    inferredHeaders: ["Position/Role"]
  },
  {
    id: "jobUrl",
    label: "Job URL",
    authoritative: true,
    inferredHeaders: ["Job link", "Job Link"]
  },
  {
    id: "recruiterLinkedIn",
    label: "Recruiter LinkedIn profile",
    authoritative: true,
    inferredHeaders: ["HR/Recruiter/Talent Acquisition LI Profile"]
  },
  {
    id: "recruiterEmail",
    label: "Recruiter email",
    authoritative: true,
    inferredHeaders: ["Their email address"]
  },
  {
    id: "linkedinConnectionSent",
    label: "LinkedIn connection sent",
    authoritative: true,
    inferredHeaders: ["LI connection sent"]
  },
  {
    id: "linkedinAccepted",
    label: "LinkedIn accepted",
    authoritative: true,
    inferredHeaders: ["Accepted:"]
  },
  {
    id: "linkedinFollowUpRequested",
    label: "Follow-up LinkedIn message requested",
    authoritative: true,
    inferredHeaders: ["Follow-Up LI message"]
  },
  {
    id: "linkedinMessageSentDate",
    label: "LinkedIn message sent date",
    authoritative: true,
    inferredHeaders: ["Date the LI message was sent"]
  },
  {
    id: "linkedinResponse",
    label: "LinkedIn response",
    authoritative: true,
    inferredHeaders: ["Response:"]
  },
  {
    id: "emailFollowUpRequested",
    label: "Follow-up email requested",
    authoritative: true,
    inferredHeaders: ["Follow-up Email if there is no response on LI"]
  },
  {
    id: "emailSentDate",
    label: "Follow-up email sent date",
    authoritative: true,
    inferredHeaders: ["Date the follow-up email was sent"]
  },
  {
    id: "emailResponse",
    label: "Email response",
    authoritative: true,
    inferredHeaders: ["Response:2"]
  },
  {
    id: "invitedToInterview",
    label: "Invited to interview",
    authoritative: true,
    inferredHeaders: ["Invited to interview"]
  },
  {
    id: "firstInterviewDate",
    label: "First interview date",
    authoritative: true,
    inferredHeaders: ["Date of first interview"]
  },
  {
    id: "interviewStagesCompleted",
    label: "Interview stages completed",
    authoritative: true,
    inferredHeaders: ["Interview stages completed"]
  },
  {
    id: "rejectionReason",
    label: "Rejection reason",
    authoritative: true,
    inferredHeaders: ["Reason for rejection"]
  },
  {
    id: "notes",
    label: "Notes",
    authoritative: true,
    inferredHeaders: ["Comment/Notes"]
  },
  {
    id: "priority",
    label: "Priority",
    authoritative: true,
    inferredHeaders: ["Priority"]
  },
  {
    id: "outreachStage",
    label: "Outreach stage",
    authoritative: false,
    inferredHeaders: ["Outreach stage"]
  },
  {
    id: "lastTouchDate",
    label: "Last touch date",
    authoritative: false,
    inferredHeaders: ["Last touch date"]
  },
  {
    id: "nextStep",
    label: "Next step",
    authoritative: false,
    inferredHeaders: ["Next step"]
  },
  {
    id: "dueDate",
    label: "Due date",
    authoritative: false,
    inferredHeaders: ["Due date"]
  },
  {
    id: "daysOpen",
    label: "Days open",
    authoritative: false,
    inferredHeaders: ["Days open"]
  },
  {
    id: "daysSinceLastTouch",
    label: "Days since last touch",
    authoritative: false,
    inferredHeaders: ["Days since last touch"]
  },
  {
    id: "readyToday",
    label: "Ready today",
    authoritative: false,
    inferredHeaders: ["Ready today?"]
  }
] as const;

export type ImportFieldId = (typeof importFieldDefinitions)[number]["id"];
export type ImportFieldDefinition = (typeof importFieldDefinitions)[number];
export type FieldMapping = Partial<Record<ImportFieldId, string>>;

export type WorkbookCellValue = {
  address: string;
  columnKey: string;
  rawValue: boolean | number | string | null;
  displayValue: string;
  hyperlink?: string;
  formula?: string;
  type: string;
};

export type WorkbookRow = {
  rowNumber: number;
  cells: Record<string, WorkbookCellValue>;
};

export type WorkbookSheetInspection = {
  name: string;
  detectedKind: "tracker" | "dashboard" | "unknown";
  headerRowNumber: number | null;
  columnKeys: string[];
  headers: string[];
  dataRowCount: number;
};

export type WorkbookInspection = {
  filename: string;
  checksum: string;
  sheets: WorkbookSheetInspection[];
  trackerSheetName: string | null;
  dashboardSheetName: string | null;
  trackerHeaderRowNumber: number | null;
  trackerHeaders: string[];
  inferredMapping: FieldMapping;
};

export type DuplicateMatch = {
  type: "strong" | "possible";
  reason: string;
  applicationId?: string;
};

export type TimestampPrecision = "DATE_ONLY" | "DATE_TIME";
export type ImportIssueSeverity = "warning" | "error";

export type ImportIssueCode =
  | "MISSING_COMPANY"
  | "MISSING_ROLE"
  | "MISSING_APPLICATION_DATE"
  | "UNKNOWN_STATUS"
  | "UNKNOWN_PRIORITY"
  | "INVALID_OPTIONAL_URL"
  | "INVALID_OPTIONAL_EMAIL"
  | "FORMULA_OR_DISPLAY_ONLY_VALUE"
  | "UNRECOGNIZED_DATE_FORMAT"
  | "ROW_REPRESENTS_RESEARCH_NOT_APPLICATION"
  | "ROW_REQUIRES_REVIEW"
  | "DUPLICATE_MATCH_STRONG"
  | "DUPLICATE_MATCH_POSSIBLE"
  | "DERIVED_COLUMN_CLASSIFIED"
  | "OUTREACH_WITHOUT_DATE";

export type ImportIssue = {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
};

export type RowClassification =
  | "valid"
  | "warning"
  | "invalid"
  | "duplicate"
  | "skipped_blank"
  | "skipped_informational";

export type ProposedRecordType =
  | "submitted_application"
  | "saved_opportunity"
  | "outreach_only"
  | "informational"
  | "duplicate"
  | "unusable";

export type RecommendedHandling =
  | "import_normally"
  | "import_as_incomplete_application"
  | "import_as_saved_opportunity"
  | "import_with_warning"
  | "skip_intentionally"
  | "requires_user_review";

export type NormalizedImportRow = {
  sheetName: string;
  rowNumber: number;
  identityKey: string | null;
  sourceColumns: Record<string, WorkbookCellValue>;
  authoritativeData: {
    status?: ApplicationStatus;
    rawStatus?: string;
    appliedDate?: string;
    appliedAtPrecision?: TimestampPrecision;
    companyName?: string;
    normalizedCompanyName?: string;
    role?: string;
    normalizedRole?: string;
    jobUrl?: string;
    rawJobUrl?: string;
    recruiterLinkedIn?: string;
    rawRecruiterLinkedIn?: string;
    recruiterEmail?: string;
    rawRecruiterEmail?: string;
    priority?: ApplicationPriority;
    rawPriority?: string;
    rejectionReason?: string;
    notes?: string;
    linkedinConnectionSent?: boolean;
    linkedinAccepted?: boolean;
    linkedinFollowUpRequested?: boolean;
    linkedinMessageSentDate?: string;
    linkedinMessageSentPrecision?: TimestampPrecision;
    linkedinResponse?: boolean;
    emailFollowUpRequested?: boolean;
    emailSentDate?: string;
    emailSentPrecision?: TimestampPrecision;
    emailResponse?: boolean;
    invitedToInterview?: boolean;
    firstInterviewDate?: string;
    firstInterviewPrecision?: TimestampPrecision;
    interviewStagesCompleted?: string;
  };
  derivedData: Partial<Record<ImportFieldId, string>>;
  issueGroups: ImportIssue[];
  warnings: string[];
  errors: string[];
  duplicateMatches: DuplicateMatch[];
  matchedApplicationId?: string;
  classification: RowClassification;
  proposedRecordType: ProposedRecordType;
  recommendedHandling: RecommendedHandling;
  willImport: boolean;
  previewStatus: ImportRowStatus;
};

export type ImportPreviewSummary = {
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  warningCount: number;
  errorCount: number;
  skippedCount: number;
  classificationCounts: Record<RowClassification, number>;
  proposedRecordTypeCounts: Record<ProposedRecordType, number>;
  recommendedHandlingCounts: Record<RecommendedHandling, number>;
  groupedIssueCounts: Partial<Record<ImportIssueCode, number>>;
};

export type PersistedImportJob = ImportJob & {
  rows: ImportRow[];
};

export type ImportExecutionSummary = {
  successCount: number;
  skippedCount: number;
  duplicateCount: number;
  warningCount: number;
  errorCount: number;
  applicationCount: number;
  opportunityOnlyCount: number;
  reviewCount: number;
};

export type ImportedRowArtifacts = {
  applicationId: string;
  activityTypes: ActivityType[];
  interviewStatus?: InterviewStatus;
};

export type ImportJobSummaryPayload = {
  preview: ImportPreviewSummary;
  importResult?: ImportExecutionSummary;
};
