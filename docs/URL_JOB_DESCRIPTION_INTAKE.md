# URL Job Description Intake

Date: July 23, 2026

`M8.4` adds server-side public URL retrieval as an alternate job-description intake mode. It supplements pasted text and still reuses the existing immutable `JobDescriptionVersion` save path.

## Flow

```text
URL entered in browser
  -> POST /api/job-descriptions/fetch-url
  -> protocol and host validation
  -> bounded server-side fetch
  -> redirect validation
  -> static extraction
  -> rendered-page fallback when the static page is a JS shell or too thin
  -> editable preview
  -> explicit save
  -> immutable JobDescriptionVersion
```

Fetched content is never persisted automatically.

## Supported inputs

- `http` and `https` public URLs
- HTML pages
- plain-text pages
- HTML pages that include structured `JobPosting` JSON-LD
- HTML pages that hide job content inside embedded serialized state
- public JavaScript-rendered pages when a bounded rendered fallback is required

## SSRF protections

The server rejects:

- non-HTTP protocols
- URLs with embedded credentials
- loopback hosts
- localhost aliases
- link-local addresses
- RFC1918 private-network addresses
- unsafe redirects to blocked destinations

Redirect following is bounded and validated at each hop.

The rendered fallback reuses the same safety posture:

- only the already-validated public URL is opened
- every navigation request is revalidated before it continues
- private-network redirects remain blocked
- browser state is isolated and ephemeral
- downloads, popups, and high-noise resources such as images, media, and fonts are blocked
- no clicks, sign-ins, submissions, or other page interactions are performed

## Fetch bounds

The retrieval path enforces bounded behavior:

- request timeout
- redirect limit
- response size limit
- extracted-text truncation
- content-type allowlist

These limits keep intake safe and predictable for local personal use.

## Extraction behavior

When the source is HTML, the extractor uses this order:

1. `JobPosting` JSON-LD
2. embedded serialized state such as `__NEXT_DATA__` or safe-parsed inline JSON assignments
3. cleaned visible DOM containers
4. rendered-page `JobPosting` JSON-LD
5. cleaned rendered DOM containers

The extractor preserves useful metadata:

- requested URL
- final URL
- HTTP status
- content type
- page title when present
- extractor version
- extraction provenance
- diagnostics

The fallback only runs when the initial static response is public and fetchable but appears to be a JavaScript shell or contains too little usable text. It is not used for invalid URLs, blocked destinations, oversized responses, unsupported content types, or explicit access-denied and challenge pages.

The resulting text remains editable in the browser before save.

## Provenance

When the user saves the reviewed text, the resulting `JobDescriptionVersion.provenance` records URL-related metadata such as:

- intake mode
- requested URL
- final URL
- retrieval status
- content type
- retrieval timestamp
- page title
- extractor version
- extraction provenance
- diagnostics

This provenance does not bypass immutable versioning. Exact normalized checksum rules still control reuse and successor creation.

## Refetch behavior

- unchanged content for the same opportunity reuses the existing saved version
- changed content may create a new immutable successor after review and explicit save
- refetching alone does not supersede an existing version

## Known limitations

- some JavaScript-rendered postings still yield unusable text even after the bounded rendered fallback
- authenticated, challenge-gated, or CAPTCHA-protected pages are intentionally unsupported
- some career sites may still return boilerplate, anti-bot content, or incomplete data that must fall back to pasted text

In those cases, the browser keeps the paste workflow available as the fallback.
