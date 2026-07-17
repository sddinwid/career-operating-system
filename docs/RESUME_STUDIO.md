# Resume Studio

Date: July 17, 2026

`M6.1` adds versioned resume revision editing on top of immutable `ResumeCompositionVersion` content.

## Core model

`ResumeRevisionVersion` stores:

- one mutable draft or one immutable finalized revision
- exact linkage to base composition, structured resume, match report, career profile, requirement analysis, job description, and optional application
- versioned content, change set, summary, diagnostics, and review notes
- predecessor lineage for finalized revisions and successor drafts

## Statuses

- `DRAFT`
- `READY_FOR_AUDIT`
- `AUDITED`
- `NEEDS_REVIEW`
- `SUPERSEDED`
- `FAILED`

## Workflow

1. Open Resume Studio from one exact composed resume.
2. Reuse the current mutable draft when one already exists.
3. Save deterministic draft edits through `/api/resume-studio/[revisionId]`.
4. Run local validation before finalization.
5. Finalize into an immutable revision successor through `/api/resume-studio/[revisionId]/finalize`.
6. Run revision-backed audit from the finalized revision.
7. Create a successor draft from the finalized revision when more edits are needed.

## Local validation

The revision engine blocks unsupported edits such as:

- introduced or changed metrics
- introduced unsupported technology terms in edited bullets
- unsupported years-of-experience claims
- required-section removal
- blocked page-budget overflow
- duplicate included bullets or skills
- forbidden em dash usage

Warnings remain visible in the summary and diagnostics, but blocked findings prevent finalization.

## Finalization behavior

The implementation keeps mutable drafts separate from immutable finalized revisions.

- a finalized revision is created transactionally as a successor row
- the original mutable draft is marked `SUPERSEDED`
- repeated finalization of the same superseded draft returns the existing finalized successor
- finalized revisions are read-only in the UI

## API error handling

The finalize route distinguishes expected domain failures:

- `400` invalid finalize payload
- `404` missing revision
- `409` stale draft or invalid state transition
- `422` blocked validation findings
- `500` unexpected server failure with metadata-only logging

## Audit integration

Finalized revisions can be audited without mutating base composition or base audit history.

- revision-backed audits store `resumeRevisionVersionId` on `ResumeAuditRun`
- reuse is revision-specific rather than composition-specific
- successful revision audits can mark the revision `AUDITED` or keep it `NEEDS_REVIEW`

## UI

Route:

- `/job-descriptions/[jobDescriptionVersionId]/resume/studio`

Current Studio capabilities:

- professional summary editing
- section enablement and section-order profile switching
- skill inclusion, ordering, and qualification editing
- role and project inclusion controls
- review notes
- provenance and change summary inspection
- finalized revision actions and successor draft creation

## Known limitations

- no side-by-side revision comparison yet
- no rendering approval state yet
- no DOCX or PDF output
- no manual override of blocked validation
- no renderer-specific pagination preview

## Next Dependency

`M6.2 - Resume Studio Comparison and Rendering Approval`
## M6.2 Comparison and Approval

Finalized revisions now support:

- compare with base composition
- compare with predecessor revision
- compare with current active approval
- approve for rendering when the revision audit is eligible
- approval supersession and revocation history

Mutable drafts remain ineligible for rendering approval.
