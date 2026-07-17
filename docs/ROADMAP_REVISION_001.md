# Career Operating System
# Roadmap Revision 001
# Document Generation Rebaseline
# July 16, 2026

## Why the Roadmap Changed

The original roadmap assumed the tracker needed to be broadly finished before document-generation work became worthwhile. The repository no longer supports that assumption.

What exists today is enough tracker foundation to move on:
- structured application records
- status history
- timestamp and job-search-date handling for applications and imported date-only data
- import provenance and reconciliation
- spreadsheet-style applications grid
- inline editing
- saved views and persistent grid state

What still consumes high-frequency repetitive effort is outside the tracker:
- reading job descriptions repeatedly
- matching requirements to prior experience
- reordering stacks and skills for each role
- building targeted resumes
- recreating concise cover letters
- keeping exact submitted versions attached to each application
- repeating context in separate AI chats

This revision shifts priority from "finish every remaining tracker enhancement first" to "use the existing tracker foundation to support deterministic application-document generation now."

## What Changed

- The next major milestone is now `Milestone 2 - Deterministic Career Knowledge Engine`.
- Historical Prompt `04D` is no longer automatically next.
- Spreadsheet copy/export/calendar/Today remain valuable, but they move behind the first deterministic document-generation milestones.
- The long-term vision still includes analytics, generic ingestion, and commercialization, but those no longer delay Scott's highest-frequency current pain.

## Current Project Assessment

Classification scale:
- `Production-ready`
- `Functionally complete but not yet proven in daily use`
- `Complete foundation only`
- `Partially complete`
- `Model-only`
- `Documentation-only`
- `Not started`
- `Superseded`
- `Obsolete`

