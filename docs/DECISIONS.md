# Product and Architecture Decisions

## D001 - Local-only personal release

The first release runs locally. No cloud deployment or remote access is required.

## D002 - No login

The local release has no authentication UI. Data records still belong to a seeded workspace.

## D003 - Next.js modular monolith

Use a single TypeScript application to reduce setup and coordination time.

## D004 - PostgreSQL and Prisma

Operational data is relational. PostgreSQL also supports JSONB and future pgvector use.

## D005 - Actual time and job-search date are separate

After-midnight adjustments must never destroy the real timestamp.

## D006 - Activities are separate records

Application rows do not expand indefinitely with every new activity type.

## D007 - Documents are immutable versions

New versions are created instead of overwriting files.

## D008 - Excel remains a supported interface

The web grid and export preserve spreadsheet interoperability rather than forcing users to abandon Excel.

## D009 - OpenAI provider abstraction

OpenAI is the first provider, but application code depends on an internal interface.

## D010 - Deterministic document generation follows tracker foundation

The tracker no longer has to be feature-complete before document generation begins. The current application/import/grid foundation is sufficient to start deterministic document-generation work.

Consequence:
- remaining tracker ergonomics such as copy behavior, export, calendar, and Today can be deferred when they do not remove more repetitive work than deterministic application-document generation

## D011 - Generic resume ingestion is later

The personal profile is imported from the existing Scott-specific structured knowledge source first. Generic parsing for all users follows personal validation.

## D012 - Deterministic generation before prompt-only generation

The product should evolve toward deterministic, provenance-aware document generation rather than opaque prompt chains.

Consequence:
- deterministic rules and verified evidence choose eligible facts, evidence ranking, section structure, and artifact linkage
- AI may assist with parsing, wording, or review, but it is not the system of record

## D013 - Structured career knowledge precedes job-description intelligence

The next implementation milestone is a versioned Scott career knowledge contract and import flow.

Consequence:
- job-description parsing, evidence scoring, and document generation depend on a stable career knowledge foundation

## D020 - Workspace current Career Knowledge must be explicit and fixture-aware

Normal browser workflows must resolve Career Knowledge through an explicit workspace current-profile pointer plus source-purpose classification, not by whichever profile import happened last.

Rationale:

- fixture imports are required for automated tests and controlled regression scenarios
- historical immutable runs must retain their original profile lineage
- normal evidence retrieval must fail safely when only fixture data is available

## D014 - Structured resume representation precedes DOCX rendering

The system must produce a deterministic structured resume intermediate representation before building rendering pipelines.

Consequence:
- composition logic, truthfulness checks, and provenance remain inspectable independently from templates and binary files

## D015 - Evidence scoring precedes narrative generation

Evidence retrieval and ranking must exist before resume or cover-letter drafting becomes a primary workflow.

Consequence:
- unsupported claims and weak relevance are caught before narrative generation
- explainable scoring becomes a reusable contract for resume, cover letter, and application-answer workflows

## D016 - Historical prompt numbering is retained only for traceability

Future implementation planning should use milestone-aware identifiers such as `M2.1`, `M3.2`, and `M7.1`.

Consequence:
- historical prompt numbers remain useful for mapping prior work
- they no longer imply current product priority

## D017 - Career knowledge uses preserved source plus immutable snapshot storage

Milestone `M2.1` stores the original structured CKB source separately from the normalized career-profile snapshot.

Consequence:
- `CareerProfileSource` preserves checksum, file metadata, source version, and raw payload once per workspace and checksum
- `CareerProfileVersion` stores validated canonical JSONB, validation summary, contract version, importer version, and predecessor linkage
- later milestones can inspect provenance without mutating prior imported versions

## D018 - Career knowledge remains JSONB-first in M2.1

The canonical career contract is validated and versioned, but not decomposed into many relational tables yet.

