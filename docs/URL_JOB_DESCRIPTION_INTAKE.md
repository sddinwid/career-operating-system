# URL Job Description Intake

Date: July 21, 2026

`M8.4` adds server-side public URL retrieval as an alternate job-description intake mode. It supplements pasted text and still reuses the existing immutable `JobDescriptionVersion` save path.

## Flow

```text
URL entered in browser
  -> POST /api/job-descriptions/fetch-url
  -> protocol and host validation
  -> bounded server-side fetch
  -> redirect validation
  -> HTML or text extraction
  -> optional JSON-LD JobPosting extraction
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

## Fetch bounds

The retrieval path enforces bounded behavior:

- request timeout
- redirect limit
- response size limit
- extracted-text truncation
- content-type allowlist

These limits keep intake safe and predictable for local personal use.

## Extraction behavior

When the source is HTML, the extractor prefers meaningful visible text and preserves useful metadata:

- requested URL
- final URL
- HTTP status
- content type
- page title when present
- extractor version
- diagnostics

When JSON-LD `JobPosting` is present, its structured job content can supplement HTML extraction.

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
- diagnostics

This provenance does not bypass immutable versioning. Exact normalized checksum rules still control reuse and successor creation.

## Refetch behavior

- unchanged content for the same opportunity reuses the existing saved version
- changed content may create a new immutable successor after review and explicit save
- refetching alone does not supersede an existing version

## Known limitations

- JavaScript-rendered postings that require client execution may yield partial or unusable text
- authenticated, challenge-gated, or CAPTCHA-protected pages are intentionally unsupported
- some career sites may return boilerplate or anti-bot content that must fall back to pasted text

In those cases, the browser keeps the paste workflow available as the fallback.
