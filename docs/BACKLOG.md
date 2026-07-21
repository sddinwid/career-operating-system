# Backlog

Last rebaselined: July 16, 2026

This backlog is organized by outcome-based milestones rather than the original prompt-number sequence. Historical prompt numbers remain documented for traceability, but they no longer define priority.

## Now

### `M3.3 - Requirement Review and Correction`
- Status: `verified complete`
- Priority: `done`
- Milestone: `Milestone 3`
- Dependency: `M3.2`
- Personal workflow benefit: lets Scott correct parsed requirements once and reuse the authoritative result later
- Acceptance summary: versioned deterministic requirement classification, review workflow, immutable confirmation, and revision lineage
- July 18, 2026 corrective note: atomic competency decomposition, level-aware applicability, contextual extraction, and downstream-readiness gating were hardened against the real Fieldguide posting without creating a new milestone

### `M3.2 - Deterministic Job Description Parser`
- Status: `verified complete`
- Priority: `done`
- Milestone: `Milestone 3`
- Dependency: `M3.1`
- Personal workflow benefit: reduces repetitive requirement extraction from each posting
- Acceptance summary: produce parsed company, title, sections, responsibilities, qualifications, technologies, compensation, and parser-version metadata with immutable reviewable output
- July 18, 2026 corrective note: parser version `m3.2.2` adds atomic line preservation, wrapped-line heuristics, canonical competency hierarchy, company-values recognition, and merged-item diagnostics for downstream safety
- July 19, 2026 corrective note: parser version `m3.2.4` adds deterministic scraped metadata-block recognition, company/title/location ranking, conditional remote-plus-hybrid normalization, department extraction, `K`-range compensation parsing, Workday wrapper-noise filtering, requisition and posted metadata extraction, and improved education-equivalency parsing for real pasted postings such as Fieldguide and Marathon Health
- July 20, 2026 corrective note: parser version `m3.2.5` and classifier version `m3.3.3` decompose Marathon-style compound education or experience and tooling or certification statements into atomic reviewed items, preserve equivalency modifiers, exclude compensation leakage from requirements, and promote conservative contextual role-summary extraction without creating a new milestone

### `M2.2 - Career Knowledge Validation and Read-Only Inspection`
- Status: `deferred`
- Priority: `P1`
- Milestone: `Milestone 2 - Deterministic Career Knowledge Engine`
- Dependency: `M2.1`
- Personal workflow benefit: exposes missing facts, unsupported metrics, stale skills, and duplicate role evidence before document generation begins
- Acceptance summary: return to a larger read-only inspection workspace only when it removes more repeated work than the next end-to-end generation inputs

## Next

### `M4.1 - Evidence Retrieval Contract`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 4 - Evidence Retrieval and Scoring`
- Dependency: `M3.3`
- Personal workflow benefit: stops repetitive hunting for matching roles, projects, and quantified evidence
- Acceptance summary: versioned deterministic candidate retrieval with immutable runs, gap reporting, idempotent reuse, and read-only evidence inspection

### `M4.2 - Evidence Scoring Engine`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 4`
- Dependency: `M4.1`
- Personal workflow benefit: automates ranking decisions Scott currently repeats in chats and manual editing
- Acceptance summary: deterministic scoring with explainable factors and penalties, immutable scoring runs, idempotent reuse, and read-only inspection

### `M4.3 - Explainable Match Report`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 4`
- Dependency: `M4.2`
- Personal workflow benefit: makes evidence selection inspectable before resume drafting
- Acceptance summary: render requirement-to-evidence matches, gaps, weak claims, and scoring rationale

### `M5.1 - Structured Resume Contract`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 5 - Resume Composition Engine`
- Dependency: `M4.3`
- Personal workflow benefit: creates a reusable resume representation independent from DOCX formatting
- Acceptance summary: define versioned structured resume JSON with sections, evidence references, and provenance