| Area | Classification | Repository evidence |
| --- | --- | --- |
| Repository and development foundation | Production-ready | `README.md`, `package.json`, `docker-compose.yml`, `src/app/health/page.tsx`, `tests/e2e/smoke.spec.ts` |
| Database foundation | Production-ready | `prisma/schema.prisma`, `prisma/migrations/20260715233032_init/migration.sql`, `prisma/migrations/20260716003224_prompt01_database_foundation/migration.sql` |
| Workspace settings | Functionally complete but not yet proven in daily use | `prisma/seed.ts`, `src/lib/settings.ts`, `src/lib/workspace.ts`, `src/lib/applications/grid-view-service.ts` |
| Applications CRUD | Functionally complete but not yet proven in daily use | `src/lib/applications/service.ts`, `src/lib/applications/actions.ts`, `src/app/applications/new/page.tsx`, `src/app/applications/[applicationId]/edit/page.tsx`, `src/lib/applications/service.test.ts` |
| Status history | Functionally complete but not yet proven in daily use | `src/lib/applications/service.ts`, `src/app/applications/[applicationId]/page.tsx`, `src/lib/applications/service.test.ts` |
| Timestamp architecture | Functionally complete but not yet proven in daily use | `src/lib/applications/timestamps.ts`, `src/lib/applications/service.test.ts`, `src/lib/imports/service.test.ts` |
| Excel import | Functionally complete but not yet proven in daily use | `src/lib/imports/workbook.ts`, `src/lib/imports/service.ts`, `src/app/imports/page.tsx`, `src/components/imports/import-wizard.tsx`, `tests/e2e/imports.spec.ts` |
| Import reconciliation | Functionally complete but not yet proven in daily use | `docs/IMPORT_RECONCILIATION_JULY.md`, `src/components/imports/import-wizard.tsx`, `src/lib/imports/workbook.test.ts` |
| Applications Grid | Functionally complete but not yet proven in daily use | `src/components/applications/applications-grid.tsx`, `src/app/applications/page.tsx`, `tests/e2e/applications-grid.spec.ts` |
| Inline editing | Functionally complete but not yet proven in daily use | `src/components/applications/applications-grid.tsx`, `src/app/api/applications/[applicationId]/grid-field/route.ts`, `src/lib/applications/grid-schemas.ts`, `src/components/applications/applications-grid.test.tsx` |
| Saved views | Functionally complete but not yet proven in daily use | `src/lib/applications/grid-view-state.ts`, `src/lib/applications/grid-view-service.ts`, `src/app/api/applications/views/route.ts`, `tests/e2e/applications-grid.spec.ts` |
| Column-state persistence | Functionally complete but not yet proven in daily use | `src/lib/applications/grid-view-state.ts`, `src/lib/applications/grid-view-service.ts`, `src/components/applications/applications-grid.tsx` |
| Spreadsheet copy behavior | Not started | historical requirement only in `codex-prompts/04_APPLICATION_GRID.md`, `docs/REQUIREMENTS.md`, `docs/UI_SPEC.md` |
| Spreadsheet paste behavior | Not started | `docs/REQUIREMENTS.md` and historical roadmap only |
| Calculated application columns | Not started | referenced in `docs/REQUIREMENTS.md`, `docs/UI_SPEC.md`, and old prompts; no source implementation |
| Excel/CSV export | Not started | historical prompt `codex-prompts/07_EXCEL_EXPORT.md`; no route or service implementation |
| Calendar month view | Not started | historical prompt `codex-prompts/06_CALENDAR_AND_DAY_VIEW.md`; navigation placeholder in `src/lib/navigation.ts` |
| Day timeline | Not started | historical prompt `codex-prompts/06_CALENDAR_AND_DAY_VIEW.md`; no route implementation |
| Today screen | Not started | `src/app/page.tsx` is still a foundation/health landing page; navigation label exists only |
| Contacts | Complete foundation only | `Contact` model in `prisma/schema.prisma`; imported contacts via `src/lib/imports/service.ts`; no contacts route/UI |
| Outreach activities | Complete foundation only | `Activity` model plus limited creation paths in `src/lib/applications/service.ts` and `src/lib/imports/service.ts`; no workflow UI |
| Interviews | Complete foundation only | `Interview` model plus import-created interview records in `src/lib/imports/service.ts`; no interviews workspace |
| Company workspace | Complete foundation only | company normalization and reuse in `src/lib/applications/service.ts`; no companies page |
| Document storage | Model-only | `Document` and `DocumentVersion` models only in `prisma/schema.prisma`; no service or route hits in `src/` |
| Document versions | Model-only | same evidence as document storage |
| File upload and download | Not started | historical requirement only in `docs/REQUIREMENTS.md` and `codex-prompts/08_DOCUMENT_STORAGE.md` |
| Career profile | Model-only | `CareerProfileVersion` model exists in `prisma/schema.prisma`; no source usage in `src/` |
| Career knowledge base | Documentation-only | discussed in `docs/REQUIREMENTS.md`, `docs/OPENAI_DESIGN.md`, and historical roadmap; no implementation |
| Career source documents | Not started | no schema or source implementation |
| Career fact provenance | Documentation-only | principle exists in docs; no implemented career-fact model or workflow |
| Skills and evidence | Not started | no source implementation; only roadmap-level concepts |
| Resume rules | Documentation-only | Scott-specific rules live in historical roadmap only |
| Writing preferences | Documentation-only | roadmap/docs only; no model or settings storage |
| Job-description storage | Model-only | `JobOpportunity.descriptionText` and `descriptionData` fields in `prisma/schema.prisma`; no service/UI |
| Job-description parsing | Not started | docs only in `docs/OPENAI_DESIGN.md` and historical prompt `11` |
| Requirement classification | Not started | roadmap/docs only |
| Evidence retrieval | Not started | roadmap/docs only |
| Evidence scoring | Not started | roadmap/docs only |
| Resume generation | Not started | roadmap/docs only |
| Cover-letter generation | Not started | roadmap/docs only |
| Resume Studio | Not started | roadmap/docs only |
| Document rendering | Not started | roadmap/docs only |
| Application packages | Not started | roadmap/docs only |
| Analytics | Not started | placeholder navigation only in `src/lib/navigation.ts`; no analytics route |
| AI run tracking | Model-only | `AiRun` schema only; no source usage in `src/` |
| Authentication | Not started | explicitly absent by design |
| Multi-user support | Not started | workspace ownership exists, but no auth/workspace switching |
| Commercialization | Not started | no hosted, billing, or onboarding workflows |

