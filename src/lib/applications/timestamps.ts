import { AppSettings } from "@/lib/settings";

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type ApplicationTimingInput = {
  appliedAtLocal: string;
  manualJobSearchDate?: string;
};

export class ApplicationTimingValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ApplicationTimingValidationError";
    this.fieldErrors = {
      [field]: [message]
    };
  }
}

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseCutoffMinutes(cutoff: string) {
  const [hours, minutes] = cutoff.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseLocalDateTime(value: string): LocalDateTimeParts {
  if (!localDateTimePattern.test(value)) {
    throw new ApplicationTimingValidationError(
      "appliedAtLocal",
      "Enter a valid local application date and time."
    );
  }

  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second: 0
  };
}

function parseLocalDate(value: string): LocalDateParts {
  if (!localDatePattern.test(value)) {
    throw new ApplicationTimingValidationError(
      "manualJobSearchDate",
      "Enter a valid job-search date override."
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getLocalPartsForInstant(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

export function localDateTimeToUtc(parts: LocalDateTimeParts, timeZone: string) {
  let guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  for (let index = 0; index < 3; index += 1) {
    const actualLocalParts = getLocalPartsForInstant(new Date(guess), timeZone);
    const desiredUtcEquivalent = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const actualUtcEquivalent = Date.UTC(
      actualLocalParts.year,
      actualLocalParts.month - 1,
      actualLocalParts.day,
      actualLocalParts.hour,
      actualLocalParts.minute,
      actualLocalParts.second
    );

    const difference = desiredUtcEquivalent - actualUtcEquivalent;
    guess += difference;
  }

  return new Date(guess);
}

export function localDateToUtcDate(parts: LocalDateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function resolveLocalDateAtTime(
  localDate: string,
  timeZone: string,
  time = "00:00"
) {
  const [hour, minute] = time.split(":").map(Number);
  const dateParts = parseLocalDate(localDate);

  return localDateTimeToUtc(
    {
      ...dateParts,
      hour,
      minute,
      second: 0
    },
    timeZone
  );
}

export function resolveLocalDateAtNoon(localDate: string, timeZone: string) {
  return resolveLocalDateAtTime(localDate, timeZone, "12:00");
}

function shiftLocalDate(parts: LocalDateParts, dayOffset: number): LocalDateParts {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate()
  };
}

function deriveJobSearchLocalDate(
  localParts: LocalDateTimeParts,
  cutoff: string
): LocalDateParts {
  const cutoffMinutes = parseCutoffMinutes(cutoff);
  const localMinutes = localParts.hour * 60 + localParts.minute;
  const sameDay = {
    year: localParts.year,
    month: localParts.month,
    day: localParts.day
  };

  if (localMinutes < cutoffMinutes) {
    return shiftLocalDate(sameDay, -1);
  }

  return sameDay;
}

export function deriveJobSearchDateFromInstant(
  instant: Date,
  settings: AppSettings
) {
  const localParts = getLocalPartsForInstant(instant, settings.defaultTimeZone);
  return localDateToUtcDate(
    deriveJobSearchLocalDate(localParts, settings.jobSearchDayCutoff)
  );
}

export function resolveApplicationTiming(
  input: ApplicationTimingInput,
  settings: AppSettings,
  now: Date = new Date()
) {
  const localParts = parseLocalDateTime(input.appliedAtLocal);
  const appliedAt = localDateTimeToUtc(localParts, settings.defaultTimeZone);

  if (appliedAt.getTime() > now.getTime()) {
    throw new ApplicationTimingValidationError(
      "appliedAtLocal",
      "Application date and time cannot be in the future."
    );
  }

  const computedJobSearchDate = localDateToUtcDate(
    deriveJobSearchLocalDate(localParts, settings.jobSearchDayCutoff)
  );
  const manualJobSearchDate = input.manualJobSearchDate
    ? localDateToUtcDate(parseLocalDate(input.manualJobSearchDate))
    : undefined;

  return {
    appliedAt,
    originalAppliedAt: appliedAt,
    recordedAt: now,
    jobSearchDate: manualJobSearchDate ?? computedJobSearchDate,
    manualJobSearchDate,
    timeZone: settings.defaultTimeZone
  };
}

export function formatDateTimeLocalInput(date: Date, timeZone: string) {
  const parts = getLocalPartsForInstant(date, timeZone);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function detectManualJobSearchDateOverride(args: {
  appliedAt: Date | null;
  jobSearchDate: Date | null;
  settings: AppSettings;
}) {
  if (!args.appliedAt || !args.jobSearchDate) {
    return undefined;
  }

  const derived = deriveJobSearchDateFromInstant(args.appliedAt, args.settings);
  return derived.toISOString() === args.jobSearchDate.toISOString()
    ? undefined
    : formatDateInput(args.jobSearchDate);
}
