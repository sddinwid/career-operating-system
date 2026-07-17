# Project Status

Date: July 17, 2026

## Current Milestone

Current milestone: `Milestone 6 - Resume Studio and Review`

Prompt 04D is not automatically next.

The active implementation slice is `M6.2 - Resume Studio Comparison and Rendering Approval`, and it remains verification-pending until the required full suite is green.

## Last Completed Implementation

Last completed implementation: `M6.1 - Resume Studio Editing and Versioned Revision`.

Repository evidence:
- `src/lib/job-descriptions/service.ts`
- `src/lib/job-descriptions/actions.ts`
- `src/lib/job-descriptions/parser.ts`
- `src/lib/job-descriptions/parse-service.ts`
- `src/lib/job-descriptions/parse-actions.ts`
- `src/components/job-descriptions/job-description-form.tsx`
- `src/app/applications/[applicationId]/job-description/page.tsx`
- `src/app/job-descriptions/[jobDescriptionVersionId]/page.tsx`
- `src/app/job-descriptions/[jobDescriptionVersionId]/analysis/page.tsx`
- `tests/e2e/job-descriptions.spec.ts`

## Verified Completed Capabilities

### Production-ready for local personal use

- Repository bootstrap, local runtime, and seeded workspace foundation
  - Evidence: `README.md`, `docker-compose.yml`, `prisma/seed.ts`, `src/app/health/page.tsx`, `src/app/api/health/route.ts`
- PostgreSQL and Prisma schema foundation
  - Evidence: `prisma/schema.prisma`, `prisma/migrations/*`
- Application CRUD with archive/restore
  - Evidence: `src/lib/applications/service.ts`, `src/lib/applications/actions.ts`, `src/app/applications/new/page.tsx`, `src/app/applications/[applicationId]/edit/page.tsx`
- Status history for initial application creation and later status transitions
  - Evidence: `src/lib/applications/service.ts`, `src/lib/applications/service.test.ts`
- Application timestamp and job-search-date handling for application creation, edits, and import DATE_ONLY data
  - Evidence: `src/lib/applications/timestamps.ts`, `src/lib/applications/service.test.ts`, `src/lib/imports/service.test.ts`
- Fixture-driven import preview, reconciliation, import execution, and retry
  - Evidence: `src/lib/imports/workbook.ts`, `src/lib/imports/service.ts`, `src/components/imports/import-wizard.tsx`, `tests/e2e/imports.spec.ts`
- Applications Grid foundation, inline editing, saved views, and persisted grid state
  - Evidence: `src/components/applications/applications-grid.tsx`, `src/lib/applications/grid-view-state.ts`, `src/lib/applications/grid-view-service.ts`, `tests/e2e/applications-grid.spec.ts`
- Career knowledge contract, preserved-source import, immutable versioning, and read-only retrieval services
  - Evidence: `src/lib/career/contracts.ts`, `src/lib/career/normalize.ts`, `src/lib/career/validation.ts`, `src/lib/career/service.ts`, `scripts/career-import.ts`, `src/lib/career/service.test.ts`
- Job-description intake, immutable versioning, duplicate detection, and application linkage
  - Evidence: `src/lib/job-descriptions/service.ts`, `src/lib/job-descriptions/schemas.ts`, `src/app/applications/[applicationId]/job-description/page.tsx`, `src/app/job-descriptions/[jobDescriptionVersionId]/page.tsx`, `tests/e2e/job-descriptions.spec.ts`
- Deterministic job-description parsing with immutable parse runs, parser-version idempotency, diagnostics, and read-only analysis
  - Evidence: `src/lib/job-descriptions/parser-contract.ts`, `src/lib/job-descriptions/section-aliases.ts`, `src/lib/job-descriptions/technology-dictionary.ts`, `src/lib/job-descriptions/parser.ts`, `src/lib/job-descriptions/parse-service.ts`, `src/app/job-descriptions/[jobDescriptionVersionId]/analysis/page.tsx`, `src/lib/job-descriptions/parser.test.ts`, `src/lib/job-descriptions/parse-service.test.ts`, `tests/e2e/job-descriptions.spec.ts`
- Requirement classification, review, immutable confirmation, and revision workflow
  - Evidence: `src/lib/job-descriptions/requirement-analysis-contract.ts`, `src/lib/job-descriptions/requirement-classifier.ts`, `src/lib/job-descriptions/requirement-analysis-service.ts`, `src/lib/job-descriptions/requirement-analysis-actions.ts`, `src/app/job-descriptions/[jobDescriptionVersionId]/requirements/page.tsx`, `src/lib/job-descriptions/requirement-classifier.test.ts`, `src/lib/job-descriptions/requirement-analysis-service.test.ts`, `tests/e2e/job-descriptions.spec.ts`
