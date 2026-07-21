# Cover Letter Composition

`M8.1` adds deterministic, immutable cover-letter composition.

## Purpose

The cover-letter path composes concise employer-facing prose from the existing deterministic pipeline:

- `CareerProfileVersion`
- confirmed `JobRequirementAnalysis`
- successful `EvidenceRetrievalRun`
- successful `EvidenceScoringRun`
- successful `MatchReportRun`
- optional `ResumeCompositionVersion` or finalized `ResumeRevisionVersion`

The composition layer remains render-independent. It creates structured content, not DOCX or PDF artifacts.

## Persistence

`CoverLetterCompositionVersion` is the immutable source of truth for one exact composed cover letter.

Stored lineage includes:

- workspace
- optional application
- job opportunity
- job description version
- career profile version
- requirement analysis
- evidence retrieval run
- evidence scoring run
- match report run
- optional resume composition source
- optional finalized resume revision source
- optional predecessor cover-letter composition version

Stored metadata includes:

- contract version
- engine version
- configuration version
- deterministic input checksum
- content checksum
- structured content JSON
- summary JSON
- diagnostics JSON
- created and completed timestamps

## Reuse

The service reuses the latest successful `CoverLetterCompositionVersion` when the exact deterministic input lineage and composition versions match.

Changed upstream evidence, changed resume source, or changed composition versions create a new immutable row.

## Routes

- `/job-descriptions/[jobDescriptionVersionId]/cover-letter`

The preview page is read-only. It shows the latest composition, summary metadata, audit readiness, and approval state without mutating prior versions.

## Boundaries

`M8.1` intentionally stops before:

- editable cover-letter revisions
- persistent cover-letter audit runs
- approval history
- DOCX or PDF rendering
- `DocumentVersion` output

Those capabilities are implemented in `M8.2`.
## Rendering Dependency

M8.3 renders only the immutable composition content referenced by an active `CoverLetterApproval` when the approval source type is `BASE_COMPOSITION`. The composition output remains unchanged; rendering consumes it as a read-only approved source.
