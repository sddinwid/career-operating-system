# Requirements

## Corrective Navigation and Discovery Requirements

- Implement truthful top-level navigation for currently usable workspaces only
- Expose `/jobs` so saved opportunities without linked applications remain discoverable
- Expose `/jobs/[jobOpportunityId]` as a read-only workflow aggregator
- Expose `/documents` as an initial rendered-artifact index
- Keep System Health secondary diagnostics rather than a primary product destination
- Preserve deterministic current-version selection semantics for job descriptions and downstream immutable records
- Keep deferred workspaces visible only as honest disabled items or hide them
- Maintain readable visited-link, focus, and button contrast behavior

## Product goal

Eliminate Scott's repetitive career-management work in a local-first application.

Priority order:
1. Frequency of the manual task
2. Time saved per use
3. Reduction in repeated cognitive work
4. Reuse of existing architecture and data
5. Truthfulness and provenance
6. Personal daily usefulness
7. Completion of the full product vision
8. Long-term commercial viability

## Current product direction

The tracker foundation is now substantial enough that the next major milestone is deterministic application-document generation, not finishing every remaining tracker enhancement first.

The system must move toward:

```text
Career Knowledge Base
  -> Job Description Intake
  -> Deterministic Job Description Parser
  -> Requirement Classification
  -> Evidence Retrieval
  -> Evidence Scoring
  -> Structured Resume Composition
  -> Truthfulness and ATS Checks
  -> Resume Studio
  -> Artifact Rendering
  -> Immutable Document Versioning
  -> Application Package Tracking
```

## Functional requirements

### Tracker foundation

- Create, read, update, archive, and restore applications.
- Store company, role, job URL, source, status, priority, salary, work arrangement, location, notes, and application timestamp.
- Preserve status history.
- Allow incomplete records for rapid entry.
- Support spreadsheet-style sorting, filtering, resizing, reordering, hiding, saved views, and persistent layout state.
- Import the July workbook fixture through preview, mapping, reconciliation, duplicate detection, row-level review, and transactional row import.

### Deterministic career knowledge engine

- Store Scott's structured career knowledge in a versioned canonical contract.
- Preserve source provenance, checksum, schema version, and import diagnostics.
- Distinguish source facts, confirmed facts, derived values, and AI suggestions.
- Represent employers, roles, projects, skills, education, accomplishments, metrics, and writing or ordering rules.
- Provide read-only inspection and diagnostics before generation features depend on it.
- Preserve the original imported source separately from the normalized canonical snapshot.
- Keep committed imports idempotent by checksum plus contract and importer version semantics.
- Reject blocking validation failures without partial writes.

### Job description intelligence

- Persist original job-description text and its normalized record.
- Parse normalized saved job descriptions deterministically with no AI calls.
- Parse company, title, location, compensation, responsibilities, required skills, preferred skills, domain, and seniority.
- Treat Workday-style wrapper chrome, metadata chips, duplicate company footers, and reserved `About the Job` headings as non-content unless they are deterministically mapped into structured metadata.
- Preserve atomic list items for responsibilities, competency lines, and preferred qualifications unless deterministic wrapped-line signals prove continuation.
- Decompose compound qualification paragraphs into independently reviewable degree, experience, methodology, tooling, and certification items when the source expresses distinct candidate expectations, while preserving shared provenance and equivalency modifiers.
- Recognize hierarchical competency and conditional-expectation sections, including canonical heading, parent section, hierarchy depth, list orientation, and applicability.
- Persist requisition id, posted text, and education-equivalency language when those fields are explicitly present in the source text.
- Track parser version and separate source text from derived structure.
- Preserve immutable parse diagnostics and support read-only inspection before corrections or downstream generation.
- Support review and correction before downstream generation uses parsed output.
- Store reviewed authoritative requirements separately from parser output.
- Preserve level applicability and contextual role-location guidance through reviewed requirement persistence and UI display.
- Exclude compensation ranges, offer-variation disclaimers, and similar compensation boilerplate from reviewed requirement sets while preserving them in parse metadata.
- Support categories, requirement kinds, exclusions, review notes, and user-added requirements.
- Require explicit confirmation before downstream evidence retrieval consumes the reviewed set.
- Keep downstream evidence retrieval blocked when merged-item or extraction-coverage diagnostics indicate the reviewed set is not yet downstream-safe.
- Require downstream evidence scoring to remain deterministic, explainable, read-only, and free of a single overall match percentage until requirement aggregation is separately designed.