## Original Prompt Reassessment

| Historical prompt | Original objective | What was actually implemented | Repository disposition | Acceptance assessment | Revised roadmap placement |
| --- | --- | --- | --- | --- | --- |
| Prompt 00 | bootstrap repository, app shell, health, seed, tests | implemented Next.js app shell, health routes, Docker/Postgres, Prisma init, seed, tests | Completed | Met in code and tests | Milestone 0 |
| Prompt 01 | Phase 1 Prisma data model and diagram | implemented approved Phase 1 schema, migration, seed defaults, diagram | Completed | Met in schema, migration, tests, docs | Milestone 0 / 1 foundation |
| Prompt 02 | application/company management vertical slice | implemented forms, detail page, edit, archive/restore, status history | Completed with follow-up debt | Acceptance met; detail page remains narrower than long-term UI spec | Milestone 1 |
| Prompt 02 Corrections | fix timestamps, opportunity matching, status history, typed routes | implemented real timestamp semantics, original/recorded/jobSearch separation, opportunity URL matching, sorting semantics | Completed | Verified in `src/lib/applications/service.test.ts` | Milestone 1 |
| Prompt 03 | fixture-driven import wizard | implemented preview, mapping, row storage, import execution, retry, summaries | Completed with follow-up debt | Acceptance met for fixture workflow; still fixture-specific rather than generic upload | Milestone 1 |
| Prompt 03 Corrections | DATE_ONLY handling, fixture reconciliation, related-record verification | implemented DATE_ONLY semantics, row summaries, related record import behavior | Completed | Verified in import tests and reconciliation docs | Milestone 1 |
| Prompt 03 Reconciliation | classify and recover meaningful rows without weakening validation | implemented explicit row classification, warnings, review buckets, opportunity-only path, no silent skips | Completed with follow-up debt | Real fixture still leaves review rows where source data is insufficient; repository behavior is explicit and tested | Milestone 1 |
| Prompt 04A | production read-only applications grid | implemented AG Grid foundation, sorting/filtering/search/navigation | Completed | Verified in `src/components/applications/applications-grid.tsx` and tests | Milestone 1 |
| Prompt 04B | inline editing | implemented grid-field mutation path, rollback, preserved status history and timestamp rules | Completed | Verified in route, service tests, and e2e | Milestone 1 |
| Prompt 04B hardening/completion passes | stabilize AG Grid edit lifecycle | merged into current Prompt 04B state | Merged into another prompt | Verified by current grid tests/e2e, no separate ongoing roadmap item | Historical only |
| Prompt 04C | saved views and layout persistence | implemented system views, user views, persisted layout/filter/sort/archive state | Completed | Verified in `grid-view-*` code and `tests/e2e/applications-grid.spec.ts` | Milestone 1 |
| Planned Prompt 04D | spreadsheet ergonomics follow-up | not implemented; historical direction was copy behavior or calculated columns | Deferred and renumbered | No longer automatically next | Milestone 9 |
| Planned Prompt 04E | not documented as a concrete repository prompt | no repository prompt file found | Obsolete as a standalone identifier | superseded by milestone-based plan | Renumbered |
| Planned Prompt 04F | not documented as a concrete repository prompt | no repository prompt file found | Obsolete as a standalone identifier | superseded by milestone-based plan | Renumbered |
| Historical Prompt 05 | centralized timestamp adjustment workflow | partially satisfied by current application/import timestamp model, but not by full audit/settings UI | Deferred | Original acceptance not fully met because adjustment UI, reasons, and audit writes are absent | Milestone 9 |
| Historical Prompt 06 | calendar and day timeline | not implemented | Moved later | no route/UI/tests | Milestone 9 |
| Historical Prompt 07 | Excel export | not implemented | Moved later | no route/service/tests | Milestone 9 |
| Historical Prompt 08 | document storage and downloads | schema exists only | Moved later | original acceptance not met | Milestone 7 |
| Historical Prompt 09 | Today and workflow rules | not implemented | Moved later | home page is still health/foundation | Milestone 9 |
| Historical Prompt 10 | real fixture validation and personal release runbook | partially achieved through import reconciliation and e2e coverage, but no runbook and no full phase validation | Deferred | original acceptance not met | Later hardening after Milestones 2-8 begin landing |
| Historical Prompt 11 | OpenAI foundation | not implemented | Superseded | direct AI plumbing is no longer the next step; deterministic contracts come first | Milestones 3-5 after M2 foundation |
| Historical Prompt 12 | bounded hardening pass | not implemented as a named pass | Deferred | still useful later after new milestones land | Later hardening |

