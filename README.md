# Career Operating System

Prompt 00 bootstraps a local-first Career Operating System as a Next.js modular monolith for Windows, using PostgreSQL and Prisma without authentication or cloud dependencies.

## Cover Letter Composition

`M8.1` adds deterministic, immutable cover-letter composition. The repository now exposes `/job-descriptions/[jobDescriptionVersionId]/cover-letter` as a read-only preview backed by `CoverLetterCompositionVersion` rows with paragraph-level provenance and exact upstream linkage.

## Resume Composition

`M5.2` adds deterministic employer-facing resume composition on top of immutable structured resume plans. The repository now exposes `/job-descriptions/[jobDescriptionVersionId]/resume` as a read-only preview backed by immutable `ResumeCompositionVersion` rows.

## Resume Audit

`M5.3` adds a deterministic, immutable resume audit layer on top of composed resume content.

- Audit runs are stored in `ResumeAuditRun`
- Exact audit inputs reuse the latest existing audit for the same composed resume and audit versions
- The read-only audit report lives at `/job-descriptions/[jobDescriptionVersionId]/resume/audit`
- Resume preview and application detail now show audit status, rendering readiness, blocking finding count, and warning count
- The audit does not rewrite resume content, create `DocumentVersion` rows, or call AI services

## Resume Studio

`M6.1` adds editable resume revisions on top of immutable composed resume content.

- Revisions are stored in immutable `ResumeRevisionVersion` rows with draft, finalized, audited, and superseded states
- `/job-descriptions/[jobDescriptionVersionId]/resume/studio` supports draft save, local validation, finalization, revision-backed audit, and successor revision creation
- Revision finalization returns structured `400`, `404`, `409`, and `422` responses for expected domain failures instead of collapsing them into `500`
- Revision-backed audits remain separate from base-composition audits and do not mutate `ResumeCompositionVersion`
- Finalized revisions are read-only and can be audited or branched into a successor draft without rewriting upstream composition, scoring, or match-report records

See [docs/RESUME_STUDIO.md](docs/RESUME_STUDIO.md).

## Stack

- Next.js App Router with strict TypeScript
- Tailwind CSS v4
- AG Grid Community for the Applications grid
- Prisma with PostgreSQL
- Vitest for unit tests
- Playwright for end-to-end tests
- Docker Compose for local database startup

## Windows setup

Run these commands in PowerShell from the repository root:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open `http://localhost:3000` for the application shell and `http://localhost:3000/health` for the status page.

## Current Applications grid

The `/applications` page now uses an AG Grid Community table for daily review work, focused inline updates, and saved workspace views.

- Client-side quick search across company, role, location, and source
- Sortable, filterable, resizable columns
- Row selection and keyboard navigation
- Saved system views and user-created views
- Persistent column order, width, visibility, sort, filter, archive scope, and active view selection
- Inline editing for status, priority, source, location, work arrangement, salary, applied date/time, job-search date override, company, and role
- Server-validated saves with client rollback on failed edits
- Status edits reuse the existing status-history workflow
- The explicit `Open` action opens the existing application detail page
- Quick search is temporary by default and is only stored when a user explicitly saves or updates a view while search text is present

System views:

- `All Active`
- `Applied`
- `Waiting`
- `Interviewing`
- `Rejected`
- `Archived`
- `Recently Applied`

Current Prompt 04C limitations:

- No spreadsheet copy behavior, pinned columns, or bulk actions
- No export or import actions inside the grid
- No spreadsheet multi-cell workflows yet

## Job description intake and parsing

Milestones `M3.1` and `M3.2` add local, non-AI job-description capture, immutable versioning, and deterministic parsing.

- Add or replace a job description from an existing application
- Capture a saved opportunity and its first job description at `/jobs/new`
- Preserve original text, normalized text, checksum, source metadata, capture timestamp, and predecessor linkage
- Reuse an existing version only when the same normalized checksum already exists for the same opportunity
- Keep application status history and application timestamps unchanged during description intake
- Show a minimal Career Knowledge readiness indicator without exposing private career source data
- Parse a saved version on demand from the application detail page or job-description detail page
- Store immutable parser runs with parser version, contract version, diagnostics, and structured output
- Reuse the existing successful parse when the same job-description version is parsed again with the same parser version
- Inspect parsed role metadata, sections, responsibilities, qualifications, technologies, compensation, experience, education, certifications, and benefits at `/job-descriptions/[jobDescriptionVersionId]/analysis`
- Production-hardening correction on July 20, 2026: parser version `m3.2.5` keeps list-oriented sections atomic, recognizes hierarchical competency sections such as `Core Competencies > Technical Craft`, preserves level applicability, filters Workday wrapper noise, captures requisition and posted metadata, decomposes compound education or experience and tooling or certification statements into reviewable atomic items, excludes compensation boilerplate from requirements, and preserves equivalency modifiers for pasted postings such as Fieldguide and Marathon Health

