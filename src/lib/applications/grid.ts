import type {
  Activity,
  Application,
  ApplicationPriority,
  ApplicationStatus,
  Company,
  JobOpportunity,
  WorkArrangement
} from "@prisma/client";
import type { EditableApplicationGridField } from "@/lib/applications/grid-schemas";
import { formatDateInput, formatDateTimeLocalInput } from "@/lib/applications/timestamps";
import type { AppSettings } from "@/lib/settings";

export type ApplicationGridPrecision = "DATE_ONLY" | "DATE_TIME";

export type ApplicationGridRow = {
  id: string;
  status: ApplicationStatus;
  company: string;
  role: string;
  location: string | null;
  workArrangement: WorkArrangement | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryInput: string;
  appliedAt: string | null;
  appliedAtInput: string;
  appliedAtPrecision: ApplicationGridPrecision;
  jobSearchDate: string | null;
  jobSearchDateInput: string;
  priority: ApplicationPriority | null;
  source: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationGridSource = Application & {
  opportunity: JobOpportunity & {
    company: Company;
  };
  activities?: Array<Pick<Activity, "metadata">>;
};

export type { EditableApplicationGridField } from "@/lib/applications/grid-schemas";

export type ApplicationGridMutationResult =
  | {
      ok: true;
      row: ApplicationGridRow;
      message: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

function formatSalaryInput(args: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}) {
  const currency = args.salaryCurrency?.trim() || "";

  if (args.salaryMin != null && args.salaryMax != null) {
    return `${args.salaryMin}-${args.salaryMax}${currency ? ` ${currency}` : ""}`;
  }

  if (args.salaryMin != null) {
    return `${args.salaryMin}${currency ? ` ${currency}` : ""}`;
  }

  if (args.salaryMax != null) {
    return `up to ${args.salaryMax}${currency ? ` ${currency}` : ""}`;
  }

  return "";
}

function readPrecisionFromMetadata(metadata: unknown) {
  if (
    metadata &&
    typeof metadata === "object" &&
    "precision" in metadata &&
    (metadata as { precision?: unknown }).precision === "DATE_ONLY"
  ) {
    return "DATE_ONLY" as const;
  }

  return "DATE_TIME" as const;
}

function resolveAppliedAtPrecision(
  application: ApplicationGridSource,
  settings: AppSettings
): ApplicationGridPrecision {
  if (!application.appliedAt) {
    return "DATE_TIME";
  }

  const metadataPrecision = readPrecisionFromMetadata(
    application.activities?.[0]?.metadata
  );

  if (metadataPrecision !== "DATE_ONLY") {
    return "DATE_TIME";
  }

  return formatDateTimeLocalInput(
    application.appliedAt,
    settings.defaultTimeZone
  ).endsWith("12:00")
    ? "DATE_ONLY"
    : "DATE_TIME";
}

export function buildApplicationGridRow(
  application: ApplicationGridSource,
  settings: AppSettings
): ApplicationGridRow {
  const appliedAtPrecision = resolveAppliedAtPrecision(application, settings);
  const appliedAtInput = application.appliedAt
    ? appliedAtPrecision === "DATE_ONLY"
      ? formatDateTimeLocalInput(
          application.appliedAt,
          settings.defaultTimeZone
        ).split("T")[0]
      : formatDateTimeLocalInput(application.appliedAt, settings.defaultTimeZone)
    : "";

  return {
    id: application.id,
    status: application.status,
    company: application.opportunity.company.name,
    role: application.opportunity.title,
    location: application.opportunity.location,
    workArrangement: application.opportunity.workArrangement,
    salaryMin:
      application.opportunity.salaryMin != null
        ? Number(application.opportunity.salaryMin)
        : null,
    salaryMax:
      application.opportunity.salaryMax != null
        ? Number(application.opportunity.salaryMax)
        : null,
    salaryCurrency: application.opportunity.salaryCurrency,
    salaryInput: formatSalaryInput({
      salaryMin:
        application.opportunity.salaryMin != null
          ? Number(application.opportunity.salaryMin)
          : null,
      salaryMax:
        application.opportunity.salaryMax != null
          ? Number(application.opportunity.salaryMax)
          : null,
      salaryCurrency: application.opportunity.salaryCurrency
    }),
    appliedAt: application.appliedAt?.toISOString() ?? null,
    appliedAtInput,
    appliedAtPrecision,
    jobSearchDate: application.jobSearchDate?.toISOString() ?? null,
    jobSearchDateInput: application.jobSearchDate
      ? formatDateInput(application.jobSearchDate)
      : "",
    priority: application.priority,
    source: application.opportunity.source,
    archived: application.archivedAt !== null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString()
  };
}
