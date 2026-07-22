import dns from "node:dns";
import net from "node:net";
import { JSDOM } from "jsdom";
import { computeJobDescriptionChecksum } from "@/lib/job-descriptions/checksum";
import { normalizeJobDescriptionText } from "@/lib/job-descriptions/normalize";
import type {
  JobDescriptionFetchDiagnostic,
  JobDescriptionFetchResponse
} from "@/lib/job-descriptions/url-fetch-contract";

const EXTRACTOR_VERSION = "m8.4.1";
const RESOLVER_VERSION = "m8.4.1";
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
const ASHBY_PUBLIC_API_HOSTNAME = "api.ashbyhq.com";
const ASHBY_PUBLIC_BOARD_PATH_PREFIX = "/posting-api/job-board/";
const ASHBY_HOSTNAME = "jobs.ashbyhq.com";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HtmlExtractionResult = {
  pageTitle: string | null;
  extractedText: string;
  diagnostics: JobDescriptionFetchDiagnostic[];
};

type ResolvedAshbyPosting = {
  requestedUrl: string;
  finalUrl: string;
  resolvedUrl: string;
  status: number;
  contentType: string;
  pageTitle: string;
  extractedText: string;
  diagnostics: JobDescriptionFetchDiagnostic[];
};

type AshbyPublicJobPosting = {
  id?: string;
  title?: string;
  jobUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
};

type AshbyBoardResponse = {
  jobs?: AshbyPublicJobPosting[];
};

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

async function fetchRemoteUrl(
  targetUrl: URL,
  acceptHeader: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(targetUrl, {
      method: "GET",
      headers: {
        "user-agent": SAFE_USER_AGENT,
        accept: acceptHeader
      },
      redirect: "manual",
      signal: controller.signal
    });
  } catch (error) {
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
  } finally {
    clearTimeout(timeout);
  }
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

function truncateExtractedText(
  extractedText: string,
  diagnostics: JobDescriptionFetchDiagnostic[]
) {
  if (extractedText.length <= MAX_EXTRACTED_TEXT_CHARACTERS) {
    return {
      extractedText,
      diagnostics
    };
  }

  return {
    extractedText: extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARACTERS),
    diagnostics: diagnostics.concat(
      createDiagnostic(
        "TEXT_TRUNCATED",
        "The extracted text was truncated to the maximum preview size.",
        "WARNING"
      )
    )
  };
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

  const truncated = truncateExtractedText(normalized, diagnostics);

  return {
    pageTitle,
    extractedText: truncated.extractedText,
    diagnostics: truncated.diagnostics
  };
}

function extractAshbyJobPostingId(url: URL) {
  const queryId = url.searchParams.get("ashby_jid")?.trim();
  if (queryId && UUID_PATTERN.test(queryId)) {
    return queryId;
  }

  if (url.hostname !== ASHBY_HOSTNAME) {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const candidate = pathSegments.at(-1) ?? null;
  if (candidate && UUID_PATTERN.test(candidate)) {
    return candidate;
  }

  return null;
}

function discoverAshbyBaseJobBoardUrl(html: string) {
  const baseJobBoardMatch = html.match(
    /window\.__ashbyBaseJobBoardUrl\s*=\s*["']([^"']+)["']/i
  );
  if (baseJobBoardMatch?.[1]) {
    return baseJobBoardMatch[1];
  }

  const embedScriptMatch = html.match(
    /<script[^>]+src=["'](https:\/\/jobs\.ashbyhq\.com\/[^"'?#]+)\/embed["']/i
  );
  if (embedScriptMatch?.[1]) {
    return embedScriptMatch[1];
  }

  return null;
}

function buildAshbyBoardApiUrl(baseJobBoardUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseJobBoardUrl);
  } catch {
    return null;
  }

  if (parsed.hostname !== ASHBY_HOSTNAME) {
    return null;
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const jobBoardName = pathSegments.at(0) ?? null;
  if (!jobBoardName) {
    return null;
  }

  return new URL(
    `${ASHBY_PUBLIC_BOARD_PATH_PREFIX}${encodeURIComponent(jobBoardName)}?includeCompensation=true`,
    `https://${ASHBY_PUBLIC_API_HOSTNAME}`
  );
}