### `M5.2 - Deterministic Resume Composition`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 5`
- Dependency: `M5.1`
- Personal workflow benefit: removes repeated manual ordering of experience, projects, skills, and summaries
- Acceptance summary: build a targeted structured resume plan from scored evidence without AI-authored final artifacts

### `M5.3 - Resume Quality and Truthfulness Checks`
- Status: `verified complete`
- Priority: `P1`
- Milestone: `Milestone 5`
- Dependency: `M5.2`
- Personal workflow benefit: catches unsupported claims before any export or submission
- Acceptance summary: deterministic checks for unsupported claims, duplication, experience ceilings, and ATS readability

### `M6.1 - Resume Studio Editing and Versioned Revision`
- Status: `verified complete`
- Priority: `done`
- Milestone: `Milestone 6 - Resume Studio and Review`
- Dependency: `M5.3`
- Personal workflow benefit: supports safe employer-facing revision without rebuilding a resume from scratch
- Acceptance summary: mutable draft saves, deterministic local validation, immutable finalized revisions, revision-backed audit, and successor revision lineage

### `M6.2 - Resume Studio Comparison and Rendering Approval`
- Status: `verified complete`
- Priority: `P2`
- Milestone: `Milestone 6`
- Dependency: `M6.1`
- Personal workflow benefit: makes revised resume approval explicit before rendering and submission
- Acceptance summary: compare finalized revisions, review deltas, and approve one rendering-ready revision without mutating history

### `M7.1 - DOCX Template and Renderer`
- Status: `verified complete`
- Priority: `P2`
- Milestone: `Milestone 7 - Document Rendering and Artifact Versioning`
- Dependency: `M6.2`
- Personal workflow benefit: eliminates repeated manual DOCX editing for each application
- Acceptance summary: render structured resumes into downloadable DOCX artifacts linked to source versions

### `M7.2 - Render Validation and PDF Output`
- Status: `verified complete`
- Priority: `P2`
- Milestone: `Milestone 7`
- Dependency: `M7.1`
- Personal workflow benefit: makes artifacts usable for employer submission without manual conversion work
- Acceptance summary: direct deterministic PDF rendering, shared artifact validation, PDF browser verification, and immutable version reuse

### `M7.3 - Immutable Document Versioning and Attachment`
- Status: `deferred`
- Priority: `P2`
- Milestone: `Milestone 7`

## Deferred shell workspaces

- Calendar workspace
- Companies workspace
- Contacts workspace
- Interviews workspace
- Career Profile workspace
- Analytics workspace
- Settings workspace

These remain intentionally deferred after the July 19, 2026 navigation/discovery correction. They should not be backfilled with empty placeholder pages just to satisfy shell completeness.
- Dependency: `M7.2`
- Personal workflow benefit: tracks exactly which artifact version was downloaded or submitted
- Acceptance summary: persisted document metadata, immutable version records, and application linkage

### `M8.1 - Deterministic Cover Letter Composition`
- Status: `verified complete`
- Priority: `P2`
- Milestone: `Milestone 8 - Application Package Generation`
- Dependency: `M4.3`
- Personal workflow benefit: replaces repeated chat-based cover-letter drafting while preserving evidence, provenance, and truthfulness checks
- Acceptance summary: immutable deterministic cover-letter composition, paragraph-level provenance, read-only preview, and idempotent reuse without editing or rendering

### `M8.2 - Cover Letter Studio, Audit, and Approval`
- Status: `verified complete`
- Priority: `P2`
- Milestone: `Milestone 8 - Application Package Generation`
- Dependency: `M8.1`
- Personal workflow benefit: supports targeted cover-letter editing, deterministic review, and explicit approval without leaving the local workflow
- Acceptance summary: mutable draft save, immutable finalized revisions, revision lineage, deterministic audit reuse, approval history, revocation, and comparison without rendering output

## Later

