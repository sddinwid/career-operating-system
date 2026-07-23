import dns from "node:dns";
import net from "node:net";
import { JSDOM } from "jsdom";
import { computeJobDescriptionChecksum } from "@/lib/job-descriptions/checksum";
import { normalizeJobDescriptionText } from "@/lib/job-descriptions/normalize";
import type {
  JobDescriptionFetchDiagnostic,
  JobDescriptionFetchProvenance,
  JobDescriptionFetchResponse
} from "@/lib/job-descriptions/url-fetch-contract";

const EXTRACTOR_VERSION = "m8.5.0";
const RESOLVER_VERSION = "m8.4.1";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARACTERS = 150_000;
const MIN_USEFUL_TEXT_CHARACTERS = 300;
const RENDERED_NAVIGATION_TIMEOUT_MS = 12_000;
const RENDERED_TOTAL_TIMEOUT_MS = 18_000;
const RENDERED_STABILIZATION_POLL_MS = 250;
const RENDERED_STABILIZATION_POLLS = 4;
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
const JOB_KEYWORD_PATTERN =
  /\b(job|role|responsibilit|qualif|requirement|experience|about|position|skills|what you|you will|you have|benefits)\b/i;

type ExtractionMode = "static" | "rendered";

type HtmlExtractionResult = {
  pageTitle: string | null;
  extractedText: string;
  diagnostics: JobDescriptionFetchDiagnostic[];
  provenance: JobDescriptionFetchProvenance;
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
  provenance: JobDescriptionFetchProvenance;
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

type RenderedPageSnapshot = {
  finalUrl: string;
  pageTitle: string | null;
  html: string;
};

type FetchJobDescriptionOptions = {
  allowRenderedFallback?: boolean;
  renderedPageFetcher?: (targetUrl: URL) => Promise<RenderedPageSnapshot>;
};

type EmbeddedCandidate = {
  path: string;
  score: number;
  text: string;
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

function stripHtmlToText(value: string) {
  const dom = new JSDOM(`<body>${value}</body>`);
  return normalizeExtractedText(dom.window.document.body.textContent ?? "");
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
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

async function fetchRemoteUrl(targetUrl: URL, acceptHeader: string) {
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
        [
          createDiagnostic(
            "RESPONSE_SIZE_LIMIT_REACHED",
            "The remote response exceeded 3 MB.",
            "ERROR"
          )
        ]
      );
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function extractJobPostingJsonLd(document: Document) {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];

      for (const value of values) {
        if (
          typeof value === "object" &&
          value !== null &&
          "@graph" in value &&
          Array.isArray((value as { "@graph"?: unknown[] })["@graph"])
        ) {
          values.push(...((value as { "@graph": unknown[] })["@graph"]));
        }
      }

      for (const candidate of values) {
        if (typeof candidate !== "object" || candidate === null || !("@type" in candidate)) {
          continue;
        }

        const type = (candidate as { "@type"?: string | string[] })["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("JobPosting")) {
          return candidate as Record<string, unknown>;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function readJobPostingField(value: unknown): string {
  if (typeof value === "string") {
    return stripHtmlToText(value);
  }

  if (Array.isArray(value)) {
    return normalizeExtractedText(
      value
        .map((entry) => readJobPostingField(entry))
        .filter((entry) => entry.length > 0)
        .join("\n")
    );
  }

  if (typeof value === "object" && value !== null) {
    if ("name" in value && typeof (value as { name?: unknown }).name === "string") {
      return normalizeExtractedText(String((value as { name: unknown }).name));
    }

    if ("address" in value) {
      const nestedAddress = readJobPostingField((value as { address?: unknown }).address);
      if (nestedAddress) {
        return nestedAddress;
      }
    }

    if (
      "addressLocality" in value &&
      typeof (value as { addressLocality?: unknown }).addressLocality === "string"
    ) {
      return normalizeExtractedText(String((value as { addressLocality: unknown }).addressLocality));
    }
  }

  return "";
}

function buildStructuredJobText(jobPosting: Record<string, unknown>) {
  const sections: Array<{ label: string; value: string }> = [];
  const title = readJobPostingField(jobPosting.title);
  const company = readJobPostingField(jobPosting.hiringOrganization);
  const location = readJobPostingField(jobPosting.jobLocation);
  const employmentType = readJobPostingField(jobPosting.employmentType);
  const description = readJobPostingField(jobPosting.description);
  const qualifications = readJobPostingField(jobPosting.qualifications);
  const responsibilities = readJobPostingField(jobPosting.responsibilities);
  const experience = readJobPostingField(jobPosting.experienceRequirements);
  const education = readJobPostingField(jobPosting.educationRequirements);
  const skills = readJobPostingField(jobPosting.skills);
  const salary = readJobPostingField(jobPosting.baseSalary);

  if (title) {
    sections.push({ label: "Title", value: title });
  }
  if (company) {
    sections.push({ label: "Company", value: company });
  }
  if (location) {
    sections.push({ label: "Location", value: location });
  }
  if (employmentType) {
    sections.push({ label: "Employment Type", value: employmentType });
  }
  if (description) {
    sections.push({ label: "Description", value: description });
  }
  if (responsibilities) {
    sections.push({ label: "Responsibilities", value: responsibilities });
  }
  if (qualifications) {
    sections.push({ label: "Qualifications", value: qualifications });
  }
  if (experience) {
    sections.push({ label: "Experience", value: experience });
  }
  if (education) {
    sections.push({ label: "Education", value: education });
  }
  if (skills) {
    sections.push({ label: "Skills", value: skills });
  }
  if (salary) {
    sections.push({ label: "Compensation", value: salary });
  }

  return normalizeExtractedText(
    sections.map((section) => `${section.label}\n${section.value}`).join("\n\n")
  );
}

function extractMetaDescription(document: Document) {
  const selectors = [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]'
  ];

  for (const selector of selectors) {
    const content = document.querySelector(selector)?.getAttribute("content")?.trim();
    if (content) {
      return normalizeExtractedText(content);
    }
  }

  return "";
}

function tryParseJsonValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500_000) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function extractAssignedJson(raw: string) {
  const patterns = [
    /(?:window|self)\.__[A-Z0-9_]+\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\]);?/i,
    /__NEXT_DATA__\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\]);?/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const parsed = tryParseJsonValue(match[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function scoreEmbeddedPath(path: string) {
  let score = 0;

  if (/(description|jobdescription|responsibilit|qualif|requirement|experience|skills|summary|overview|content|body)/i.test(path)) {
    score += 4;
  }
  if (/(title|company|location)/i.test(path)) {
    score += 2;
  }
  if (/(seo|navigation|footer|cookie|legal|social)/i.test(path)) {
    score -= 5;
  }

  return score;
}

function collectEmbeddedCandidates(
  value: unknown,
  path: string[],
  candidates: EmbeddedCandidate[]
) {
  if (typeof value === "string") {
    const normalized = stripHtmlToText(value);
    if (normalized.length < 18) {
      return;
    }

    const joinedPath = path.join(".");
    const score = scoreEmbeddedPath(joinedPath);
    const looksRelevant =
      score > 0 ||
      normalized.length >= MIN_USEFUL_TEXT_CHARACTERS ||
      JOB_KEYWORD_PATTERN.test(normalized);

    if (looksRelevant) {
      candidates.push({
        path: joinedPath,
        score,
        text: normalized
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectEmbeddedCandidates(entry, path.concat(String(index)), candidates);
    });
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      collectEmbeddedCandidates(child, path.concat(key), candidates);
    }
  }
}

function extractEmbeddedStateText(document: Document) {
  const parsedValues: unknown[] = [];
  const scripts = Array.from(document.querySelectorAll("script"));

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) {
      continue;
    }

    const type = script.getAttribute("type")?.toLowerCase() ?? "";
    if (type === "application/json" || script.id === "__NEXT_DATA__") {
      const parsed = tryParseJsonValue(raw);
      if (parsed !== null) {
        parsedValues.push(parsed);
      }
      continue;
    }

    const assigned = extractAssignedJson(raw);
    if (assigned !== null) {
      parsedValues.push(assigned);
    }
  }

  if (parsedValues.length === 0) {
    return "";
  }

  const candidates: EmbeddedCandidate[] = [];
  for (const value of parsedValues) {
    collectEmbeddedCandidates(value, [], candidates);
  }

  const unique = Array.from(
    new Map(
      candidates
        .sort((left, right) => right.score - left.score || right.text.length - left.text.length)
        .map((candidate) => [candidate.text.toLowerCase(), candidate])
    ).values()
  );

  return normalizeExtractedText(unique.slice(0, 24).map((candidate) => candidate.text).join("\n\n"));
}

function removeBoilerplate(document: Document) {
  for (const selector of [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
    "aside",
    "form",
    "dialog",
    "[role='navigation']",
    "[role='dialog']",
    "[role='complementary']",
    "[data-cookiebanner]",
    "[data-testid*='cookie']",
    "[class*='cookie']",
    "[class*='Cookie']",
    "[class*='modal']",
    "[class*='Modal']",
    "[class*='social']",
    "[class*='Social']",
    "[class*='share']",
    "[class*='Share']",
    "[class*='newsletter']",
    "[class*='Newsletter']"
  ]) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      element.remove();
    }
  }

  for (const element of Array.from(document.querySelectorAll("[hidden],[aria-hidden='true']"))) {
    element.remove();
  }

  for (const element of Array.from(document.querySelectorAll("[style]"))) {
    const style = (element.getAttribute("style") ?? "").toLowerCase();
    if (style.includes("display:none") || style.includes("visibility:hidden")) {
      element.remove();
    }
  }
}