### Prompt reassessment summary

- Prompts `00-04C` are the verified implementation history.
- Historical Prompt `04D` remains valuable, but no longer has the highest personal value.
- Historical Prompt `05` is partially superseded by work already embedded in Prompt `02` corrections and Prompt `03` corrections.
- Historical Prompts `06-12` remain conceptually useful, but their original numeric order is no longer the right execution order.

## Technical Debt Assessment

### Blocking Debt

| Debt item | Evidence | Impact | Urgency | Recommended treatment | Blocks next milestone |
| --- | --- | --- | --- | --- | --- |
| No implemented career knowledge contract | `CareerProfileVersion` exists only in `prisma/schema.prisma`; no service/UI/reference importer in `src/` | deterministic document generation has no authoritative career facts to retrieve from | Immediate | implement `M2.1` before any parser/generation work | Yes |
| Scott-specific resume rules are not machine-readable | rules appear in historical roadmap only | scoring/composition would drift or depend on prompts | Immediate | define one authoritative structured rules representation during Milestone 2 | Yes |
| Document and AI models are model-only | `Document`, `DocumentVersion`, `AiRun` in schema only | later milestones cannot link artifacts and scoring runs cleanly yet | Immediate for later milestones, not for `M2.1` | defer schema changes until document-generation prompts inspect exact needs | No for `M2.1`, yes for rendering/package work |

### Near-Term Debt

| Debt item | Evidence | Impact | Urgency | Recommended treatment | Blocks next milestone |
| --- | --- | --- | --- | --- | --- |
| Oversized grid component | `src/components/applications/applications-grid.tsx` | maintainability risk as more grid behavior arrives | Medium | split only when next tracker slice needs it; keep document work separate instead of adding more to this component | No |
| `UserSetting` JSONB accumulation | saved views stored in `src/lib/applications/grid-view-service.ts` | preference sprawl risk and validation drift | Medium | keep strict versioned schemas and avoid unrelated preference dumping | No |
| Default-workspace resolution is hard-coded single-user behavior | `src/lib/workspace.ts` | acceptable now, but future work could accidentally assume multi-user | Medium | keep docs explicit and avoid pretending workspace switching exists | No |
| Audit coverage is missing | no `AuditEvent` writes found in `src/` | future timestamp/document actions will lack change history | Medium | add audit deliberately in later prompts that mutate high-value records | No |
| Test runtime and brittleness are growing | import/grid tests dominate runtime; e2e needed repeated server cleanup in recent work | slower iteration and more fragile CI/local feedback | Medium | keep new milestones mostly service-driven with smaller fixtures until rendering needs larger e2e coverage | No |

### Accepted Debt

| Debt item | Evidence | Impact | Urgency | Recommended treatment |
| --- | --- | --- | --- | --- |
| Placeholder navigation links | `src/lib/navigation.ts` | confusing but explicit | Low | leave until real sections exist |
| Home page still reflects Prompt 00 foundation | `src/app/page.tsx` | not harmful, but not a real Today workspace | Low | replace later when Today becomes valuable again |
| Fixture-specific import UI | `src/app/imports/page.tsx`, `src/components/imports/import-wizard.tsx` | acceptable for current local validation goals | Low | generalize only when it saves real time |

### Deferred Commercial Debt

