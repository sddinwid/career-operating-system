# Cover Letter Audit

`M8.2` adds deterministic, immutable cover-letter audit runs.

## Purpose

The audit evaluates one exact cover-letter source for rendering readiness and truthfulness without mutating the content.

Supported sources:

- base composition projected into finalized-revision-compatible content
- finalized `CoverLetterRevisionVersion`

## Persistence

`CoverLetterAuditRun` stores:

- workspace
- optional application
- job opportunity
- job description version
- exact cover-letter composition version
- optional exact cover-letter revision version
- career profile version
- requirement analysis
- evidence retrieval run
- evidence scoring run
- match report run
- source type
- contract version
- engine version
- configuration version
- content checksum
- deterministic audit input checksum
- status
- rendering readiness
- result JSON
- summary JSON
- diagnostics JSON
- created and completed timestamps

## Reuse

Exact audit inputs reuse the latest existing `CoverLetterAuditRun`.

The reuse key includes:

- source type
- cover-letter composition version id
- optional cover-letter revision version id
- content checksum
- audit contract, engine, and configuration versions

## Routes

- `/job-descriptions/[jobDescriptionVersionId]/cover-letter/audit`

The audit page is read-only. It displays summary counts, rendering readiness, findings, and source lineage.

## Boundaries

The audit does not:

- edit cover-letter content
- override findings manually
- create `DocumentVersion` rows
- approve content automatically
## Rendering Gate

M8.3 uses `CoverLetterAuditRun` as the final render gate. A cover letter cannot render unless the active approval still points to a successful matching audit with `READY_FOR_RENDERING` or `READY_WITH_WARNINGS`, no blocking findings, and exact source-checksum agreement.
