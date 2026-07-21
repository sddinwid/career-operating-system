# Cover Letter Studio

`M8.2` adds editable cover-letter revisions on top of immutable `CoverLetterCompositionVersion` records.

## Purpose

The studio preserves deterministic base composition while allowing targeted human editing in a separate revision history.

Base composition remains immutable.

User edits live in `CoverLetterRevisionVersion`.

## Routes

- `/job-descriptions/[jobDescriptionVersionId]/cover-letter`
- `/job-descriptions/[jobDescriptionVersionId]/cover-letter/studio`
- `/job-descriptions/[jobDescriptionVersionId]/cover-letter/compare`

## Revision lifecycle

`CoverLetterRevisionVersion` supports:

- `DRAFT`
- `FINALIZED`
- `AUDITED`
- `NEEDS_REVIEW`
- `SUPERSEDED`

Behavior:

- the latest active draft is reused for the same base composition until finalization
- draft saves remain mutable
- finalization freezes the content into an immutable finalized revision
- successor drafts can branch from finalized revisions
- predecessor and successor lineage remains explicit

## Editing behavior

The studio supports:

- draft save through `/api/cover-letter-studio/[revisionId]`
- finalization through `/api/cover-letter-studio/[revisionId]/finalize`
- local validation and deterministic diagnostics
- audit launch from finalized content
- comparison back to the base composition
- approval history and active approval inspection

The studio does not rewrite:

- `CoverLetterCompositionVersion`
- match-report runs
- evidence runs
- resume pipeline records

## Comparison

The comparison view remains computed, not persisted.

It exists to inspect:

- paragraph changes
- audit summary
- current approval state
- revision lineage context
## Rendering Dependency

Studio drafts remain mutable and are never rendered directly. M8.3 only renders finalized revision content after the revision is audited successfully and approved, preserving the exact finalized immutable source referenced by the approval.
