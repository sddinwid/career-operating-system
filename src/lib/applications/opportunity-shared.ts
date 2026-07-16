import type { WorkArrangement } from "@prisma/client";

export type OpportunityChoice = {
  id: string;
  title: string;
  jobUrl: string | null;
  location: string | null;
  workArrangement: WorkArrangement | null;
  company: {
    id: string;
    normalizedName: string;
    name: string;
  };
  canonicalJobUrl?: string;
};

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function canonicalizeJobUrl(url: string | null | undefined) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = pathname === "" ? "/" : pathname;

    const sorted = [...parsed.searchParams.entries()]
      .filter(([key]) => !trackingParams.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = "";
    for (const [key, value] of sorted) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch {
    return url.trim();
  }
}
