export const applicationStatusOptions = [
  "DRAFT",
  "APPLIED",
  "IN_PROGRESS",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED"
] as const;

export const applicationPriorityOptions = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT"
] as const;

export const workArrangementOptions = [
  "ONSITE",
  "HYBRID",
  "REMOTE",
  "FLEXIBLE"
] as const;

export const defaultTimeZoneLabel = "America/Chicago";