- Evidence retrieval contract, immutable retrieval runs, idempotent reuse, and read-only evidence inspection
  - Evidence: `src/lib/evidence-retrieval/contract.ts`, `src/lib/evidence-retrieval/engine.ts`, `src/lib/evidence-retrieval/service.ts`, `src/lib/evidence-retrieval/actions.ts`, `src/app/job-descriptions/[jobDescriptionVersionId]/evidence/page.tsx`, `src/lib/evidence-retrieval/engine.test.ts`, `src/lib/evidence-retrieval/service.test.ts`, `tests/e2e/job-descriptions.spec.ts`
- Evidence scoring contract, immutable scoring runs, idempotent reuse, and read-only score inspection
  - Evidence: `src/lib/evidence-scoring/config.ts`, `src/lib/evidence-scoring/contract.ts`, `src/lib/evidence-scoring/engine.ts`, `src/lib/evidence-scoring/service.ts`, `src/lib/evidence-scoring/actions.ts`, `src/app/job-descriptions/[jobDescriptionVersionId]/evidence/scores/page.tsx`, `src/lib/evidence-scoring/engine.test.ts`, `src/lib/evidence-scoring/service.test.ts`, `tests/e2e/job-descriptions.spec.ts`
- Resume audit contract, immutable audit runs, idempotent reuse, and read-only rendering-readiness inspection
  - Evidence: `src/lib/resume-audit/config.ts`, `src/lib/resume-audit/contract.ts`, `src/lib/resume-audit/engine.ts`, `src/lib/resume-audit/service.ts`, `src/lib/resume-audit/actions.ts`, `src/app/job-descriptions/[jobDescriptionVersionId]/resume/audit/page.tsx`, `src/lib/resume-audit/engine.test.ts`, `src/lib/resume-audit/service.test.ts`, `tests/e2e/job-descriptions.spec.ts`
- Resume Studio draft editing, immutable finalized revisions, revision-backed audit, and successor revision lineage
  - Evidence: `src/lib/resume-revision/config.ts`, `src/lib/resume-revision/contract.ts`, `src/lib/resume-revision/engine.ts`, `src/lib/resume-revision/service.ts`, `src/app/api/resume-studio/[revisionId]/route.ts`, `src/app/api/resume-studio/[revisionId]/finalize/route.ts`, `src/components/resume-studio/resume-studio-editor.tsx`, `src/app/job-descriptions/[jobDescriptionVersionId]/resume/studio/page.tsx`, `src/lib/resume-revision/engine.test.ts`, `src/lib/resume-revision/service.test.ts`, `src/app/api/resume-studio/[revisionId]/finalize/route.test.ts`, `tests/e2e/job-descriptions.spec.ts`

### Complete but not yet proven in daily use

- Opportunities reuse rules based on canonical URL matching
  - Evidence: `src/lib/applications/opportunities.ts`, `src/lib/applications/service.test.ts`
- Contact creation from imported rows
  - Evidence: `src/lib/imports/service.ts`
- Interview creation from imported rows
  - Evidence: `src/lib/imports/service.ts`

## Partially Complete Capabilities

- Activities
  - Current state: created for submission, status changes, selected import events, and rejection outcomes; no activity UI or editing workflow
  - Evidence: `src/lib/applications/service.ts`, `src/lib/imports/service.ts`
- Company workspace
  - Current state: company normalization, creation, reuse, and duplicate warning exist; no Companies page
  - Evidence: `src/lib/applications/service.ts`, `src/components/applications/application-form.tsx`, `src/lib/navigation.ts`
- Imports UI
  - Current state: robust fixture-specific wizard exists; no generic workbook upload flow
  - Evidence: `src/app/imports/page.tsx`, `src/components/imports/import-wizard.tsx`
- Application detail
  - Current state: overview, status history, and job-description summary are implemented; contacts, interviews, documents, and audit sections remain absent
  - Evidence: `src/app/applications/[applicationId]/page.tsx`

## Foundation-Only Models

- `Document` and `DocumentVersion`
- `AiRun`
- `AuditEvent`

Evidence:
- `prisma/schema.prisma`
- `prisma/migrations/20260716003224_prompt01_database_foundation/migration.sql`

These models exist in schema only. No upload/download/rendering services, UI, or tests currently exercise them.

## Implemented Career Knowledge Foundation

