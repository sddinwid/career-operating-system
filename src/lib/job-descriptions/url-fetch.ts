import dns from "node:dns";
import net from "node:net";
import { JSDOM } from "jsdom";
import { computeJobDescriptionChecksum } from "@/lib/job-descriptions/checksum";
import { normalizeJobDescriptionText } from "@/lib/job-descriptions/normalize";
import type {
  JobDescriptionFetchDiagnostic,
  JobDescriptionFetchResponse
} from "@/lib/job-descriptions/url-fetch-contract";

const EXTRACTOR_VERSION = "m8.4.0";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARACTERS = 150_000;
const MIN_USEFUL_TEXT_CHARACTERS = 300;
const SAFE_USER_AGENT =
  "Career-Operating-System Job Description Fetcher/1.0 (+local-first)";
const SUPPORTED_CONTENT_TYPES = new Set([
  "text/html",
  "text/plain",
  "application/xhtml+xml"
]);

export class JobDescriptionUrlFetchError extends Error {
  readonly status: number;
  readonly diagnostics: JobDescriptionFetchDiagnostic[];

  constructor(status: number, message: string, diagnostics: JobDescriptionFetchDiagnostic[] = []) {
    super(message);
    this.name = "JobDescriptionUrlFetchError";
    this.status = status;
    this.diagnostics = diagnostics;
  }
}

function createDiagnostic(
  code: string,
  message: string,
  level: JobDescriptionFetchDiagnostic["level"] = "INFO"
): JobDescriptionFetchDiagnostic {
  return { code, message, level };
}

function isUnsafeHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

function ipv4ToNumber(value: string) {
  return value.split(".").reduce((total, octet) => (total << 8) + Number(octet), 0);
}

function isIpv4Range(value: string, start: string, end: string) {
  const numeric = ipv4ToNumber(value);
  return numeric >= ipv4ToNumber(start) && numeric <= ipv4ToNumber(end);
}

function isPrivateIpAddress(address: string) {
  const type = net.isIP(address);

  if (type === 4) {
    return (
      address === "0.0.0.0" ||
      address.startsWith("127.") ||
      isIpv4Range(address, "10.0.0.0", "10.255.255.255") ||
      isIpv4Range(address, "172.16.0.0", "172.31.255.255") ||
      isIpv4Range(address, "192.168.0.0", "192.168.255.255") ||
      isIpv4Range(address, "169.254.0.0", "169.254.255.255") ||
      isIpv4Range(address, "100.64.0.0", "100.127.255.255") ||
      isIpv4Range(address, "224.0.0.0", "239.255.255.255")
    );
  }

  if (type === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("ff")
    );
  }

  return true;
}

async function assertSafeDestination(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new JobDescriptionUrlFetchError(400, "Only http and https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new JobDescriptionUrlFetchError(400, "URLs with embedded credentials are not allowed.");
  }

  if (isUnsafeHostname(url.hostname)) {
    throw new JobDescriptionUrlFetchError(
      403,
      "That destination is blocked for local safety reasons."
    );
  }

  const addresses = await dns.promises.lookup(url.hostname, { all: true });

  if (
    addresses.length === 0 ||
    addresses.some((entry: { address: string }) => isPrivateIpAddress(entry.address))
  ) {
    throw new JobDescriptionUrlFetchError(
      403,
      "That destination resolves to a blocked private or local address."
    );
  }
}

function readContentType(header: string | null) {
  return header?.split(";")[0]?.trim().toLowerCase() ?? "application/octet-stream";
}