function extractNodeTextWithLineBreaks(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof node.ownerDocument!.defaultView!.HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();
  if (["script", "style", "noscript"].includes(tagName)) {
    return "";
  }

  const childText = Array.from(node.childNodes)
    .map((child) => extractNodeTextWithLineBreaks(child))
    .join(tagName === "li" ? "" : " ");
  const normalizedChildText = normalizeExtractedText(childText);

  if (!normalizedChildText) {
    return "";
  }

  if (tagName === "li") {
    return `- ${normalizedChildText}\n`;
  }

  if (["p", "div", "section", "article", "main", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "br"].includes(tagName)) {
    return `${normalizedChildText}\n\n`;
  }

  return `${normalizedChildText} `;
}

function scoreDomCandidate(element: Element) {
  const text = normalizeExtractedText(extractNodeTextWithLineBreaks(element));
  const selectorFingerprint = `${element.tagName} ${element.getAttribute("id") ?? ""} ${
    element.getAttribute("class") ?? ""
  }`;
  let score = text.length;

  if (/(job|posting|description|position|opportunity)/i.test(selectorFingerprint)) {
    score += 600;
  }
  if (/(footer|header|nav|menu|social|cookie)/i.test(selectorFingerprint)) {
    score -= 1000;
  }
  if (JOB_KEYWORD_PATTERN.test(text)) {
    score += 300;
  }

  return { element, text, score };
}

