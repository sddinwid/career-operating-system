# Architecture

## Initial topology

A single Next.js application contains:

- React user interface
- Server actions and route handlers
- Domain services
- Prisma data access
- File-system document storage
- Excel import/export adapters
- OpenAI provider adapter foundation

PostgreSQL runs locally through Docker Compose.

## Why a modular monolith

A modular monolith minimizes setup and Codex coordination cost while maintaining clear boundaries. It can later be split only if real scaling needs appear.

## Modules

- applications
- companies
- activities
- contacts
- interviews
- documents
- imports
- exports
- calendar
- workflow
- career-profile
- ai
- settings
- audit

## Career knowledge import foundation

Milestone `M2.1` adds a deterministic import pipeline:

```text
Original source JSON
  -> source validation
  -> canonical normalization
  -> semantic validation
  -> immutable source preservation
  -> immutable career-profile version snapshot
  -> read-only retrieval services
```

The implementation remains inside the modular monolith:

- `src/lib/career/contracts.ts` defines the versioned canonical contract
- `src/lib/career/normalize.ts` maps the structured source into the canonical snapshot
- `src/lib/career/validation.ts` performs structural, semantic, and privacy-oriented checks
- `src/lib/career/service.ts` handles workspace resolution, idempotency, persistence, and retrieval
- `scripts/career-import.ts` provides the local CLI entry point

The canonical snapshot is intentionally stored as validated JSONB in M2.1 rather than decomposed relational tables. That keeps the slice narrowly scoped while preserving provenance and versioning for later inspection and deterministic generation work.

## Applications grid foundation

The Prompt 04A Applications Grid is a read-only client component layered on top of the existing server-side `listApplications` query. The page still loads data in a server component and hydrates AG Grid Community with a flattened row model for client-side search, sort, filter, resize, selection, and keyboard navigation.

This preserves the existing domain and timestamp behavior while containing spreadsheet-style concerns inside the applications UI layer.

## Applications grid editing hardening

Prompt 04B keeps the AG Grid client component but routes inline edits through a server-side mutation path. The browser submits one edited field at a time to the `/api/applications/[applicationId]/grid-field` route, which validates payloads with shared Zod schemas and delegates authoritative updates to the existing applications service.

The client never writes Prisma data directly. It shows saving, success, and validation-failure states, and replaces the edited row only with authoritative server-returned data. Failed edits keep server validation authoritative and roll the visible cell back to the last saved value.

Status edits continue through the existing application update workflow, so they create status-history and activity records exactly as form edits do. Non-status edits reuse the same service path without creating synthetic status history. Timestamp edits continue using the existing precision and cutoff model, including DATE_ONLY preservation and manual job-search-date overrides.

## Applications grid saved views and state persistence

Prompt 04C extends the same client grid with workspace-owned saved views and draft layout persistence without changing application facts or Prisma schema. Preferences are stored in the existing `UserSetting` JSONB record under the `applicationsGridPreferences` key, keeping the modular-monolith shape intact while avoiding a migration for UI-only state.

The persisted record contains:

- an active view identifier
- a draft grid state for the currently active layout
- zero or more user-created saved views
- a format version for safe future migrations

Each saved state stores only the fields required to restore grid behavior:

- column order
- column width
- hidden state
- pinning
- sort state
- filter model
- archive scope
- quick-search text when intentionally saved
- deterministic scope metadata for system views such as status groups and recently-applied windows

System views are code-defined with stable identifiers and authoritative application statuses. User-created views are persisted server-side through the `/api/applications/views` route, which validates payloads with shared Zod schemas, normalizes names, rejects reserved system-view names, and verifies workspace ownership on the server.

The client autosaves draft layout state with debounce for safe refresh and return-navigation behavior, while named-view definitions still require explicit create, save-as, rename, update, reset, or delete actions. Malformed persisted JSON does not crash the grid; unsupported columns and obsolete enum filters are dropped safely while the page falls back to usable defaults and surfaces a non-blocking warning.

## Job description intake and immutable versioning

Milestone `M3.1` adds a dedicated job-description persistence path without overloading `DocumentVersion` or repurposing mutable opportunity fields as the system of record.

