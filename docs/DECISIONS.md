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

## D024 - Requirement review uses a dedicated immutable analysis model

Milestone `M3.3` stores reviewed requirement authority in `JobRequirementAnalysis`, not on `JobDescriptionParse`.

Consequence:
- parser output remains unchanged and inspectable
- drafts, confirmed analyses, and revised successors remain historically distinct
- user overrides live in the review layer, not the parser layer

## D025 - Evidence retrieval uses a dedicated immutable run model

Milestone `M4.1` stores candidate retrieval output in `EvidenceRetrievalRun`, not on `CareerProfileVersion` and not on `JobRequirementAnalysis`.

Milestone `M4.2` stores scored evidence output in `EvidenceScoringRun`, not on `EvidenceRetrievalRun`, so retrieval remains immutable and scoring can evolve through versioned contracts, engine logic, and configuration.

Consequence:
- exact input versions remain historically linked
- successful retrieval runs can be reused idempotently
- coverage gaps, restrictions, and diagnostics stay inspectable without mutating source facts
- later scoring can build on retrieval output rather than recomputing from mutable UI state
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