async function fetchAshbyBoardResponse(boardApiUrl: URL) {
  await assertSafeDestination(boardApiUrl);

  const response = await fetchRemoteUrl(boardApiUrl, "application/json");
  if (!response.ok) {
    throw new JobDescriptionUrlFetchError(
      502,
      "The remote page returned an unexpected response.",
      [createDiagnostic("REMOTE_FETCH_FAILED", `Remote status ${response.status}.`, "ERROR")]
    );
  }

  const contentType = readContentType(response.headers.get("content-type"));
  if (contentType !== "application/json") {
    throw new JobDescriptionUrlFetchError(
      415,
      "The remote content type is not supported.",
      [createDiagnostic("CONTENT_TYPE_UNSUPPORTED", `Unsupported content type: ${contentType}.`, "ERROR")]
    );
  }

  const rawBody = await readBoundedText(response);
  try {
    return JSON.parse(rawBody) as AshbyBoardResponse;
  } catch {
    throw new JobDescriptionUrlFetchError(
      502,
      "The remote page could not be fetched.",
      [createDiagnostic("REMOTE_FETCH_FAILED", "The remote page returned invalid JSON.", "ERROR")]
    );
  }
}

function resolveAshbyJobPosting(
  boardResponse: AshbyBoardResponse,
  jobPostingId: string
) {
  const jobs = Array.isArray(boardResponse.jobs) ? boardResponse.jobs : [];
  return (
    jobs.find((job) => typeof job.id === "string" && job.id === jobPostingId) ??
    jobs.find((job) => {
      const jobUrl = job.jobUrl?.trim();
      if (!jobUrl) {
        return false;
      }

      try {
        const parsed = new URL(jobUrl);
        return extractAshbyJobPostingId(parsed) === jobPostingId;
      } catch {
        return false;
      }
    }) ??
    null
  );
}

function normalizeAshbyResolvedPosting(
  posting: AshbyPublicJobPosting,
  fallbackTitle: string | null,
  diagnostics: JobDescriptionFetchDiagnostic[]
) {
  const primaryText =
    typeof posting.descriptionPlain === "string" && posting.descriptionPlain.trim().length > 0
      ? posting.descriptionPlain
      : typeof posting.descriptionHtml === "string" && posting.descriptionHtml.trim().length > 0
        ? extractVisibleTextFromHtml(posting.descriptionHtml).extractedText
        : "";

  const normalizedText = normalizeExtractedText(primaryText);
  const truncated = truncateExtractedText(normalizedText, diagnostics);

  return {
    pageTitle:
      (typeof posting.title === "string" && posting.title.trim().length > 0
        ? posting.title.trim()
        : fallbackTitle) ?? "Job posting",
    extractedText: truncated.extractedText,
    diagnostics: truncated.diagnostics
  };
}

function looksLikeGenericAshbyLandingPage(url: URL, extraction: HtmlExtractionResult) {
  if (!extractAshbyJobPostingId(url)) {
    return false;
  }

  return /careers/i.test(extraction.pageTitle ?? "");
}