```text
Application or /jobs/new form
  -> shared Zod validation
  -> workspace and ownership checks
  -> deterministic text normalization
  -> checksum calculation
  -> exact-opportunity duplicate check
  -> immutable JobDescriptionVersion persistence
  -> application current-version linkage when applicable
```

The implementation remains inside the modular monolith:

- `src/lib/job-descriptions/schemas.ts` validates shared intake payloads
- `src/lib/job-descriptions/normalize.ts` performs deterministic text normalization for downstream parsing
- `src/lib/job-descriptions/checksum.ts` calculates the normalized checksum server-side
- `src/lib/job-descriptions/service.ts` handles company reuse, opportunity resolution, idempotency, version creation, superseding, and retrieval
- `src/lib/job-descriptions/actions.ts` adapts server actions to the existing UI flows

The version model is intentionally immutable:

- exact duplicate normalized text for the same opportunity reuses the existing version
- changed content creates a new version, preserves the predecessor, marks the prior active version superseded, and updates the application pointer when applicable
- writes occur transactionally so partial supersede states are rolled back on failure

The existing `JobOpportunity.descriptionText` and `descriptionData` fields remain schema-level legacy fields and are not treated as the authoritative source for `M3.1`.

## Job description deterministic parsing

Milestone `M3.2` keeps parsing inside the modular monolith and treats parsing as an immutable derived artifact rather than a mutation of preserved source text.

```text
JobDescriptionVersion.normalizedText
  -> deterministic section detection
  -> statement segmentation
  -> extraction rules
  -> Zod-validated parse contract
  -> immutable JobDescriptionParse record
  -> read-only analysis route
```

Implementation boundaries:

- `src/lib/job-descriptions/parser-contract.ts` defines the parsed-result contract
- `src/lib/job-descriptions/section-aliases.ts` centralizes heading aliases
- `src/lib/job-descriptions/technology-dictionary.ts` centralizes deterministic technology aliases
- `src/lib/job-descriptions/parser.ts` performs deterministic extraction only
- `src/lib/job-descriptions/parse-service.ts` handles workspace ownership, idempotent reuse, and immutable persistence
- `src/lib/job-descriptions/parse-actions.ts` exposes the on-demand parse action to the UI

`JobDescriptionParse` was chosen instead of mutating `JobDescriptionVersion` so the repository can preserve multiple parser versions, failed diagnostics, and parse history without rewriting the underlying source record.

## Requirement classification and review

Milestone `M3.3` adds a second immutable derived layer:

```text
JobDescriptionVersion
  -> JobDescriptionParse
  -> JobRequirementAnalysis draft
  -> user review overrides
  -> confirmed authoritative requirement set
  -> revised successor analysis when needed
```

Implementation boundaries:

- `src/lib/job-descriptions/requirement-analysis-contract.ts`
- `src/lib/job-descriptions/requirement-classifier.ts`
- `src/lib/job-descriptions/requirement-analysis-service.ts`
- `src/lib/job-descriptions/requirement-analysis-actions.ts`
- `src/app/job-descriptions/[jobDescriptionVersionId]/requirements/page.tsx`

## Evidence retrieval

Milestone `M4.1` adds a third immutable derived layer:

```text
CareerProfileVersion
  + confirmed JobRequirementAnalysis
  -> deterministic candidate lookup
  -> eligibility and restriction evaluation
  -> coverage and gap summary
  -> immutable EvidenceRetrievalRun

Milestone `M4.2` adds a fourth immutable derived layer:

```text
CareerProfileVersion
  + JobRequirementAnalysis
  + EvidenceRetrievalRun
  -> deterministic scoring configuration
  -> immutable EvidenceScoringRun
```
```

Implementation boundaries:

- `src/lib/evidence-retrieval/contract.ts`
- `src/lib/evidence-retrieval/engine.ts`
- `src/lib/evidence-retrieval/service.ts`
- `src/lib/evidence-retrieval/actions.ts`
- `src/app/job-descriptions/[jobDescriptionVersionId]/evidence/page.tsx`

The retrieval layer stays JSONB-first and inspectable. It does not rank evidence, calculate match percentages, or perform AI-based matching.

## Layering

Each module should separate:

1. Domain types and rules
2. Validation schemas
3. Application services
4. Prisma repository or queries
5. Route handlers/server actions
6. UI components

UI components must not contain core workflow calculations.

## Resume composition

