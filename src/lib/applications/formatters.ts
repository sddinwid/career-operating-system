import type { WorkArrangement } from "@prisma/client";

function mapWorkArrangementLabel(value: WorkArrangement) {
  switch (value) {
    case "ONSITE":
      return "On-site";
    case "HYBRID":
      return "Hybrid";
    case "REMOTE":
      return "Remote";
    case "FLEXIBLE":
      return "Flexible";
    default:
      return value;
  }
}

export function formatApplicationDate(value: Date | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export function formatApplicationDateTime(
  value: Date | null | undefined,
  timeZone = "America/Chicago"
) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export function formatSalaryRange(
  min: number | string | { toString(): string } | null | undefined,
  max: number | string | { toString(): string } | null | undefined,
  currency: string | null | undefined
) {
  if (min == null && max == null) {
    return "Not set";
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0
  });

  const minValue = min != null ? Number(min) : undefined;
  const maxValue = max != null ? Number(max) : undefined;

  if (minValue != null && maxValue != null) {
    return `${formatter.format(minValue)} - ${formatter.format(maxValue)}`;
  }

  if (minValue != null) {
    return `From ${formatter.format(minValue)}`;
  }

  return `Up to ${formatter.format(maxValue ?? 0)}`;
}

export function formatWorkArrangement(value: WorkArrangement | null | undefined) {
  return value ? mapWorkArrangementLabel(value) : "Not set";
}