| Debt item | Evidence | Impact | Urgency | Recommended treatment |
| --- | --- | --- | --- | --- |
| No authentication or multi-tenant isolation | local-first design plus seeded workspace only | high for hosted product, low for Scott | Low now | defer to Milestone 12 |
| No secure remote file storage abstraction in use | document storage not started | irrelevant today | Low now | design once document flows are proven locally |
| No billing/onboarding/privacy workflow | no implementation | irrelevant today | Low now | defer to commercialization milestone |

## Roadmap Assumption Review

### Assumptions that changed

| Historical assumption | Original reasoning | Current evidence | New conclusion | Roadmap consequence |
| --- | --- | --- | --- | --- |
| The tracker had to be fully finished before document generation | avoid building AI/document features before a usable tracker existed | CRUD, import, reconciliation, grid, inline editing, and saved views are already implemented | the tracker is mature enough for the next major milestone to be document-generation foundation | move to Milestone 2 now |
| Existing AI chats should remain the primary document workflow for longer | direct product generation was assumed too early and risky | the repository already has enough application/opportunity/timestamp structure to ground deterministic generation | external chats should stop being the long-term primary workflow as soon as knowledge import exists | prioritize deterministic pipeline |
| Career knowledge was not yet structured enough to matter | roadmap assumed tracker first, knowledge later | `CareerProfileVersion` model exists and docs already expect Scott-specific structured import first | structured career knowledge is now the critical missing dependency | make `M2.1` the next prompt |
| Document-generation models were future-only | they were once speculative | `Document`, `DocumentVersion`, and `AiRun` already exist in schema | the data-model direction exists, but workflows do not | use schema readiness as foundation, not as proof of completion |
| Saved views and spreadsheet usability were not implemented | older roadmap assumed grid ergonomics were still open | Prompt 04C completed saved views and layout persistence | spreadsheet usability is improved enough that remaining ergonomics no longer outrank document work | defer copy/export/calendar |
| Generic ingestion needed to precede Scott-specific generation | future marketability bias | docs and schema already prefer Scott-specific structured import before generic parsing | generic ingestion should follow a proven Scott-specific engine | keep generic ingestion later |
| Calendar and export had to precede document generation | tracker completeness bias | both remain unimplemented, but their time-saving value is lower than targeted resume/package generation | do not block document work on calendar/export | move them to Milestone 9 |
| Commercial architecture needed early attention | fear of local-first dead ends | current repo is explicitly local-first and still cleanly layered enough for later expansion | commercialization remains important but not urgent | defer to Milestone 12 |
| Prompt numbering represented permanent priority | the roadmap encoded sequence as prompt numbers | repository and product value now disagree with that sequence | prompt numbers are traceability only | adopt milestone-aware numbering |
| Every Phase 1 feature had equal value | broad tracker backlog treated as a flat phase | current personal-use value differs sharply between tracker polish and document automation | prioritize by real manual burden | restructure backlog around outcomes |
| Document generation was a single monolithic future phase | simplified long-term planning | the repository is ready for smaller vertical slices with stable contracts | break it into milestone-aware slices | define `M2.1`, `M2.2`, `M3.1`, etc. |

### Assumptions that remain valid

- local personal use still outranks early hosted-product concerns
- PostgreSQL and Prisma remain the right core storage choices
- source facts, derived values, and AI suggestions must remain separate
- immutable document versions remain the correct long-term document model
- Excel compatibility still matters, even if it is no longer the very next milestone

## Revised Product Milestones

### Milestone 0 - Foundation
- Likely status: complete
- Includes repository, local runtime, Prisma, migrations, tests, seed, health, and shell

### Milestone 1 - Application Tracking Foundation
- Likely status: substantially complete
- Includes application CRUD, status history, application/import timestamp rules, Excel import preview plus reconciliation, AG Grid, inline editing, saved views, and persistent grid state
- Remaining tracker work exists, but is not automatically next

### Milestone 2 - Deterministic Career Knowledge Engine
- Next major milestone
- Includes Scott CKB import, validation, provenance, versioning, diagnostics, and read-only inspection