function extractDomText(document: Document) {
  const candidates = [
    ...Array.from(
      document.querySelectorAll(
        [
          "main",
          "article",
          "[role='main']",
          "[data-testid*='job']",
          "[class*='job-description']",
          "[class*='jobDescription']",
          "[id*='job-description']",
          "[class*='posting']",
          "[id*='posting']",
          "[class*='description']",
          "[id*='description']"
        ].join(",")
      )
    )
  ];

  const bestCandidate =
    candidates.map((element) => scoreDomCandidate(element)).sort((left, right) => right.score - left.score)[0] ??
    scoreDomCandidate(document.body);

  return normalizeExtractedText(bestCandidate.text);
}

function addPageDiagnostics(
  text: string,
  diagnostics: JobDescriptionFetchDiagnostic[],
  mode: ExtractionMode
) {
  const lowered = text.toLowerCase();

  if (lowered.includes("enable javascript") || lowered.includes("javascript is required")) {
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

  if (mode === "rendered" && text.length > 0) {
    diagnostics.push(
      createDiagnostic(
        "RENDERED_FALLBACK_USED",
        "The rendered page fallback supplied the extracted job-description preview."
      )
    );
  }
}

function extractVisibleTextFromHtml(html: string, mode: ExtractionMode): HtmlExtractionResult {
  const diagnostics: JobDescriptionFetchDiagnostic[] = [];
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const pageTitle = document.querySelector("title")?.textContent?.trim() || null;
  const jsonLdPosting = extractJobPostingJsonLd(document);

  if (jsonLdPosting) {
    const structuredText = buildStructuredJobText(jsonLdPosting);
    if (structuredText.length >= MIN_USEFUL_TEXT_CHARACTERS) {
      diagnostics.push(
        createDiagnostic(
          mode === "rendered"
            ? "RENDERED_JSON_LD_JOB_POSTING_USED"
            : "JSON_LD_JOB_POSTING_USED",
          "Schema.org JobPosting metadata supplied the primary description."
        )
      );
      addPageDiagnostics(structuredText, diagnostics, mode);
      const truncated = truncateExtractedText(structuredText, diagnostics);
      return {
        pageTitle,
        extractedText: truncated.extractedText,
        diagnostics: truncated.diagnostics,
        provenance:
          mode === "rendered" ? "RENDERED_STRUCTURED_DATA" : "STATIC_STRUCTURED_DATA"
      };
    }
  }

  const embeddedStateText = extractEmbeddedStateText(document);
  if (embeddedStateText.length >= MIN_USEFUL_TEXT_CHARACTERS) {
    diagnostics.push(
      createDiagnostic(
        "EMBEDDED_STATE_USED",
        "Embedded serialized state supplied the primary description."
      )
    );
    addPageDiagnostics(embeddedStateText, diagnostics, mode);
    const truncated = truncateExtractedText(embeddedStateText, diagnostics);
    return {
      pageTitle,
      extractedText: truncated.extractedText,
      diagnostics: truncated.diagnostics,
      provenance: "EMBEDDED_STATE"
    };
  }

  removeBoilerplate(document);
  const domText = extractDomText(document);
  const metaDescription = extractMetaDescription(document);
  const extractedText = domText.length >= metaDescription.length ? domText : metaDescription;

  diagnostics.push(
    createDiagnostic(
      extractedText === metaDescription && metaDescription.length > 0
        ? "META_DESCRIPTION_USED"
        : mode === "rendered"
          ? "RENDERED_DOM_USED"
          : "MAIN_CONTENT_USED",
      extractedText === metaDescription && metaDescription.length > 0
        ? "Metadata supplied the primary description because no stronger container was found."
        : "The visible content container supplied the primary description."
    )
  );
  addPageDiagnostics(extractedText, diagnostics, mode);

  const truncated = truncateExtractedText(extractedText, diagnostics);
  return {
    pageTitle,
    extractedText: truncated.extractedText,
    diagnostics: truncated.diagnostics,
    provenance: mode === "rendered" ? "RENDERED_DOM" : "STATIC_DOM"
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
      [
        createDiagnostic(
          "CONTENT_TYPE_UNSUPPORTED",
          `Unsupported content type: ${contentType}.`,
          "ERROR"
        )
      ]
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

function resolveAshbyJobPosting(boardResponse: AshbyBoardResponse, jobPostingId: string) {
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
        ? extractVisibleTextFromHtml(posting.descriptionHtml, "static").extractedText
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
    diagnostics: normalizedPosting.diagnostics,
    provenance: "EMBEDDED_STATE"
  };
}

function isFallbackEligible(extraction: HtmlExtractionResult) {
  const codes = new Set(extraction.diagnostics.map((diagnostic) => diagnostic.code));

  if (codes.has("ACCESS_DENIED") || codes.has("CAPTCHA_OR_BOT_CHALLENGE")) {
    return false;
  }

  return (
    extraction.extractedText.length < MIN_USEFUL_TEXT_CHARACTERS ||
    codes.has("PAGE_REQUIRES_JAVASCRIPT")
  );
}

async function stabilizeRenderedPage(page: {
  evaluate: <T>(pageFunction: () => T | Promise<T>) => Promise<T>;
  waitForTimeout: (timeout: number) => Promise<void>;
}) {
  let previousLength = -1;

  for (let attempt = 0; attempt < RENDERED_STABILIZATION_POLLS; attempt += 1) {
    const currentLength = await page.evaluate(
      () => document.body?.innerText.replace(/\s+/g, " ").trim().length ?? 0
    );

    if (currentLength > 0 && Math.abs(currentLength - previousLength) <= 40) {
      return;
    }

    previousLength = currentLength;
    await page.waitForTimeout(RENDERED_STABILIZATION_POLL_MS);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorFactory: () => Error) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(errorFactory()), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function fetchRenderedPage(targetUrl: URL): Promise<RenderedPageSnapshot> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true
  });

  try {
    return await withTimeout(
      (async () => {
        const context = await browser.newContext({
          acceptDownloads: false,
          colorScheme: "light",
          geolocation: undefined,
          ignoreHTTPSErrors: false,
          javaScriptEnabled: true,
          permissions: [],
          serviceWorkers: "block",
          userAgent: SAFE_USER_AGENT
        });

        try {
          const page = await context.newPage();
          const popupPages = new Set<string>();
          context.on("page", async (popupPage) => {
            if (popupPage !== page) {
              popupPages.add(popupPage.url());
              await popupPage.close().catch(() => undefined);
            }
          });

          await page.route("**/*", async (route) => {
            const request = route.request();
            const requestUrl = new URL(request.url());
            await assertSafeDestination(requestUrl);

            if (["image", "media", "font"].includes(request.resourceType())) {
              await route.abort();
              return;
            }

            await route.continue();
          });

          const response = await page.goto(targetUrl.href, {
            waitUntil: "domcontentloaded",
            timeout: RENDERED_NAVIGATION_TIMEOUT_MS
          });

          if (!response) {
            throw new JobDescriptionUrlFetchError(
              502,
              "The remote page could not be fetched.",
              [createDiagnostic("REMOTE_FETCH_FAILED", "The remote page returned no response.", "ERROR")]
            );
          }

          await assertSafeDestination(new URL(page.url()));
          await stabilizeRenderedPage(page);

          return {
            finalUrl: page.url(),
            pageTitle: (await page.title()) || null,
            html: await page.content()
          };
        } finally {
          await context.close();
        }
      })(),
      RENDERED_TOTAL_TIMEOUT_MS,
      () =>
        new JobDescriptionUrlFetchError(408, "The rendered page timed out.", [
          createDiagnostic("RENDERED_TIMEOUT", "The rendered page timed out.", "ERROR")
        ])
    );
  } finally {
    await browser.close();
  }
}

