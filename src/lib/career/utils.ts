import { createHash } from "node:crypto";

export function computeSha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ensureString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function ensureStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function ensureObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeDateString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}$/.test(trimmed)) {
    return {
      raw: trimmed,
      normalized: trimmed,
      precision: "YEAR" as const
    };
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return {
      raw: trimmed,
      normalized: trimmed,
      precision: "MONTH" as const
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      raw: trimmed,
      normalized: trimmed,
      precision: "DATE" as const
    };
  }

  return {
    raw: trimmed,
    normalized: trimmed,
    precision: "UNKNOWN" as const
  };
}

export function normalizeUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