### Evidence retrieval and scoring

- Retrieve candidate evidence from verified career knowledge.
- Persist immutable evidence-retrieval runs tied to one exact confirmed requirement analysis and one exact career-profile version.
- Expose candidate evidence, restrictions, provenance, recency, and coverage gaps in a read-only inspection flow before scoring.
- Score evidence using recency, professional-versus-project weighting, verified metrics, responsibility match, architecture match, domain match, and Scott-specific stack-ordering rules.
- Never select unsupported evidence silently.
- Produce explainable evidence-selection results that can be inspected before rendering documents.

### Structured resume and application package generation

- Build a deterministic structured resume representation before DOCX or PDF rendering.
- Enforce truthfulness, experience ceilings, duplication limits, and section ordering rules.
- Generate immutable, versioned artifacts linked to their source versions and target application.
- Support resume, cover letter, application-answer, and related package artifacts as separate but linked outputs.
- Cover-letter generation must remain deterministic, provenance-aware, concise, and versioned separately from rendered artifacts.
- Cover-letter revisions must preserve immutable base composition and explicit predecessor-successor lineage.
- Cover-letter audit must remain deterministic, immutable, and exact-source-aware for both base composition and finalized revisions.
- Cover-letter approval must reject mutable drafts, source-audit mismatches, checksum mismatches, and blocking audit findings.

### Spreadsheet compatibility and later tracker ergonomics

- Keep Excel interoperability as a first-class requirement.
- Later tracker slices should include copy behavior, export, calculated columns, Today workflow, calendar views, contacts, outreach, and interviews.
- Those slices remain deferred until they outrank deterministic document-generation work in personal time savings.

## Scott-specific rules

- Never invent facts.
- Separate source facts, user-confirmed facts, derived values, and AI suggestions.
- Never claim more than eight years of experience for an individual skill or technology.
- Do not exceed the job description's requested experience by more than five years where experience wording is used.
- Do not imply continuous use when use was intermittent.
- Prefer verified professional evidence over project evidence when relevance is equal.
- Prefer recent evidence.
- Prefer quantified impact when verified.
- For Python or general backend roles, prioritize Python, Node.js, TypeScript, FastAPI, NestJS, AWS, PostgreSQL, and distributed systems.
- Place Microsoft skills after the primary stack for non-Microsoft roles.
- For Microsoft roles, lead with C#, .NET, ASP.NET, SQL Server, Entity Framework, React, and TypeScript where supported.
- For Java or Kotlin roles, lead with Kotlin, Spring Boot, and Java, followed by Python or Node, then Microsoft technologies.
- For AI roles, prioritize AgentV, AI Knowledge Search, RAG, orchestration, tool invocation, evaluation, observability, PostgreSQL, pgvector, Redis, Docker, and AWS.
- Place Java and Kotlin last for non-Java roles unless the job description values them.
- Expired certifications remain reference data unless directly useful.
- Cover letters remain concise, direct, and distinct from the resume.
- Cover letters should focus on why the role matters, why the employer should talk to Scott, and what kind of engineer he is.
- Do not use em dashes in generated application writing.
- Do not keyword-stuff.
- Do not present stale skills as current without qualification.

## Non-functional requirements