Milestone `M5.2` adds an immutable resume-content layer after structured planning:

```text
StructuredResumeVersion
  + CareerProfileVersion
  -> deterministic summary and section assembly
  -> source-preserving bullet composition
  -> page-budget trimming
  -> immutable ResumeCompositionVersion
```

## Resume audit

Milestone `M5.3` adds an immutable audit layer after resume composition:

```text
ResumeCompositionVersion
  + StructuredResumeVersion
  + CareerProfileVersion
  + MatchReportRun
  -> deterministic provenance, truthfulness, relevance, ATS, scan, and page-budget checks
  -> rendering-readiness decision
  -> immutable ResumeAuditRun
```

The audit layer is read-only and render-independent. It does not mutate composed content or create document artifacts.

## Resume Studio revision layer

Milestone `M6.1` adds an editable revision layer after immutable resume composition and before rendering:

```text
ResumeCompositionVersion
  -> mutable ResumeRevisionVersion draft
  -> local deterministic revision validation
  -> immutable finalized ResumeRevisionVersion
  -> optional revision-backed ResumeAuditRun
  -> successor draft from finalized revision when more edits are needed
```

Implementation boundaries:

- `src/lib/resume-revision/contract.ts`
- `src/lib/resume-revision/config.ts`
- `src/lib/resume-revision/engine.ts`
- `src/lib/resume-revision/service.ts`
- `src/app/api/resume-studio/[revisionId]/route.ts`
- `src/app/api/resume-studio/[revisionId]/finalize/route.ts`
- `src/components/resume-studio/resume-studio-editor.tsx`
- `src/app/job-descriptions/[jobDescriptionVersionId]/resume/studio/page.tsx`

The revision layer preserves immutable upstream composition while allowing user-controlled edits in a separate version history. Draft saves remain mutable, finalized revisions become read-only, and revision-backed audit runs reuse the existing audit engine through a projection back into composition-compatible content.

## Storage

### PostgreSQL

Relational operational data, workflow state, provenance, import records, and document metadata.

### JSONB

- Raw imported rows
- Provenance metadata for job-description versions
- Parsed job-description data in later milestones
- Career knowledge snapshots and validation summaries
- AI request/response metadata
- User-configurable rule payloads

### Local filesystem

Development document files under a configurable data directory outside source-controlled application code.

## Time model

- Persist UTC instants in PostgreSQL.
- Store the relevant IANA time zone with events when needed.
- Default user zone: `America/Chicago`.
- Derive job-search date through one centralized service.
- Never derive the date independently in UI components.

## Security for local release

- Bind to localhost by default.
- No login.
- Secrets remain in `.env.local` and never enter source control.
- Validate file extensions, MIME types, and file size.
- Sanitize stored filenames.
- Do not expose raw private career source payloads through general-purpose routes or logs.
## M4.3 Explainable Match Report

The derived pipeline now extends from immutable evidence scoring into immutable match-report runs. `MatchReportRun` consumes a successful `EvidenceScoringRun`, preserves exact upstream ids, stores deterministic JSON results, and never mutates scoring, retrieval, parser, requirement, career-profile, or application records.

## M5.1 Structured Resume Contract

The derived pipeline now extends one step further into immutable structured resume planning.

```text
CareerProfileVersion
  + MatchReportRun
  -> target configuration
  -> section eligibility
  -> role and project eligibility
  -> bullet-evidence eligibility
  -> skill eligibility and restrictions
  -> page-budget estimation
  -> immutable StructuredResumeVersion
```

Implementation boundaries:

- `src/lib/structured-resume/config.ts`
- `src/lib/structured-resume/contract.ts`
- `src/lib/structured-resume/engine.ts`
- `src/lib/structured-resume/service.ts`
- `src/lib/structured-resume/actions.ts`
- `src/app/job-descriptions/[jobDescriptionVersionId]/resume-plan/page.tsx`

`StructuredResumeVersion` is intentionally separate from `DocumentVersion`. The plan is a render-independent intermediate representation for later composition work in `M5.2`, not an employer-facing artifact.
## Resume Comparison and Approval

M6.2 keeps comparison as a computed read model. Immutable resume content, immutable audits, and immutable approval rows are the only persisted sources of truth. Rendering approval is stored separately from resume content so future renderers can consume one exact approved source without mutating upstream records.