- `CareerProfileSource`
  - Current state: immutable preserved source payload with checksum, file metadata, source version, and workspace ownership
  - Evidence: `prisma/schema.prisma`, `prisma/migrations/20260716210000_m2_1_career_knowledge_import/migration.sql`
- `CareerProfileVersion`
  - Current state: immutable canonical snapshot with contract version, importer version, validation summary, predecessor linkage, and active-version semantics
  - Evidence: `prisma/schema.prisma`, `src/lib/career/service.ts`, `src/lib/career/service.test.ts`

## Not Started or Documentation-Only

- Spreadsheet copy behavior
- Spreadsheet paste behavior
- Calculated application columns
- Excel/CSV export
- Calendar month view
- Day timeline
- Today screen
- Contacts page
- Interviews page
- Documents workspace
- Career profile inspection UI
- Resume generation
- Cover-letter generation
- Document rendering
- Application packages
- Analytics
- Authentication
- Multi-user support
- Commercialization

## Known Failures

- No verified end-to-end document workflow exists despite document-related models.
- Navigation items for `Calendar`, `Companies`, `Contacts`, `Interviews`, `Documents`, `Career Profile`, `Analytics`, and `Settings` still point to placeholder `#` links.
  - Evidence: `src/lib/navigation.ts`
- The home page is still a foundation/health landing page, not a real Today workflow.
  - Evidence: `src/app/page.tsx`

## Known Technical Debt

### Blocking debt for Milestone 3

- Career knowledge now has an implemented contract and importer, but the large standalone inspection surface is intentionally deferred.
- `Document`, `DocumentVersion`, and `AiRun` are still model-only and do not yet support deterministic generation flows.

### Near-term debt

- `UserSetting` JSONB persistence for saved views is acceptable now, but it needs careful versioning discipline as more workspace preferences accumulate.
- `getDefaultWorkspace()` encodes a single-user assumption that should remain explicit in docs until a multi-workspace strategy exists.
- `src/components/applications/applications-grid.tsx` carries substantial responsibility across rendering, persistence, and inline editing.
- Import fixtures and tests are growing heavier and already dominate unit runtime.

### Accepted personal-phase debt

- Placeholder navigation links for future sections
- No audit-event creation workflow despite `AuditEvent` schema presence
- No generic workbook upload flow

### Deferred commercial debt

- Authentication and tenant isolation
- Secure remote file storage
- Usage controls and billing readiness

## Current Automated Test Status

Latest required verification for `M6.2`:
- `npm run db:generate`
- `npx prisma migrate deploy`
- `npm run db:seed`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run build`
- `npm run lint`

Status should be updated only from the latest verified command run. Until that suite is green, `M6.2` must stay verification-pending in project status documents.

## Current Architecture Decisions

- Local-first personal release remains the governing release model.
- PostgreSQL and Prisma remain the operational core.
- Actual timestamps and derived job-search dates remain separate.
- Documents are intended to be immutable versions.
- Generic resume ingestion remains later than Scott-specific structured import.
- Deterministic document generation now takes priority over finishing every remaining tracker enhancement first.
- The large standalone `M2.2` inspection workspace is deferred while the deterministic input pipeline is completed end to end.

See `docs/DECISIONS.md`.

## Current Active Priority

The active product priority remains `M6.2 - Resume Studio Comparison and Rendering Approval`, with final completion gated on the required verification suite.

## Revised Progress Overview

- `Milestone 0 - Foundation`: complete
- `Milestone 1 - Application Tracking Foundation`: substantially complete
- `Milestone 2 - Deterministic Career Knowledge Engine`: core import foundation complete, broader inspection deferred
- `Milestone 3 - Job Description Intelligence`: complete, with `M3.1`, `M3.2`, and `M3.3` complete
- `Milestone 4 - Evidence Retrieval and Scoring`: `M4.1` complete, `M4.2` complete, `M4.3` complete
- `Milestone 5 - Resume Composition Engine`: `M5.1` complete, `M5.2` complete, `M5.3` complete
- `Milestone 6 - Resume Studio and Review`: `M6.1` complete, `M6.2` in progress and verification-pending
- `Milestones 9-12 - Remaining tracker ergonomics, analytics, generic ingestion, and commercialization`: deferred later
## Current Milestone

- M4.3 - Complete
- M5.1 - Complete
- M5.2 - Complete
- M5.3 - Complete
- M6.1 - Complete
- M6.2 - In progress, verification pending
## Resume Workflow

M6.2 adds deterministic resume comparison, audit-finding comparison, immutable rendering approval, supersession, revocation, and the rendering gate used by future document renderers. The slice should not be treated as complete until the required verification suite passes.