See [docs/JOB_DESCRIPTION_INTAKE.md](docs/JOB_DESCRIPTION_INTAKE.md) and [docs/JOB_DESCRIPTION_PARSER.md](docs/JOB_DESCRIPTION_PARSER.md) for workflow, versioning, and parser details.

## Requirement classification and review

Milestone `M3.3` adds a reviewed requirement layer on top of immutable parser output.

- Draft requirement analyses are created idempotently from the latest successful parse
- Requirements are classified into `REQUIRED`, `PREFERRED`, `CONTEXTUAL`, and `NOISE`
- Responsibilities stay separate from requirements
- Review supports kind changes, exclusions, review notes, corrected display text, and user-added requirements
- Confirmed analyses are read-only and changes require a revised successor analysis
- Production-hardening correction on July 20, 2026: classifier version `m3.3.3` keeps senior and staff expectations level-specific, preserves atomic preferred items and technology association, shows applicability and section hierarchy in the review UI, surfaces education, certification, and equivalency metadata, excludes compensation leakage from reviewed requirements, and keeps evidence retrieval blocked until extraction coverage is adequate

See [docs/REQUIREMENT_CLASSIFICATION.md](docs/REQUIREMENT_CLASSIFICATION.md).

## Navigation and Discovery

The repository now includes a corrective navigation and discovery slice for already-implemented workflows:

- `/jobs` lists saved opportunities, including jobs without linked applications
- `/jobs/[jobOpportunityId]` aggregates the existing immutable workflow pages
- `/documents` indexes rendered immutable artifacts
- sidebar navigation links only point to implemented workspaces or visible deferred entries
- System Health remains secondary diagnostics instead of a product workspace shortcut

See [docs/NAVIGATION_AND_DISCOVERY.md](docs/NAVIGATION_AND_DISCOVERY.md).

## Evidence retrieval

Milestone `M4.1` adds deterministic candidate-evidence retrieval from one confirmed requirement analysis plus one immutable career-profile version.

- Retrieval runs are persisted immutably in `EvidenceRetrievalRun`
- The same exact input versions reuse the existing successful run
- Candidate evidence stays grouped by requirement with provenance, restrictions, recency, and professional-versus-project context
- The read-only evidence screen lives at `/job-descriptions/[jobDescriptionVersionId]/evidence`
- Application detail now surfaces retrieval readiness, reuse, and gap-aware status without showing final scores

See [docs/EVIDENCE_RETRIEVAL.md](docs/EVIDENCE_RETRIEVAL.md).

## Evidence scoring

Milestone `M4.2` adds deterministic, explainable scoring on top of one immutable evidence-retrieval run.

- Scoring runs are persisted immutably in `EvidenceScoringRun`
- Exact scoring inputs reuse the latest successful run instead of overwriting history
- Candidate evidence stays explainable through positive factors, penalties, eligibility, strength bands, and deterministic ranking
- Requirement evidence strength is shown without introducing a single overall application match percentage
- The read-only score screen lives at `/job-descriptions/[jobDescriptionVersionId]/evidence/scores`

See [docs/EVIDENCE_SCORING.md](docs/EVIDENCE_SCORING.md).

## Cover-letter workflow

Milestone `M8.1` composes concise, evidence-backed cover letters from existing authoritative artifacts.

- Successful cover-letter compositions are stored immutably in `CoverLetterCompositionVersion`
- Exact inputs reuse the latest successful cover-letter version instead of mutating prior content
- Optional resume sources are used only for deterministic overlap checks and traceability
- The preview remains read-only and does not create `DocumentVersion` records or rendered files

See [docs/COVER_LETTER_COMPOSITION.md](docs/COVER_LETTER_COMPOSITION.md).