function buildSuccessResponse(args: {
  requestedUrl: string;
  finalUrl: string;
  resolvedUrl: string | null;
  status: number;
  contentType: string;
  pageTitle: string | null;
  extractedText: string;
  diagnostics: JobDescriptionFetchDiagnostic[];
  provenance: JobDescriptionFetchProvenance;
  resolverVersion?: string | null;
}) {
  return {
    requestedUrl: args.requestedUrl,
    finalUrl: args.finalUrl,
    resolvedUrl: args.resolvedUrl,
    status: args.status,
    contentType: args.contentType,
    retrievedAt: new Date().toISOString(),
    pageTitle: args.pageTitle,
    extractorVersion: EXTRACTOR_VERSION,
    resolverVersion: args.resolverVersion ?? null,
    provenance: args.provenance,
    extractionChecksum: computeJobDescriptionChecksum(
      normalizeJobDescriptionText(args.extractedText)
    ),
    extractedText: args.extractedText,
    diagnostics: args.diagnostics
  } satisfies JobDescriptionFetchResponse;
}

export async function fetchJobDescriptionFromUrl(
  requestedUrl: string,
  options: FetchJobDescriptionOptions = {}
): Promise<JobDescriptionFetchResponse> {
  const diagnostics: JobDescriptionFetchDiagnostic[] = [];
  let currentUrl = new URL(requestedUrl);
  const allowRenderedFallback = options.allowRenderedFallback ?? true;
  const renderedPageFetcher = options.renderedPageFetcher ?? fetchRenderedPage;

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
        [
          createDiagnostic(
            "CONTENT_TYPE_UNSUPPORTED",
            `Unsupported content type: ${contentType}.`,
            "ERROR"
          )
        ]
      );
    }

    const bodyText = await readBoundedText(response);

    if (contentType === "text/plain") {
      const extractedText = normalizeExtractedText(bodyText);
      if (extractedText.length < MIN_USEFUL_TEXT_CHARACTERS) {
        throw new JobDescriptionUrlFetchError(
          422,
          "The fetched page did not contain enough usable job-description text.",
          diagnostics.concat(
            createDiagnostic(
              "NO_JOB_CONTENT_FOUND",
              "The fetched page did not contain enough usable job-description text.",
              "ERROR"
            )
          )
        );
      }

      return buildSuccessResponse({
        requestedUrl,
        finalUrl: currentUrl.href,
        resolvedUrl: null,
        status: response.status,
        contentType,
        pageTitle: null,
        extractedText,
        diagnostics,
        provenance: "STATIC_DOM"
      });
    }

    const htmlExtraction = extractVisibleTextFromHtml(bodyText, "static");
    const ashbyResolution = await maybeResolveAshbyEmbeddedJob({
      requestedUrl,
      fetchedUrl: currentUrl,
      html: bodyText,
      extraction: htmlExtraction
    });

    if (ashbyResolution) {
      return buildSuccessResponse({
        requestedUrl: ashbyResolution.requestedUrl,
        finalUrl: ashbyResolution.finalUrl,
        resolvedUrl: ashbyResolution.resolvedUrl,
        status: ashbyResolution.status,
        contentType: ashbyResolution.contentType,
        pageTitle: ashbyResolution.pageTitle,
        extractedText: ashbyResolution.extractedText,
        diagnostics: ashbyResolution.diagnostics,
        provenance: ashbyResolution.provenance,
        resolverVersion: RESOLVER_VERSION
      });
    }

    const staticDiagnostics = diagnostics.concat(htmlExtraction.diagnostics);
    if (htmlExtraction.extractedText.length >= MIN_USEFUL_TEXT_CHARACTERS && !isFallbackEligible(htmlExtraction)) {
      return buildSuccessResponse({
        requestedUrl,
        finalUrl: currentUrl.href,
        resolvedUrl: null,
        status: response.status,
        contentType,
        pageTitle: htmlExtraction.pageTitle,
        extractedText: htmlExtraction.extractedText,
        diagnostics: staticDiagnostics,
        provenance: htmlExtraction.provenance
      });
    }

    if (!isFallbackEligible(htmlExtraction)) {
      throw new JobDescriptionUrlFetchError(
        422,
        "The fetched page did not contain enough usable job-description text.",
        staticDiagnostics.concat(
          createDiagnostic(
            "NO_JOB_CONTENT_FOUND",
            "The fetched page did not contain enough usable job-description text.",
            "ERROR"
          )
        )
      );
    }

    if (!allowRenderedFallback) {
      throw new JobDescriptionUrlFetchError(
        409,
        "The initial page did not include the job description. Trying the rendered page...",
        staticDiagnostics.concat(
          createDiagnostic(
            "RENDERED_FALLBACK_RECOMMENDED",
            "The initial page did not include the job description. Trying the rendered page..."
          )
        )
      );
    }

    const renderedSnapshot = await renderedPageFetcher(currentUrl);
    const renderedExtraction = extractVisibleTextFromHtml(renderedSnapshot.html, "rendered");
    const renderedDiagnostics = staticDiagnostics.concat(renderedExtraction.diagnostics);

    if (renderedExtraction.extractedText.length < MIN_USEFUL_TEXT_CHARACTERS) {
      throw new JobDescriptionUrlFetchError(
        422,
        "We could not extract usable job-description text from this site. Paste the description below to continue.",
        renderedDiagnostics.concat(
          createDiagnostic(
            "NO_JOB_CONTENT_FOUND",
            "We could not extract usable job-description text from this site.",
            "ERROR"
          )
        )
      );
    }

    return buildSuccessResponse({
      requestedUrl,
      finalUrl: renderedSnapshot.finalUrl,
      resolvedUrl: null,
      status: response.status,
      contentType,
      pageTitle: renderedSnapshot.pageTitle ?? renderedExtraction.pageTitle,
      extractedText: renderedExtraction.extractedText,
      diagnostics: renderedDiagnostics,
      provenance: renderedExtraction.provenance
    });
  }

  throw new JobDescriptionUrlFetchError(
    502,
    "The remote page redirected too many times.",
    [createDiagnostic("REDIRECT_LIMIT_REACHED", "The remote page redirected too many times.", "ERROR")]
  );
}