Consequence:
- the import remains narrowly scoped and easier to evolve while Scott-specific source validation matures
- later milestones can project or index relational subsets only when retrieval, scoring, or analytics justify it

## D019 - Import idempotency depends on checksum and normalization semantics

Import identity must not rely on timestamps alone.

Consequence:
- same checksum with the same contract and importer versions reuses the existing immutable version
- changed source content creates a new version
- future importer or contract changes may create a new normalized version linked to the same preserved source

## D020 - The large standalone M2.2 inspection workspace is deferred

The career knowledge import and retrieval foundation is complete enough to support downstream deterministic work without first building a broad read-only inspection UI.

Consequence:
- only minimal Career Knowledge readiness visibility is added where later workflows need confirmation
- implementation priority moves to `M3.1` and `M3.2` so the end-to-end document-generation pipeline gains its second deterministic input

## D021 - Deferred shell items stay visibly deferred

Top-level workspaces that do not yet exist should not link to diagnostics, placeholders, or fake pages.

Consequence:
- the shell may show disabled `Coming later` items
- product navigation links must only point to implemented workspaces

## D022 - Job discovery is opportunity-first

Saved jobs are rediscovered from `JobOpportunity`, not from `Application`, because job-description intake can exist without an application record.

Consequence:
- `/jobs` and `/jobs/[jobOpportunityId]` aggregate workflow state around the opportunity
- unlinked opportunities remain visible instead of being hidden by application-only navigation

## D023 - Visited-link contrast is an explicit stylesheet concern

Visited links must remain readable inside button-like navigation treatments.

Consequence:
- global visited-link color inheritance is now specified instead of relying on browser defaults
- a larger inspection workspace can return later without blocking source preservation and parsing

## D021 - Job descriptions use a dedicated immutable version model

Job descriptions are not stored as `DocumentVersion` records and are not treated as mutable opportunity text fields.

Consequence:
- `JobDescriptionVersion` preserves exact source text, normalized text, checksum, source metadata, predecessor linkage, and active or superseded state
- application flows can point to the exact job-description version used without rewriting history
- later parsing can rely on a deterministic normalized source while the original pasted text remains intact

## D022 - Job-description duplicate detection is opportunity-scoped and checksum-based

The same normalized content may appear in different opportunities, but only exact duplicates within the same opportunity are idempotent.

Consequence:
- same normalized checksum on the same opportunity reuses the existing version
- changed content on the same opportunity creates a new immutable successor
- matching text across different opportunities does not merge those opportunities automatically

## D023 - Deterministic job-description parsing uses a dedicated immutable parse model

Milestone `M3.2` stores parse output in `JobDescriptionParse`, not on `JobDescriptionVersion` and not in `AiRun`.

Consequence:
- preserved source text stays immutable and separate from derived structure
- parser version and contract version can advance without rewriting history
- failed parse diagnostics survive as first-class records
- same version plus same parser version reuses the existing successful parse instead of creating duplicates
- atomic list-item preservation, hierarchical competency sections, and applicability metadata can evolve through new parser versions without rewriting older parse rows
- source-specific cleanup such as Workday wrapper-noise filtering, metadata-block extraction, education-equivalency parsing, and compound qualification decomposition belongs in the parser layer so downstream review and evidence workflows consume deterministic structured output instead of reinterpreting raw source text
- classifier-level safeguards such as compensation-line exclusion, contextual-role classification, and downstream-readiness gating belong in the requirement-analysis layer so old parse rows remain immutable while new reviewed analyses stay conservative

## D024 - Requirement review uses a dedicated immutable analysis model

Milestone `M3.3` stores reviewed requirement authority in `JobRequirementAnalysis`, not on `JobDescriptionParse`.

Consequence:
- parser output remains unchanged and inspectable
- drafts, confirmed analyses, and revised successors remain historically distinct
- user overrides live in the review layer, not the parser layer
- downstream safety remains a deterministic readiness gate derived from persisted diagnostics rather than a manual toggle