### Milestone 3 - Job Description Intelligence
- Intake, storage, deterministic parsing, requirement classification, and review

### Milestone 4 - Evidence Retrieval and Scoring
- Candidate evidence retrieval, scoring, ranking, and explainable match output

### Milestone 5 - Resume Composition Engine
- Structured resume schema, deterministic composition, quality checks, and truthfulness rules

### Milestone 6 - Resume Studio and Review
- Preview, provenance inspection, selective override, locking, and immutable structured versions

### Milestone 7 - Document Rendering and Artifact Versioning
- DOCX/PDF rendering, validation, file metadata, immutable `DocumentVersion` linkage

### Milestone 8 - Application Package Generation
- Resume, concise cover letter, and related application collateral attached to applications

### Milestone 9 - Daily Workflow Completion
- Calculated columns, Today, copy/export, calendar, contacts, outreach, interviews

### Milestone 10 - Analytics and Learning
- Funnel, source, outreach, resume-variant, and package-outcome analytics

### Milestone 11 - Generic Ingestion
- Generic resume/document ingestion and conflict resolution for non-Scott users

### Milestone 12 - Commercial Product Foundation
- Authentication, tenant isolation, secure storage, onboarding, privacy controls, billing readiness

## Vertical Slice Requirement

Document generation must not be handled as one giant prompt.

Recommended vertical-slice sequence:
1. `M2.1 - Career Knowledge Contract and Versioned Scott CKB Import`
2. `M2.2 - Career Knowledge Validation and Read-Only Inspection`
3. `M3.1 - Job Description Intake and Persistence`
4. `M3.2 - Deterministic Job Description Parser`
5. `M3.3 - Requirement Review and Correction`
6. `M4.1 - Evidence Retrieval Contract`
7. `M4.2 - Evidence Scoring Engine`
8. `M4.3 - Explainable Match Report`
9. `M5.1 - Structured Resume Contract`
10. `M5.2 - Deterministic Resume Composition`
11. `M5.3 - Resume Quality and Truthfulness Checks`
12. `M6.1 - Resume Studio Read-Only Preview`
13. `M6.2 - Resume Studio Editing and Locking`
14. `M7.1 - DOCX Template and Renderer`
15. `M7.2 - Render Validation and PDF Output`
16. `M7.3 - Immutable Document Versioning and Attachment`
17. `M8.1 - Application Package Generation`
18. `M8.2 - Exact Submitted-Version Tracking`

## Scott-Specific Rules to Preserve

Current location:
- historical roadmap in `reference/Career_Operating_System_Project_Roadmap.docx`
- partially summarized in `docs/REQUIREMENTS.md`
- not yet represented in code or settings

Recommended authoritative representation:
- a structured career-knowledge import plus rules payload introduced in `M2.1`

That representation should explicitly separate:
- career facts
- verified metrics
- writing preferences
- stack-ordering rules
- experience ceilings
- target-role preferences

## Updated Implementation Prompt Order

