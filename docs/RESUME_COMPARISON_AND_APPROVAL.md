# Resume Comparison and Approval

M6.2 adds deterministic resume comparison and immutable rendering approval without introducing any renderer, downloadable artifact, or document version.

## Comparison Inputs

Comparisons are computed directly from immutable stored sources:

- `ResumeCompositionVersion`
- `ResumeRevisionVersion`
- `ResumeAuditRun`

No comparison rows are persisted. The server rebuilds the comparison from exact immutable inputs on every request.

## Comparison Modes

Supported modes:

- Base composition versus finalized revision
- Predecessor finalized revision versus current finalized revision
- Current active approval versus proposed finalized revision

Comparisons are limited to one workspace and one job-description lineage.

## Statement Identity

Statement comparison prefers:

1. Exact statement identifier
2. Base statement identifier
3. Parent role or project linkage
4. Stable section-specific fallback identifiers

The system does not use AI similarity or external diffing.

## Change-Set Reconciliation

Resume Studio change-set entries are reconciled against the actual immutable content difference. M6.2 flags:

- Recorded and reflected changes
- Recorded but no longer reflected changes
- Unrecorded content changes
- Missing change references
- Restore-to-base outcomes
- Reorder matches

Unrecorded content changes remain approval-blocking diagnostics.

## Audit-Finding Comparison

Audit findings are compared using rule identifier, statement identifier, section, category, severity, and actual condition. M6.2 classifies findings as:

- `RESOLVED`
- `REMAINING`
- `NEW`
- `CHANGED`
- `NOT_APPLICABLE`

The current audit remains authoritative. No manual dismissal or override is added.

## Approval Eligibility

Rendering approval requires:

- Immutable base composition or finalized revision source
- Exact audit linkage to that source
- Matching workspace and job-description lineage
- Allowed rendering readiness
- No blocking findings
- No approval-blocking comparison diagnostics

`READY_WITH_WARNINGS` is allowed only with the exact acknowledgement text:

`I acknowledge the remaining non-blocking warnings.`

## Approval Records

`ResumeRenderingApproval` stores:

- Exact content source type and source id
- Exact audit id and audit checksum
- Upstream structured resume, career profile, match report, and requirement analysis linkage
- Content checksum
- Readiness, warning counts, blocking counts
- Immutable status history
- Optional approval note and revocation reason

## Active Approval Rules

At most one `APPROVED` record may be active for the same workspace, job description, optional application, and resume artifact type.

Approving a new source:

- Reuses the current record when the request is exactly identical
- Supersedes the current active approval when a different eligible source is approved
- Preserves predecessor linkage and full history

## Revocation

Revocation preserves the approval row, records the timestamp, removes active rendering eligibility, and does not mutate content, audits, or downstream document records.

## Approval History

The UI shows approval sequence, source type, timestamps, warning acknowledgement state, approval notes, supersession, and revocation.

## Rendering Gate

`getApprovedResumeForRendering(...)` is the only supported server-side way for future renderers to fetch a renderable resume source. It validates:

- Active approval exists
- Approval is not revoked or superseded
- Source checksum still matches
- Audit checksum still matches
- Source is immutable
- Rendering readiness is still allowed

Future M7 renderers must use this gate rather than selecting the latest resume source independently.

## Concurrency

Approval creation and revocation are transaction-protected. Requests validate:

- Expected content checksum
- Expected current active approval id
- Exact audit id

Stale approval submissions return domain conflicts instead of overwriting newer state.

## Privacy

M6.2 does not log raw resume bodies or raw audit payloads. Approval and comparison views stay inside the workspace and keep employer-facing rendering out of scope.

## Known Limitations

- DOCX rendering now belongs to `M7.1`, not this milestone
- No PDF renderer yet
- Immutable document storage and download now belong to `M7.1`, not this milestone
- No persisted comparison snapshots
- No manual finding override workflow

## M7 Dependency

M7.1 now consumes the exact active approval through `getApprovedResumeForRendering(...)` to create immutable employer-facing document versions without selecting resume content independently.