### `M9.1 - Calculated Application Columns`
- Status: `deferred`
- Priority: `P2`
- Milestone: `Milestone 9 - Daily Workflow Completion`
- Dependency: stable tracker and activity rules
- Personal workflow benefit: improves prioritization once documents are generated inside the product
- Acceptance summary: deterministic last-touch, due-date, days-open, and workflow recommendation columns

### `M9.2 - Today Screen and Workflow Rules`
- Status: `deferred`
- Priority: `P2`
- Milestone: `Milestone 9`
- Dependency: `M9.1`
- Personal workflow benefit: surfaces due work after the document-generation loop is usable end to end
- Acceptance summary: due today, overdue, interviews soon, needs contact, and waiting views with explainable rules

### `M9.3 - Spreadsheet Copy Behavior`
- Status: `deferred`
- Priority: `P2`
- Milestone: `Milestone 9`
- Dependency: stable grid columns and value formatting
- Personal workflow benefit: restores Excel interoperability for manual side workflows
- Acceptance summary: tab-separated copy from selected cells and rows with human-usable values

### `M9.4 - XLSX and CSV Export`
- Status: `deferred`
- Priority: `P2`
- Milestone: `Milestone 9`
- Dependency: `M9.1`, `M9.3`
- Personal workflow benefit: supports spreadsheet fallback, reporting, and archival
- Acceptance summary: export filtered, selected, ranged, or full data into usable spreadsheets

### `M9.5 - Calendar Month View and Day Timeline`
- Status: `deferred`
- Priority: `P3`
- Milestone: `Milestone 9`
- Dependency: richer activity coverage
- Personal workflow benefit: supports scheduling and review once outreach and interviews are used daily
- Acceptance summary: month counts plus chronological day timeline grounded in job-search dates

### `M9.6 - Contacts, Outreach, and Interview Workspace`
- Status: `deferred`
- Priority: `P3`
- Milestone: `Milestone 9`
- Dependency: `M9.1`
- Personal workflow benefit: closes remaining CRM gaps after application-package generation becomes habitual
- Acceptance summary: contact views, outreach editing, and interview management beyond import-created records

### `M10.1 - Analytics and Learning`
- Status: `later`
- Priority: `P3`
- Milestone: `Milestone 10 - Analytics and Learning`
- Dependency: enough real usage data, document versions, and package-outcome linkage
- Personal workflow benefit: explains which strategies and resume variants work instead of just storing history
- Acceptance summary: funnel, response-rate, interview-rate, source, and variant analytics with sample-size warnings

### `M11.1 - Generic Resume and Career Ingestion`
- Status: `later`
- Priority: `P4`
- Milestone: `Milestone 11 - Generic Ingestion`
- Dependency: proven Scott-specific knowledge engine and validation workflow
- Personal workflow benefit: low for Scott, high for future portability and marketability
- Acceptance summary: import generic DOCX/PDF/TXT/JSON career sources with conflict detection and confirmation

### `M12.1 - Commercial Product Foundation`
- Status: `later`
- Priority: `P4`
- Milestone: `Milestone 12 - Commercial Product Foundation`
- Dependency: proven personal workflow and generic ingestion
- Personal workflow benefit: minimal today, strategic later
- Acceptance summary: auth, tenant isolation, secure storage, privacy controls, onboarding, and billing readiness

## Completed

### `M2.1 - Career Knowledge Contract and Versioned Scott CKB Import`
- Status: `verified complete`
- Priority: `done`
- Dependency: verified Milestone 1 tracker foundation
- Personal workflow benefit: removes repeated retelling of Scott's background and creates a deterministic source of truth for later generation work
- Acceptance summary: import the structured Scott CKB into an immutable, validated, versioned contract with provenance, dry-run support, idempotency, and read-only retrieval services

