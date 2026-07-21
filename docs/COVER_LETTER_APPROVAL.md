# Cover Letter Approval

`M8.2` adds immutable approval history for exact audited cover-letter sources.

## Purpose

Approval is stored separately from content so downstream renderers can consume one exact audited source without mutating composition or revision rows.

## Eligibility

Approval requires:

- an exact base composition or finalized revision source
- an exact matching `CoverLetterAuditRun`
- matching job-description lineage
- matching application linkage when application-specific
- audit source and checksum alignment

Warnings may require the exact acknowledgement text from `src/lib/cover-letter-approval/config.ts`.

Blocking audit findings prevent approval.

## Persistence

`CoverLetterApproval` stores:

- workspace
- source type
- exact cover-letter composition version id
- optional exact cover-letter revision version id
- exact audit run id
- optional application
- job opportunity
- job description version
- predecessor approval id
- contract version
- engine version
- configuration version
- content checksum
- audit input checksum
- status
- rendering readiness
- warning and blocking counts
- warning acknowledgement
- approval note
- revocation reason
- approved, revoked, superseded, and created timestamps

Statuses:

- `APPROVED`
- `REVOKED`
- `SUPERSEDED`

## Studio behavior

The studio page shows:

- current eligibility
- active approval
- approval history
- approval creation
- revocation

Approval remains separate from editing and audit generation.

## Boundaries

`M8.2` does not add cover-letter DOCX or PDF rendering.

Approval only establishes the exact immutable source that later rendering must consume.
## Rendering Integration

The active `CoverLetterApproval` is now the sole authority for cover-letter rendering. Historical revoked or superseded approvals keep their previously rendered artifacts as immutable history, but only the current active approved source may create or reuse new render artifacts.