- Local Windows development and use.
- No login in the personal release.
- PostgreSQL persists operational data.
- Responsive desktop-first design.
- Fast enough for daily entry and hundreds or thousands of applications.
- Import/export and generation operations must provide actionable diagnostics.
- Tests must cover timezone boundaries, fixture workbooks, and deterministic generation contracts as they are introduced.
- Generated or uploaded documents must be immutable versions.
- The system must remain usable when AI features are unconfigured or unavailable.
- Private career source data must stay out of Git fixtures, public snapshots, and routine console output.
## M4.3

The system must produce an immutable explainable match report before any resume planning stage can begin.

## M5.1

The system must produce a deterministic structured resume plan that:

- is derived from one exact match report and one exact career profile version
- preserves exact upstream linkage and planning version metadata
- defines target role family, stack rule, section order, eligibility, restrictions, and page budget
- records truthful claim constraints without generating final employer-facing prose
- remains separate from rendered document artifacts

The system must generate a read-only explainable match report from successful evidence scoring, including match tier, pursuit recommendation, resume readiness, strengths, gaps, claims to avoid, deterministic traceability, and idempotent immutable persistence.

## M5.2

The system must compose a deterministic employer-facing structured resume from a successful `StructuredResumeVersion`, preserving section ordering, statement provenance, truthfulness classifications, and immutable reuse semantics without creating `DocumentVersion` artifacts.

## M5.3

The system must produce a deterministic immutable audit from one exact `ResumeCompositionVersion` that:

- validates statement provenance and source fidelity
- blocks unsupported facts, unsupported metrics, and unsafe experience claims
- checks project context, certification handling, education fidelity, and skill qualification
- reports relevance, duplication, ATS structure, seven-second scan, page-budget, and privacy findings
- assigns explicit rendering readiness without rewriting resume content

## M6.1

The system must support a Resume Studio revision workflow that:

- opens one reusable mutable draft from one exact `ResumeCompositionVersion`
- preserves upstream composition, structured resume, match report, evidence, and audit records as immutable sources
- stores user edits, change sets, review notes, diagnostics, and local validation in a dedicated revision contract
- blocks unsupported metric, technology, years-of-experience, and required-section violations before finalization
- finalizes revisions transactionally into immutable revision versions
- returns structured `400`, `404`, `409`, and `422` responses for expected draft and validation failures
- supports revision-backed audit execution without reusing the base-composition audit for changed revised content
- supports successor draft creation from a finalized revision while preserving predecessor lineage
## M6.2 Requirements

Resume comparison must remain deterministic, derived from immutable sources, and auditable. Rendering approval must reject mutable drafts, blocked audits, needs-review audits, checksum mismatches, and stale active-approval assumptions.

## M7.1 Requirements

DOCX rendering must remain deterministic and approval-gated.

- only the exact active approved resume source may render
- rendering must not mutate resume composition, revision, audit, application, or job-description records
- rendered artifacts must persist as immutable `Document` and `DocumentVersion` records
- downloads must stream with a DOCX MIME type and sanitized filename behavior
- file integrity must be checked through persisted size and checksum metadata
- rendered output must remain ATS-friendly and text selectable

## M7.2 Requirements

PDF rendering must remain deterministic, approval-gated, and direct.

- PDF rendering must consume the same active approved resume source as DOCX rendering
- PDF output must render directly from the exact approved deterministic resume model rather than converting DOCX output
- rendered PDFs must remain searchable, selectable, Unicode-capable, and ATS-friendly
- rasterized pages, browser screenshots, LibreOffice, Microsoft Word automation, and external executables are not allowed
- artifact validation must reject invalid PDFs before any `DocumentVersion` is persisted

## M8.2 Requirements

Cover-letter editing, audit, and approval must remain deterministic and lineage-safe.

- draft editing must not mutate `CoverLetterCompositionVersion`
- finalization must create immutable `CoverLetterRevisionVersion` history
- successor drafts must preserve predecessor lineage
- audit must reuse exact matching inputs and remain read-only
- approval must require an exact matching cover-letter source plus exact matching audit
- cover-letter workflows must not create `DocumentVersion` rows in the current milestone
- identical approved PDF inputs must reuse the existing successful immutable version without changing application workflow state