### `M3.1 - Job Description Intake and Persistence`
- Status: `verified complete`
- Priority: `done`
- Dependency: `M2.1`
- Personal workflow benefit: removes repeated manual copying and ad hoc storage of job descriptions across chats and documents
- Acceptance summary: preserve original and normalized job-description text with checksum-based idempotency, immutable versioning, opportunity linkage, optional application linkage, and read-only version detail flows

### `Milestone 0 - Foundation`
- Status: `verified complete`
- Priority: `done`
- Dependency: none
- Personal workflow benefit: made local development and repeatable verification possible
- Acceptance summary: Next.js app shell, PostgreSQL, Prisma, linting, typecheck, tests, health routes, and seeded workspace

### `Milestone 1 - Application Tracking Foundation`
- Status: `substantially complete`
- Priority: `done`
- Dependency: `Milestone 0`
- Personal workflow benefit: replaced core application logging, import preview, and spreadsheet-style review workflows
- Acceptance summary: application CRUD, status history, timestamp rules for applications/imports, fixture-driven import, reconciliation, grid, inline editing, saved views, and persistent grid state

## Deferred

### `M2.2 - Large standalone Career Knowledge inspection workspace`
- Status: `deferred`
- Priority: `P1`
- Milestone: `Milestone 2`
- Dependency: none beyond `M2.1`
- Personal workflow benefit: real, but lower than completing the deterministic document-generation input pipeline
- Acceptance summary: a broader inspection and diagnostics UI remains intentionally deferred until it outranks downstream parsing and generation work

### `Historical Prompt 04D - Spreadsheet ergonomics follow-up`
- Status: `deferred and renumbered`
- Priority: `P2`
- Milestone: `Milestone 9`
- Dependency: post-document-generation rebaseline
- Personal workflow benefit: real, but lower than deterministic document generation
- Acceptance summary: split into later slices such as copy behavior, calculated columns, and export

### `Historical Prompt 05 - Timestamp adjustment workflow`
- Status: `deferred and partially superseded`
- Priority: `P2`
- Milestone: `Milestone 9`
- Dependency: audit workflow and settings UI implementation
- Personal workflow benefit: useful, but existing application/import timestamp model is already adequate for current tracking
- Acceptance summary: full adjustment UI, adjustment reasons, and audit coverage remain open

## Superseded

### `Historical phase order: finish every tracker enhancement before document generation`
- Status: `superseded`
- Priority: `n/a`
- Milestone: superseded by milestone-based roadmap
- Dependency: none
- Personal workflow benefit: negative, because it delays the highest-frequency manual work
- Acceptance summary: replaced by the document-generation rebaseline recorded in `docs/ROADMAP_REVISION_001.md`

### `Historical prompt numbering as current priority`
- Status: `superseded`
- Priority: `n/a`
- Milestone: superseded by milestone-based roadmap
- Dependency: none
- Personal workflow benefit: negative, because it hides that Prompt 04D is no longer automatically next
- Acceptance summary: new implementation planning now uses milestone-aware identifiers such as `M2.1`, `M3.2`, and `M7.1`

## Historical Mapping

- Prompt `00` -> `Milestone 0`
- Prompt `01` -> `Milestone 0` and data foundation for `Milestone 1`
- Prompt `02` and Prompt `02 Corrections` -> `Milestone 1`
- Prompt `03`, Prompt `03 Corrections`, and Prompt `03 Reconciliation` -> `Milestone 1`
- Prompt `04A`, `04B`, and `04C` -> `Milestone 1`
- Historical Prompt `04D` -> deferred into `M9.1`, `M9.3`, and `M9.4`
- Historical Prompt `05` -> partially satisfied by current timestamp architecture; remaining work deferred into `Milestone 9`
- Historical Prompts `06-12` -> renumbered across `Milestones 9-12`
## Status

- M4.2 - Complete
- M4.3 - Complete
- M5.1 - Complete
- M5.2 - Next
## Next

- M7.1 — DOCX Renderer and Immutable Document Version
