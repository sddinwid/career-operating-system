# Career Operating System

Prompt 00 bootstraps a local-first Career Operating System as a Next.js modular monolith for Windows, using PostgreSQL and Prisma without authentication or cloud dependencies.

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

See [docs/JOB_DESCRIPTION_INTAKE.md](docs/JOB_DESCRIPTION_INTAKE.md) and [docs/JOB_DESCRIPTION_PARSER.md](docs/JOB_DESCRIPTION_PARSER.md) for workflow, versioning, and parser details.

## Requirement classification and review

Milestone `M3.3` adds a reviewed requirement layer on top of immutable parser output.

- Draft requirement analyses are created idempotently from the latest successful parse
- Requirements are classified into `REQUIRED`, `PREFERRED`, `CONTEXTUAL`, and `NOISE`
- Responsibilities stay separate from requirements
- Review supports kind changes, exclusions, review notes, corrected display text, and user-added requirements
- Confirmed analyses are read-only and changes require a revised successor analysis

See [docs/REQUIREMENT_CLASSIFICATION.md](docs/REQUIREMENT_CLASSIFICATION.md).

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

## M7.1 DOCX Rendering

The resume workflow now supports deterministic DOCX rendering from the active rendering approval gate.

- DOCX artifacts are stored as immutable `DocumentVersion` rows linked back to approval, audit, composition, and optional revision lineage
- Resume pages and application detail pages can render, inspect, and download the latest immutable DOCX
- Render reuse is keyed from the exact approved rendering inputs, so the same approved source reuses the existing immutable document version
- Rendering is blocked unless one active `ResumeRenderingApproval` exists for the exact application and job-description lineage
- Artifact detail lives at `/documents/[documentVersionId]`
- Downloads stream from `/api/documents/[documentVersionId]/download` with a DOCX MIME type and a sanitized suggested filename
- Artifacts are written under the local ignored storage root from `LOCAL_DATA_DIR`, not into the repository
- PDF output, attachment workflows, and broader document navigation remain later milestones

See [docs/DOCX_RENDERING.md](docs/DOCX_RENDERING.md).
