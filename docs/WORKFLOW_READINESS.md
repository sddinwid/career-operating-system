# Workflow Readiness

Date: July 21, 2026

`M8.4` adds a shared read-only workflow-readiness model so the implemented `M0` through `M8` pipeline is operable from normal browser pages without manual deep-link entry.

## Purpose

The readiness layer answers two questions for one workspace-owned `JobOpportunity` and optional linked `Application`:

- what implemented stage is currently available, blocked, complete, or needs review
- what the next truthful action is from the browser

The readiness layer does not create or mutate domain records.

## Surfaces

The shared readiness logic appears on:

- `/`
- `/jobs`
- `/jobs/[jobOpportunityId]`
- `/applications/[applicationId]`

## Stage model

The panel evaluates these stages:

1. Job Description
2. Parse
3. Requirement Review
4. Evidence Retrieval
5. Evidence Scoring
6. Match Report
7. Resume Plan
8. Resume Composition
9. Resume Audit and Approval
10. Resume DOCX
11. Resume PDF
12. Cover Letter Composition
13. Cover Letter Audit and Approval
14. Cover Letter DOCX
15. Cover Letter PDF
16. Documents

Supported statuses:

- `NOT_STARTED`
- `AVAILABLE`
- `IN_PROGRESS`
- `NEEDS_REVIEW`
- `BLOCKED`
- `READY`
- `APPROVED`
- `RENDERED`
- `FAILED`
- `REVOKED`

The readiness service reuses existing domain semantics where possible instead of inventing new background-processing states.

## Status inputs

The service derives current state from:

- active `JobDescriptionVersion`
- latest successful `JobDescriptionParse` for the current version
- confirmed or current non-superseded `JobRequirementAnalysis`
- the workspace current real `CareerProfileVersion`
- latest successful `EvidenceRetrievalRun` that matches the current real profile and confirmed requirement lineage
- latest successful `EvidenceScoringRun` for that retrieval lineage
- latest successful `MatchReportRun`
- latest active `StructuredResumeVersion`
- latest current resume composition, revision, audit, approval, and rendered documents
- latest current cover-letter composition, revision, audit, approval, and rendered documents

Failed rows are visible only as failed state. They are not promoted into successful current state.

## Action rules

Examples of deterministic next actions:

- no job description: `Paste Job Description` and `Import from URL`
- saved description with no parse: `Parse Job Description`
- parse complete with no confirmed analysis: `Review Requirements`
- confirmed analysis with no evidence: `Retrieve Evidence`
- evidence without scoring: `Score Evidence`
- scoring without report: `Generate Match Report`
- report without resume plan: `Create Resume Plan`
- resume composition without approval: `Open Resume Studio`
- approved resume without artifacts: `Render Resume DOCX` or `Render Resume PDF`
- no cover letter: `Generate Cover Letter`
- finalized cover letter without approval: `Open Cover Letter Studio`
- approved cover letter without artifacts: `Render Cover Letter DOCX` or `Render Cover Letter PDF`

Blocked actions show their missing prerequisite instead of routing to placeholder pages.

Evidence Retrieval is blocked when:

- no current real Career Knowledge profile exists
- the workspace only has fixture Career Knowledge
- the current pointer resolves to a fixture profile

When Evidence Retrieval is available or already complete, the linked page now surfaces a concise next action and a summary-first requirement view rather than exposing raw engine metadata as the primary page content.

Historical fixture-backed retrieval runs remain inspectable by direct view routes, but they do not mark the normal workflow as complete.

## Ownership and invariants

- workflow readiness is workspace-owned and respects existing ownership checks
- readiness never changes `Application.status`
- readiness never creates `ApplicationStatusHistory`
- readiness never changes immutable source, parse, evidence, match-report, resume, cover-letter, approval, or document records

## Relationship to Milestone 9

`M8.4` is a corrective usability slice before application-package composition. It does not begin the `M9` Today-screen or spreadsheet-ergonomics milestones.