## Verification commands

Run the full verification sequence with:

```powershell
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run test:unit
npm run test:e2e
npm run typecheck
npm run build
npm run lint
```

## Environment

The local environment is configured through `.env`:

```env
DATABASE_URL=postgresql://career_os:career_os@localhost:5433/career_os?schema=public
LOCAL_DATA_DIR=./local-data
DEFAULT_TIME_ZONE=America/Chicago
JOB_SEARCH_DAY_CUTOFF=03:00
OPENAI_API_KEY=
```

`local-data/` is reserved for local-only files and remains out of source control except for `.gitkeep`.

## Available scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run format`
- `npm run format:check`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:generate`
- `npm run career:import -- --file <path>`

## Career knowledge import

Milestone `M2.1` adds a versioned import path for Scott's structured career knowledge base.

```powershell
npm run career:import -- --file .\fixtures\career_knowledge_base_fixture_v1.json --dry-run
npm run career:import -- --file .\fixtures\career_knowledge_base_fixture_v1.json
```

Import behavior:

- Dry run validates and normalizes without database writes.
- Committed imports preserve source filename, checksum, source version, contract version, importer version, validation summary, and immutable normalized content.
- Reimporting the same checksum with the same contract and importer versions reuses the existing records instead of creating duplicates.
- Changed source content creates a new immutable career-profile version and supersedes the prior active version.
- The large standalone `M2.2` inspection workspace is intentionally deferred while deterministic downstream inputs are being completed.

Private data handling:

- The real Scott CKB source is not copied into fixtures, docs, or routine console output.
- Tests use the anonymized fixture `fixtures/career_knowledge_base_fixture_v1.json`.
- Import reports show metadata and counts only, not the raw private payload.
## Match Report

M4.3 adds a deterministic, immutable explainable match report derived from evidence scoring. It summarizes strengths, required gaps, resume readiness, and pursuit recommendation without using AI or presenting hiring probability.

## Structured Resume Plan

M5.1 adds a deterministic, immutable structured resume planning layer derived from one match report plus one career profile version.

- Plans are stored in `StructuredResumeVersion`, not `DocumentVersion`
- Exact input versions and planning versions are preserved for idempotent reuse
- The read-only inspection route lives at `/job-descriptions/[jobDescriptionVersionId]/resume-plan`
- Application detail now shows resume-planning readiness, plan existence, target role family, selected-role count, selected-project count, and budget state
- The system still does not generate final resume prose, DOCX files, PDFs, or AI-authored artifacts in this stage

See [docs/STRUCTURED_RESUME_CONTRACT.md](docs/STRUCTURED_RESUME_CONTRACT.md).
## M6.2 Resume Comparison and Approval

The resume workflow now supports deterministic comparison between immutable resume sources and a separate immutable rendering-approval history. Rendering itself is still out of scope. Future renderers must consume the active approval gate instead of choosing the latest resume content directly.

## M7.2 PDF Rendering And Validation

The resume workflow now supports deterministic PDF rendering from the active rendering approval gate with shared immutable artifact validation for both PDF and DOCX.

- PDF artifacts are rendered directly from the approved deterministic resume model without DOCX conversion, browser screenshots, LibreOffice, or Word automation
- PDF artifacts are stored as immutable `DocumentVersion` rows linked back to approval, audit, composition, and optional revision lineage
- Resume pages and application detail pages can render, inspect, and download the latest immutable PDF while still exposing the shared DOCX renderer
- Render reuse is keyed from the exact approved rendering inputs plus format, so the same approved PDF source reuses the existing immutable document version
- Rendering is blocked unless one active `ResumeRenderingApproval` exists for the exact application and job-description lineage
- Artifact validation now rejects invalid outputs before persistence and records either DOCX ZIP validation or PDF text and metadata validation on the saved version
- Artifact detail lives at `/documents/[documentVersionId]`
- Downloads stream from `/api/documents/[documentVersionId]/download` with the stored MIME type and a sanitized suggested filename
- Artifacts are written under the local ignored storage root from `LOCAL_DATA_DIR`, not into the repository

See [docs/PDF_RENDERING.md](docs/PDF_RENDERING.md) and [docs/DOCX_RENDERING.md](docs/DOCX_RENDERING.md).
