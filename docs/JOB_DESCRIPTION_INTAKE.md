# Job Description Intake

## Scope

`M3.1` preserves job-description source text and immutable version history without parsing requirements or making AI calls.

Implemented workflows:

- Add a description from an existing application
- Replace a description for the same opportunity with a new immutable version
- Create a saved opportunity plus first description from `/jobs/new`
- Add or replace a description for an existing opportunity from `/jobs/[jobOpportunityId]/job-description`
- Preview public URL retrieval before save through the intake form
- View a saved version at `/job-descriptions/[jobDescriptionVersionId]`

Implemented downstream dependency:

- deterministic parsing through immutable `JobDescriptionParse` records and the read-only analysis page

Deferred:

- requirement classification
- evidence retrieval
- document generation
- large standalone Career Knowledge inspection UI

## Source preservation

Each saved version stores:

- workspace ownership
- opportunity linkage
- optional application linkage
- original pasted text
- deterministic normalized text
- checksum of normalized text
- source URL
- source type
- optional source title
- optional source filename
- capture timestamp
- optional publication date
- predecessor linkage
- active or superseded state
- workflow identifier
- provenance metadata

The original text is preserved exactly as entered. Validation errors and routine logs do not echo the full description text.

## Normalization

Normalization is deterministic and safe for later parsing:

- normalize line endings to LF
- trim trailing whitespace
- collapse runs of excessive blank lines
- preserve headings, bullets, wording, dates, numbers, and technology names

Normalization does not summarize, paraphrase, or reinterpret the description.

## Versioning and idempotency

Duplicate handling is opportunity-scoped:

- same opportunity plus same normalized checksum: reuse existing version
- same opportunity plus changed normalized checksum: create a new immutable successor
- different opportunity plus same checksum: do not merge opportunities automatically

When a new version is created:

- the previous active version remains unchanged
- the previous active version is marked superseded
- the new version becomes active
- predecessor linkage is preserved

All writes happen transactionally so failures do not leave half-superseded states behind.

## Opportunity and application linkage

Opportunity identity remains based on existing rules:

- company reuse uses normalized company matching
- opportunity reuse depends on canonical URL rules
- same company and role without canonical URL do not merge automatically

Application intake always uses the application's existing opportunity and updates the application's current job-description pointer to the exact saved version. Intake does not create status-history rows or rewrite application timestamps.

## Privacy and non-AI design

`M3.1` is intentionally local and non-AI:

- no OpenAI or other model calls
- no browser automation, CAPTCHA bypass, or authenticated scraping
- no unrelated API responses that include full job-description text
- no real private source text in fixtures or snapshot-style assertions

## URL preview intake

`M8.4` adds a second input mode alongside pasted text:

- the browser submits a public URL to a server-side route
- the server validates protocol, host safety, redirect targets, response size, and timeout
- supported HTML or plain-text content is converted into editable preview text
- request URL, final URL, status, content type, page title, extractor version, and diagnostics are shown before save
- no `JobDescriptionVersion` is persisted until the user explicitly submits the reviewed text through the existing save path

Unchanged refetches for the same opportunity still reuse the existing immutable version by normalized checksum. Changed refetches may create a successor immutable version after review and save.

## Dependency

`M3.2 - Deterministic Job Description Parser` now consumes the normalized preserved source introduced here rather than reparsing ad hoc pasted text from outside the system. See [docs/JOB_DESCRIPTION_PARSER.md](docs/JOB_DESCRIPTION_PARSER.md) for the deterministic extraction contract and parse-run behavior.

See [docs/URL_JOB_DESCRIPTION_INTAKE.md](docs/URL_JOB_DESCRIPTION_INTAKE.md) for the retrieval contract, SSRF protections, JSON-LD handling, and known limitations.