## D025 - Evidence retrieval uses a dedicated immutable run model

Milestone `M4.1` stores candidate retrieval output in `EvidenceRetrievalRun`, not on `CareerProfileVersion` and not on `JobRequirementAnalysis`.

Milestone `M4.2` stores scored evidence output in `EvidenceScoringRun`, not on `EvidenceRetrievalRun`, so retrieval remains immutable and scoring can evolve through versioned contracts, engine logic, and configuration.

Consequence:
- exact input versions remain historically linked
- successful retrieval runs can be reused idempotently
- coverage gaps, restrictions, and diagnostics stay inspectable without mutating source facts
- later scoring can build on retrieval output rather than recomputing from mutable UI state

## D029 - Evidence Retrieval UX stays presentation-layer only

The July 22, 2026 Evidence Retrieval corrective slice improves summary, ordering, bundle coverage display, duplicate clustering, and progressive disclosure without changing the immutable `EvidenceRetrievalRun` storage model.

Consequence:

- raw immutable retrieval payloads remain the system of record
- page usability improvements are computed from deterministic read models
- technical details remain available but are disclosed secondarily instead of rendered as primary content
## M4.3 Match Report Decision

Explainable match reporting is stored as `MatchReportRun` so resume-readiness, strengths, gaps, and structured guidance remain immutable, inspectable, and reusable without mutating retrieval or scoring records.

## M5.1 Structured Resume Decision

The system stores the structured resume intermediate representation in `StructuredResumeVersion`, not `DocumentVersion`.

Reasoning:

- the plan is not a rendered artifact
- later composition and rendering stages need a stable, machine-readable contract
- exact upstream linkage and idempotent reuse are first-class concerns
- immutable planning output reduces accidental drift between evidence review and later resume generation

Versioning:

- `structuredResumeContractVersion: 1.0.0`
- `resumePlanningEngineVersion: m5.1.0`
- `resumePlanningConfigurationVersion: scott-v1`

The product stores explainable match reports as immutable derived runs rather than mutating applications or scoring records. The report uses deterministic aggregation and a bounded internal `alignmentIndex` for tier assignment, but the UI does not present it as hiring probability.

## M8.1 Cover Letter Composition Decision

Cover-letter composition is stored in `CoverLetterCompositionVersion`, not `DocumentVersion`, so paragraph provenance, resume-overlap checks, deterministic reuse, and writing diagnostics remain inspectable before later editing, approval, or rendering work begins.

## M8.2 Cover Letter Studio, Audit, and Approval Decision

Editable cover-letter work is stored in `CoverLetterRevisionVersion`, deterministic checks are stored in `CoverLetterAuditRun`, and approval history is stored in `CoverLetterApproval` rather than mutating `CoverLetterCompositionVersion`.

Reasoning:

- immutable base composition must remain inspectable as the deterministic starting point
- human edits need explicit mutable-draft versus immutable-finalized state
- audit history must remain exact-source-aware for both base composition and finalized revisions
- approval must stay separate from content so later renderers can resolve one exact audited source
- cover-letter rendering is intentionally deferred, so no `DocumentVersion` coupling is introduced yet

## M5.2 Resume Composition Decision

The system stores employer-facing structured resume content in `ResumeCompositionVersion`, not `DocumentVersion`, so provenance, deterministic reuse, and immutable history remain inspectable before rendering begins.

## M5.3 Resume Audit Decision

The system stores deterministic truthfulness and rendering-readiness checks in `ResumeAuditRun`, not on `ResumeCompositionVersion` and not in `DocumentVersion`.

Reasoning:

- audit history must remain immutable and inspectable
- rendering readiness is derived, versioned workflow state rather than document metadata
- the audit must not rewrite resume content
- later rendering stages need a stable readiness contract before DOCX or PDF generation

## M6.1 Resume Studio Revision Decision