| New prompt | Title | User workflow eliminated | Dependencies | Expected data changes | Expected UI changes | Risk | Why here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `M2.1` | Career Knowledge Contract and Versioned Scott CKB Import | repeated manual restatement of career background | Milestone 1 foundation | new career knowledge import records built on existing profile/version concepts | minimal inspection/reporting only | Medium | creates the source of truth for all later generation work |
| `M2.2` | Career Knowledge Validation and Read-Only Inspection | repeated manual checking for missing or conflicting facts | `M2.1` | validation metadata and diagnostics | read-only inspection | Low | stabilizes input before parsing/generation |
| `M3.1` | Job Description Intake and Persistence | repeated ad hoc storage of job descriptions | `M2.2` | stored job-description records or linked opportunity fields | simple intake/review surface | Low | smallest useful JD slice |
| `M3.2` | Deterministic Job Description Parser | repeated manual requirement extraction | `M3.1` | parsed requirement metadata plus parser version | parser result review | Medium | unlocks structured matching |
| `M3.3` | Requirement Review and Correction | repeated compensating edits in later resume sessions | `M3.2` | corrected classifications with source/derived separation | review/correction UI | Medium | preserves trust in parser output |
| `M4.1` | Evidence Retrieval Contract | repeated manual search for matching roles/projects | `M2.2`, `M3.3` | retrieval result contract | inspectable match list | Medium | smallest evidence slice |
| `M4.2` | Evidence Scoring Engine | repeated manual prioritization of evidence | `M4.1` | scored evidence run records | scoring report | Medium | creates deterministic ranking |
| `M4.3` | Explainable Match Report | repeated manual reasoning about why evidence fits | `M4.2` | persisted scoring outputs or run metadata | explainable report | Low | usable artifact before resume generation |
| `M5.1` | Structured Resume Contract | repeated ad hoc resume structure decisions | `M4.3` | structured resume representation | none or read-only preview | Medium | decouples logic from rendering |
| `M5.2` | Deterministic Resume Composition | repeated manual bullet/section assembly | `M5.1` | generated structured resume versions | limited preview | Medium | first true targeted-resume automation |
| `M5.3` | Resume Quality and Truthfulness Checks | repeated manual truthfulness review | `M5.2` | validation outputs | surfaced warnings | Low | protects trust before rendering |
| `M6.1` | Resume Studio Read-Only Preview | repeated manual cross-checking in external docs | `M5.3` | none required beyond structured resume | review UI | Medium | first inspectable studio slice |

## Updated Backlog Summary

- `docs/BACKLOG.md` now organizes work into `Now`, `Next`, `Later`, `Completed`, `Deferred`, and `Superseded`.
- Historical prompt numbers are preserved in a dedicated mapping section.

## Updated Project Status Summary

- `docs/PROJECT_STATUS.md` now records the current date, current milestone, last completed implementation, verified capabilities, model-only areas, debt, and the explicit statement that Prompt 04D is not automatically next.

## Document Model Readiness Review

Current models inspected:
- `Document`
- `DocumentVersion`
- `CareerProfileVersion`
- `AiRun`
- `JobOpportunity`
- `Application`

Current support level:
- `Document` / `DocumentVersion`: model-only; no upload, download, checksum workflow, version increment logic, or application UI
- `CareerProfileVersion`: model-only; good starting point for versioned Scott import, but no canonical contract or inspection flow
- `AiRun`: model-only; adequate concept for future parser/scoring/generation run metadata, but no implemented service boundary
- `JobOpportunity`: implemented for CRUD adjacency and import/application linkage, with useful fields for future job-description storage
- `Application`: implemented and stable enough to serve as the anchor for later package/version linkage

Document-generation gaps to translate into future prompts:
- missing structured-resume representation
- missing evidence-selection run model or persisted contract
- missing parser version persistence on a real job-description workflow
- missing template version model or metadata
- missing document-package relationship
- missing exact submitted-version relationship
- missing explicit career-knowledge version link on artifacts
- missing render metadata and validation metadata
- missing artifact checksum workflow in implemented code

These are roadmap items, not schema-change directives in this task.

## Career Knowledge Readiness Review

What "structured career knowledge" currently means in the repository:
- schema concept only through `CareerProfileVersion`
- documented intent in `docs/REQUIREMENTS.md`, `docs/OPENAI_DESIGN.md`, and the historical roadmap
- no imported Scott-specific JSON, no service layer, no UI, no tests

Assessment:
- Schema completeness: minimal foundation only
- Provenance: not implemented for career facts
- Confidence and confirmation: not implemented
- Conflict support: not implemented
- Version support: model exists but no workflow
- Skills evidence: not implemented
- Role/project evidence: not implemented
- Metric verification: not implemented
- Resume rules/writing preferences: documented only

Conclusion:
- the next prompt should import Scott's existing structured knowledge source directly if available
- it should not begin with generic resume parsing

## Decision

Formal decision:

Deterministic document generation is the next major capability. The project will proceed by building a Scott-specific, versioned, provenance-aware career knowledge engine first, then job-description intelligence, evidence scoring, structured resume composition, and artifact versioning before returning to lower-value tracker ergonomics.