async function readBoundedText(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      throw new JobDescriptionUrlFetchError(
        413,
        "The remote response exceeded the size limit.",
        [createDiagnostic("RESPONSE_SIZE_LIMIT_REACHED", "The remote response exceeded 3 MB.", "ERROR")]
      );
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractJobPostingJsonLd(document: Document) {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  );

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const jobPosting = values.find(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          ("@type" in value || "@graph" in value)
      ) as
        | {
            "@type"?: string | string[];
            "@graph"?: unknown[];
            description?: string;
          }
        | undefined;

      const candidates = jobPosting?.["@graph"] && Array.isArray(jobPosting["@graph"])
        ? jobPosting["@graph"]
        : values;

      for (const candidate of candidates) {
        if (
          typeof candidate === "object" &&
          candidate !== null &&
          ("@type" in candidate) &&
          (candidate as { "@type": string | string[] })["@type"]
        ) {
          const type = (candidate as { "@type": string | string[] })["@type"];
          const types = Array.isArray(type) ? type : [type];
          if (types.includes("JobPosting")) {
            return candidate as Record<string, unknown>;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractVisibleTextFromHtml(html: string) {
  const diagnostics: JobDescriptionFetchDiagnostic[] = [];
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const pageTitle = document.querySelector("title")?.textContent?.trim() || null;
  const jsonLdPosting = extractJobPostingJsonLd(document);

  for (const selector of [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
    "[role='navigation']",
    "[role='dialog']",
    "[data-cookiebanner]",
    ".cookie",
    ".cookies",
    ".modal"
  ]) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      element.remove();
    }
  }

  let extractedText = "";

  if (jsonLdPosting && typeof jsonLdPosting.description === "string") {
    extractedText = jsonLdPosting.description;
    diagnostics.push(
      createDiagnostic(
        "JSON_LD_JOB_POSTING_USED",
        "Schema.org JobPosting metadata supplied the primary description."
      )
    );
  } else {
    const candidate =
      document.querySelector("main") ??
      document.querySelector("article") ??
      document.querySelector("[class*='job']") ??
      document.querySelector("[id*='job']") ??
      document.body;
    extractedText = candidate?.textContent ?? "";
    diagnostics.push(
      createDiagnostic(
        candidate === document.body ? "FALLBACK_BODY_TEXT_USED" : "MAIN_CONTENT_USED",
        candidate === document.body
          ? "Visible body text was used because no stronger content container was found."
          : "The main visible content container was used."
      )
    );
  }

  const normalized = normalizeExtractedText(extractedText);
  const lowered = normalized.toLowerCase();

  if (lowered.includes("enable javascript")) {
    diagnostics.push(
      createDiagnostic(
        "PAGE_REQUIRES_JAVASCRIPT",
        "The fetched page appears to require JavaScript before showing the job description.",
        "WARNING"
      )
    );
  }

  if (lowered.includes("access denied")) {
    diagnostics.push(
      createDiagnostic("ACCESS_DENIED", "The remote page returned an access-denied response.", "WARNING")
    );
  }

  if (lowered.includes("captcha") || lowered.includes("verify you are human")) {
    diagnostics.push(
      createDiagnostic(
        "CAPTCHA_OR_BOT_CHALLENGE",
        "The remote page appears to require a challenge before showing content.",
        "WARNING"
      )
    );
  }

  return {
    pageTitle,
    extractedText: normalized.length > MAX_EXTRACTED_TEXT_CHARACTERS
      ? `${normalized.slice(0, MAX_EXTRACTED_TEXT_CHARACTERS)}`
      : normalized,
    diagnostics: normalized.length > MAX_EXTRACTED_TEXT_CHARACTERS
      ? diagnostics.concat(
          createDiagnostic(
            "TEXT_TRUNCATED",
            "The extracted text was truncated to the maximum preview size.",
            "WARNING"
          )
        )
      : diagnostics
  };
}

export async function fetchJobDescriptionFromUrl(
  requestedUrl: string
): Promise<JobDescriptionFetchResponse> {
  const diagnostics: JobDescriptionFetchDiagnostic[] = [];
  let currentUrl = new URL(requestedUrl);

  if (currentUrl.pathname.toLowerCase().endsWith(".pdf")) {
    throw new JobDescriptionUrlFetchError(
      415,
      "PDF URLs are not supported for automatic extraction.",
      [createDiagnostic("CONTENT_TYPE_UNSUPPORTED", "PDF URLs must be pasted manually.", "ERROR")]
    );
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeDestination(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "user-agent": SAFE_USER_AGENT,
          accept: "text/html, text/plain, application/xhtml+xml"
        },
        redirect: "manual",
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new JobDescriptionUrlFetchError(
          408,
          "The remote fetch timed out.",
          [createDiagnostic("REMOTE_TIMEOUT", "The remote fetch timed out.", "ERROR")]
        );
      }

      throw new JobDescriptionUrlFetchError(
        502,
        "The remote page could not be fetched.",
        [createDiagnostic("REMOTE_FETCH_FAILED", "The remote page could not be fetched.", "ERROR")]
      );
    }
    clearTimeout(timeout);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new JobDescriptionUrlFetchError(502, "The remote page redirected without a location.");
      }

      currentUrl = new URL(location, currentUrl);
      diagnostics.push(
        createDiagnostic("REDIRECT_FOLLOWED", `Followed redirect to ${currentUrl.href}.`)
      );
      continue;
    }

    if (!response.ok) {
      throw new JobDescriptionUrlFetchError(
        502,
        "The remote page returned an unexpected response.",
        [createDiagnostic("REMOTE_FETCH_FAILED", `Remote status ${response.status}.`, "ERROR")]
      );
    }

    const contentType = readContentType(response.headers.get("content-type"));
    if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
      throw new JobDescriptionUrlFetchError(
        415,
        "The remote content type is not supported.",
        [createDiagnostic("CONTENT_TYPE_UNSUPPORTED", `Unsupported content type: ${contentType}.`, "ERROR")]
      );
    }

    const bodyText = await readBoundedText(response);
    const extracted =
      contentType === "text/plain"
        ? {
            pageTitle: null,
            extractedText: normalizeExtractedText(bodyText),
            diagnostics
          }
        : (() => {
            const htmlExtraction = extractVisibleTextFromHtml(bodyText);
            return {
              pageTitle: htmlExtraction.pageTitle,
              extractedText: htmlExtraction.extractedText,
              diagnostics: diagnostics.concat(htmlExtraction.diagnostics)
            };
          })();

    if (extracted.extractedText.length < MIN_USEFUL_TEXT_CHARACTERS) {
      throw new JobDescriptionUrlFetchError(
        422,
        "The fetched page did not contain enough usable job-description text.",
        extracted.diagnostics.concat(
          createDiagnostic(
            "NO_JOB_CONTENT_FOUND",
            "The fetched page did not contain enough usable job-description text.",
            "ERROR"
          )
        )
      );
    }

    return {
      requestedUrl,
      finalUrl: currentUrl.href,
      status: response.status,
      contentType,
      retrievedAt: new Date().toISOString(),
      pageTitle: extracted.pageTitle,
      extractorVersion: EXTRACTOR_VERSION,
      extractionChecksum: computeJobDescriptionChecksum(
        normalizeJobDescriptionText(extracted.extractedText)
      ),
      extractedText: extracted.extractedText,
      diagnostics: extracted.diagnostics
    };
  }

  throw new JobDescriptionUrlFetchError(
    502,
    "The remote page redirected too many times.",
    [createDiagnostic("REDIRECT_LIMIT_REACHED", "The remote page redirected too many times.", "ERROR")]
  );
}