The system stores editable and finalized resume revisions in `ResumeRevisionVersion`, not on `ResumeCompositionVersion` and not in `DocumentVersion`.

Reasoning:

- composed resume content must remain immutable and inspectable as the authoritative deterministic base
- user edits, review notes, local validation, and finalized revision lineage need their own historical record
- revision-backed audits must be attributable to the revised content without mutating the base audit
- rendering should consume an explicit finalized revision state rather than an implicitly edited draft
## M6.2 Decision

Comparison output remains computed instead of persisted. Approval history is persisted separately in `ResumeRenderingApproval` so future renderers can consume exact approved content and audits without coupling rendering state to resume composition or revision rows.

## M7.1 DOCX Rendering Decision

M7.1 renders directly to OOXML DOCX using `docx` and validates the resulting ZIP container with `jszip`.

Reasoning:

- direct OOXML generation avoids introducing LibreOffice, Microsoft Word automation, or platform-specific desktop dependencies
- ZIP inspection provides a cheap integrity check for required DOCX entries before persistence and download
- local ignored storage keeps artifacts local-first and private to the workspace environment
- relative storage keys avoid leaking absolute filesystem paths into persisted metadata or URLs
- strict `getApprovedResumeForRendering(...)` dependency preserves exact approval, audit, and content lineage

## M7.2 PDF Rendering Decision

M7.2 renders PDF directly from the exact approved deterministic resume model using `pdf-lib`, embeds a Unicode-capable font, and validates the finished artifact with `pdfjs-dist` before persistence.

Reasoning:

- direct PDF generation preserves the same approval-gated contract without relying on DOCX conversion, browser screenshots, LibreOffice, or Word automation
- extracted-text validation proves the artifact remains searchable and ATS-friendly rather than rasterized
- metadata inspection prevents persisted PDFs from leaking internal revision notes or provenance-only fields
- format-specific reuse still belongs inside the existing immutable `DocumentVersion` lineage, so the requested format is part of the render-input checksum
## M8.3 Decisions

- Reused the generic `Document` and `DocumentVersion` artifact pipeline for cover letters instead of creating a separate cover-letter document model.
- Preserved the exact immutable approved source referenced by `CoverLetterApproval`; the renderer does not silently choose the latest revision.
- Reused the approved source header date as the deterministic rendered date policy so rerenders remain idempotent for the same approved input.
- Rendered PDF directly from the canonical model; DOCX is not converted to PDF through external tooling.

## D026 - Workflow readiness is computed, not persisted

Milestone `M8.4` exposes full browser-operable pipeline readiness through aggregate reads over existing immutable records instead of adding a workflow-state table.

Consequence:
- stage status is derived from exact current pointers, successful runs, confirmed analyses, approvals, and rendered artifacts
- page-specific views stay consistent because Jobs, Job detail, Application detail, and the homepage all reuse the same readiness logic
- browsing workflow state does not mutate applications, opportunities, status history, or document rows

## D027 - URL job-description retrieval stops at editable preview

Milestone `M8.4` keeps URL retrieval separate from immutable persistence. Fetching a public posting URL may populate preview text and provenance metadata, but it does not create a `JobDescriptionVersion` until the user explicitly saves the reviewed text.

Consequence:
- immutable source preservation semantics remain the same for pasted and URL-derived content
- unchanged refetches for the same opportunity still reuse existing versions by normalized checksum
- changed refetches create successor immutable versions only through the existing transactional save path

## D028 - SSRF protection is enforced inside the server-side intake route

Milestone `M8.4` performs URL retrieval server-side so private-network protections, redirect validation, response limits, and content-type filtering stay authoritative.

Consequence:
- browser code never fetches arbitrary job-posting URLs directly
- loopback, private, link-local, credential-bearing, and unsafe redirect targets are rejected before content extraction
- HTML and plain-text retrieval are supported, but JavaScript-only or authenticated pages remain an understood limitation rather than a silently partial scrape