async function maybeResolveAshbyEmbeddedJob(args: {
  requestedUrl: string;
  fetchedUrl: URL;
  html: string;
  extraction: HtmlExtractionResult;
}): Promise<ResolvedAshbyPosting | null> {
  const ashbyJobPostingId = extractAshbyJobPostingId(args.fetchedUrl);
  if (!ashbyJobPostingId) {
    return null;
  }

  const baseJobBoardUrl = discoverAshbyBaseJobBoardUrl(args.html);
  if (!baseJobBoardUrl) {
    return null;
  }

  const boardApiUrl = buildAshbyBoardApiUrl(baseJobBoardUrl);
  const resolutionDiagnostics: JobDescriptionFetchDiagnostic[] = [
    createDiagnostic(
      "ASHBY_JOB_POSTING_ID_DETECTED",
      `Detected embedded Ashby job posting id ${ashbyJobPostingId}.`
    ),
    createDiagnostic(
      "ASHBY_JOB_BOARD_DISCOVERED",
      `Discovered Ashby job board ${baseJobBoardUrl}.`
    )
  ];

  if (!boardApiUrl) {
    if (looksLikeGenericAshbyLandingPage(args.fetchedUrl, args.extraction)) {
      throw new JobDescriptionUrlFetchError(
        422,
        "The fetched page did not contain enough usable job-description text.",
        args.extraction.diagnostics.concat(
          resolutionDiagnostics,
          createDiagnostic(
            "GENERIC_CAREERS_PAGE_DETECTED",
            "The fetched page appears to be a generic careers landing page rather than the requested embedded job posting.",
            "ERROR"
          ),
          createDiagnostic(
            "NO_JOB_CONTENT_FOUND",
            "The fetched page did not contain enough usable job-description text.",
            "ERROR"
          )
        )
      );
    }

    return null;
  }

  resolutionDiagnostics.push(
    createDiagnostic(
      "ASHBY_PUBLIC_API_REQUESTED",
      `Requested Ashby's public job board API at ${boardApiUrl.href}.`
    )
  );

  const boardResponse = await fetchAshbyBoardResponse(boardApiUrl);
  const matchedPosting = resolveAshbyJobPosting(boardResponse, ashbyJobPostingId);

  if (!matchedPosting) {
    throw new JobDescriptionUrlFetchError(
      422,
      "The fetched page did not contain enough usable job-description text.",
      args.extraction.diagnostics.concat(
        resolutionDiagnostics,
        createDiagnostic(
          "ASHBY_JOB_POSTING_NOT_FOUND",
          `Ashby's public job board did not contain posting ${ashbyJobPostingId}.`,
          "ERROR"
        ),
        createDiagnostic(
          "GENERIC_CAREERS_PAGE_DETECTED",
          "The fetched page appears to be a generic careers landing page rather than the requested embedded job posting.",
          "ERROR"
        ),
        createDiagnostic(
          "NO_JOB_CONTENT_FOUND",
          "The fetched page did not contain enough usable job-description text.",
          "ERROR"
        )
      )
    );
  }

  const normalizedPosting = normalizeAshbyResolvedPosting(
    matchedPosting,
    args.extraction.pageTitle,
    args.extraction.diagnostics.concat(
      resolutionDiagnostics,
      createDiagnostic(
        "ASHBY_JOB_POSTING_RESOLVED",
        `Resolved embedded Ashby job posting to ${matchedPosting.jobUrl ?? "the hosted job page"}.`
      )
    )
  );

  return {
    requestedUrl: args.requestedUrl,
    finalUrl: args.fetchedUrl.href,
    resolvedUrl: matchedPosting.jobUrl ?? args.fetchedUrl.href,
    status: 200,
    contentType: "application/json",
    pageTitle: normalizedPosting.pageTitle,
    extractedText: normalizedPosting.extractedText,
    diagnostics: normalizedPosting.diagnostics
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
    const response = await fetchRemoteUrl(
      currentUrl,
      "text/html, text/plain, application/xhtml+xml"
    );

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
            const ashbyResolution = maybeResolveAshbyEmbeddedJob({
              requestedUrl,
              fetchedUrl: currentUrl,
              html: bodyText,
              extraction: htmlExtraction
            });
            return {
              ashbyResolution,
              pageTitle: htmlExtraction.pageTitle,
              extractedText: htmlExtraction.extractedText,
              diagnostics: diagnostics.concat(htmlExtraction.diagnostics)
            };
          })();

    if ("ashbyResolution" in extracted) {
      const resolvedPosting = await extracted.ashbyResolution;
      if (resolvedPosting) {
        return {
          requestedUrl: resolvedPosting.requestedUrl,
          finalUrl: resolvedPosting.finalUrl,
          resolvedUrl: resolvedPosting.resolvedUrl,
          status: resolvedPosting.status,
          contentType: resolvedPosting.contentType,
          retrievedAt: new Date().toISOString(),
          pageTitle: resolvedPosting.pageTitle,
          extractorVersion: EXTRACTOR_VERSION,
          resolverVersion: RESOLVER_VERSION,
          extractionChecksum: computeJobDescriptionChecksum(
            normalizeJobDescriptionText(resolvedPosting.extractedText)
          ),
          extractedText: resolvedPosting.extractedText,
          diagnostics: resolvedPosting.diagnostics
        };
      }
    }

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
      resolvedUrl: null,
      status: response.status,
      contentType,
      retrievedAt: new Date().toISOString(),
      pageTitle: extracted.pageTitle,
      extractorVersion: EXTRACTOR_VERSION,
      resolverVersion: null,
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
