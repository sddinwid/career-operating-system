# Data Model

The Prisma schema may adjust naming to Prisma conventions, but the relationships and semantics below are approved.

## Core entities

### Workspace

A single seeded local workspace. Included now to reduce later migration cost.

Fields: id, name, createdAt, updatedAt.

### Company

Fields: id, workspaceId, name, website, linkedinUrl, industry, notes, createdAt, updatedAt.

Unique strategy: normalized name within workspace, with manual duplicate resolution.

### JobOpportunity

Represents a job posting independent of whether an application was submitted.

Fields: id, workspaceId, companyId, title, jobUrl, source, location, workArrangement, employmentType, salaryMin, salaryMax, salaryCurrency, descriptionText, descriptionData JSONB, postedAt, capturedAt, status.

Implementation note: `descriptionText` and `descriptionData` remain legacy schema fields and are not the authoritative immutable job-description record introduced in `M3.1`.

### Application

Fields: id, workspaceId, opportunityId, appliedAt, recordedAt, originalAppliedAt, jobSearchDate, status, priority, notes, archivedAt, currentJobDescriptionVersionId nullable, createdAt, updatedAt.

### ApplicationStatusHistory

Fields: id, applicationId, fromStatus, toStatus, occurredAt, recordedAt, reason, source.

### JobDescriptionVersion

Immutable stored job-description source for one opportunity version.

Fields: id, workspaceId, opportunityId, sourceApplicationId nullable, predecessorId nullable, versionNumber, originalText, normalizedText, sourceUrl nullable, sourceType, sourceTitle nullable, sourceFilename nullable, capturedAt, publishedAt nullable, checksum, formatVersion, createdByWorkflow, provenance JSONB, active, supersededAt nullable, createdAt.

Unique: opportunityId plus versionNumber, and opportunityId plus checksum.

`M8.4` continues to reuse this model for both pasted and URL-previewed intake. URL retrieval does not add a second persisted source model. Instead, request URL, final URL, retrieval metadata, and bounded diagnostics are stored in `provenance` only when the user explicitly saves the reviewed text.

### JobDescriptionParse

Immutable deterministic parser run for one saved job-description version.

Fields: id, workspaceId, jobDescriptionVersionId, parserVersion, contractVersion, sourceChecksum, status, diagnostics JSONB, result JSONB nullable, createdByWorkflow, errorSummary nullable, createdAt, completedAt nullable.

Behavior:

- same job-description version plus same parser version reuses the successful existing parse
- newer parser versions create new immutable parse rows
- failed runs preserve diagnostics without overwriting prior successful rows

### JobRequirementAnalysis

Immutable reviewed requirement-analysis record linked to one exact parser result.

Fields: id, workspaceId, jobDescriptionVersionId, jobDescriptionParseId, predecessorId nullable, contractVersion, classifierVersion, sourceChecksum, parserVersion, status, analysis JSONB, diagnostics JSONB, createdByWorkflow, acknowledgement JSONB nullable, errorSummary nullable, createdAt, confirmedAt nullable, supersededAt nullable.

Behavior:

- same parse plus same classifier version reuses the existing draft or confirmed result
- confirmation preserves an authoritative reviewed set
- later corrections create successor analyses instead of mutating confirmed content

### Activity

Fields: id, workspaceId, applicationId nullable, companyId nullable, contactId nullable, interviewId nullable, type, occurredAt, originalOccurredAt, recordedAt, jobSearchDate, timeZone, summary, notes, metadata JSONB, createdAt.

### Contact

Fields: id, workspaceId, companyId nullable, name, title, linkedinUrl, email, emailConfidence, relationshipType, notes, createdAt, updatedAt.

### Interview

Fields: id, workspaceId, applicationId, stage, scheduledStart, scheduledEnd, timeZone, locationOrMeetingUrl, status, notes, createdAt, updatedAt.

### Document

Logical artifact record.

Fields: id, workspaceId, applicationId nullable, jobDescriptionVersionId nullable, type, title, status, createdAt, updatedAt.

Semantics:

- one logical document groups immutable versions for the same employer-facing artifact intent
- M7.1 uses `type=RESUME`
- document rows are scoped to one workspace and optionally one application plus one job-description lineage
- the logical row is not the file; the file always lives on `DocumentVersion`

### DocumentVersion

Fields: id, documentId, workspaceId, applicationId nullable, jobDescriptionVersionId, resumeRenderingApprovalId, resumeAuditRunId, resumeCompositionVersionId, resumeRevisionVersionId nullable, versionNumber, format, originalFilename, storedFilename, storagePath, mimeType, sizeBytes, checksum, source, renderStatus, renderContractVersion, rendererVersion, templateVersion, configurationVersion, renderInputChecksum, warningCount, validationSummary JSONB nullable, errorSummary nullable, generatedAt, downloadedAt nullable, submittedAt nullable, metadata JSONB.

Unique: documentId plus versionNumber.

Semantics:

- each row is one immutable artifact file
- M7.1 stores only successful DOCX artifacts for approved resumes
- `resumeRenderingApprovalId` links the exact approval used for rendering
- `resumeAuditRunId` links the exact audit that cleared rendering
- `resumeCompositionVersionId` and optional `resumeRevisionVersionId` preserve the exact approved content source
- `rendererVersion`, `templateVersion`, and `configurationVersion` make renderer behavior auditable
- `checksum`, `sizeBytes`, `mimeType`, and `storagePath` describe the persisted file
- `storagePath` is a relative local storage key, not an absolute filesystem path

### ImportJob

Fields: id, workspaceId, filename, checksum, status, startedAt, completedAt, sheetName, mapping JSONB, summary JSONB, errorMessage.

### ImportRow

Fields: id, importJobId, sheetName, rowNumber, rawData JSONB, normalizedData JSONB, status, errorMessages JSONB, matchedApplicationId nullable.

### UserSetting

Fields: id, workspaceId, key, value JSONB, updatedAt.

Settings include local time zone and job-search cutoff.

### AuditEvent

Fields: id, workspaceId, entityType, entityId, action, occurredAt, before JSONB, after JSONB, reason.

### CareerProfileVersion

Immutable normalized career-knowledge snapshot.

Fields: id, workspaceId, sourceId, predecessorId nullable, schemaVersion, importerVersion, sourceFilename, sourceVersion nullable, content JSONB, validationSummary JSONB, checksum, importedAt, supersededAt nullable, active.

Unique: sourceId plus schemaVersion plus importerVersion.

### EvidenceRetrievalRun

Immutable retrieval output for one exact career-profile version plus one exact confirmed requirement analysis.

Fields: id, workspaceId, careerProfileVersionId, requirementAnalysisId, jobDescriptionVersionId, applicationId nullable, contractVersion, engineVersion, careerSourceChecksum, requirementSourceChecksum, inputChecksum, status, result JSONB nullable, summary JSONB nullable, diagnostics JSONB nullable, errorSummary nullable, createdAt, completedAt nullable.

Behavior:

- same exact input checksum reuses the latest successful run
- changed career version, analysis version, contract version, or engine version creates a new immutable row
- successful runs are read-only historical artifacts

### CareerProfileSource

Immutable preserved source record for a structured career-knowledge import.

Fields: id, workspaceId, filename, fileType, mimeType, sizeBytes, checksum, sourceVersion nullable, rawPayload JSONB, createdAt.

Unique: workspaceId plus checksum.

### AiRun

Fields: id, workspaceId, applicationId nullable, purpose, provider, model, promptVersion, request JSONB, response JSONB, structuredResult JSONB, status, tokenUsage JSONB, startedAt, completedAt, errorMessage.

## Derived values

Do not persist as authoritative unless a snapshot is required:

- days open
- days since last touch
- ready today
- next action
- outreach stage
- monthly totals

These are calculated through workflow/query services.

`M8.4` adds a deterministic workflow-readiness aggregate over existing persisted records. Stage status, badges, blocking reasons, and current next actions are intentionally derived values rather than new tables.

## Prisma implementation notes

- `Company.normalizedName` is added to support the approved workspace-scoped duplicate strategy and enforce uniqueness without mutating the display name.
- `Application.jobSearchDate` and `Activity.jobSearchDate` are stored as SQL `DATE` values, while actual event moments remain `DateTime` UTC timestamps.
- `AuditEvent.entityId` remains a string without a direct foreign key because audit rows must support multiple entity types without accidental cascade deletion.
- `Document.applicationId`, `Activity.applicationId`, `Activity.companyId`, `Activity.contactId`, `Activity.interviewId`, `ImportRow.matchedApplicationId`, and `AiRun.applicationId` are nullable so historical records can survive entity cleanup through `SET NULL` rather than deletion.
- `CareerProfileSource` was added in `M2.1` because the prior schema could store a snapshot but not a clean immutable source record with checksum, file metadata, and reusable provenance.
- `CareerProfileVersion` now stores source linkage, importer version, source version, validation summary, and predecessor linkage so imports can stay idempotent while changed sources produce immutable successor versions.
- `Application.currentJobDescriptionVersionId` stores the exact job-description version currently linked to the application without mutating historical `JobDescriptionVersion` rows.
- `JobDescriptionVersion` was added in `M3.1` because job descriptions need immutable source preservation, checksum-based idempotency, predecessor linkage, and application linkage semantics that differ from `DocumentVersion`.
- `JobDescriptionParse` was added in `M3.2` because deterministic parsing needs immutable runs, persisted diagnostics, and parser-version idempotency without mutating preserved source rows.
- `JobRequirementAnalysis` was added in `M3.3` because reviewed authority, user overrides, and immutable confirmation must remain separate from parser output.
- `EvidenceRetrievalRun` was added in `M4.1` because retrieval results need exact input linkage, JSONB persistence, idempotent reuse, and immutable history without mutating career or requirement source rows.

### EvidenceScoringRun

Immutable scoring output for one exact `EvidenceRetrievalRun`.

Fields: id, workspaceId, evidenceRetrievalRunId, careerProfileVersionId, requirementAnalysisId, jobDescriptionVersionId, applicationId nullable, contractVersion, engineVersion, configurationVersion, retrievalInputChecksum, inputChecksum, status, result JSONB nullable, summary JSONB nullable, diagnostics JSONB nullable, errorSummary nullable, createdAt, completedAt nullable.

Behavior:

- same exact retrieval run plus same scoring versions and configuration reuses the latest successful scoring run
- changed retrieval run, contract version, engine version, or configuration version creates a new immutable row
- successful runs are read-only historical artifacts with factor-level explainability

- `EvidenceScoringRun` was added in `M4.2` because scoring results need separate immutable history, versioned configuration linkage, JSONB explainability, and idempotent reuse without mutating retrieval output
## MatchReportRun

`MatchReportRun` stores immutable report results with references to workspace, evidence scoring run, evidence retrieval run, career profile version, requirement analysis, job description version, and optional application. It also stores contract, engine, configuration, scoring checksum, deterministic input checksum, summary JSON, diagnostics JSON, and completion timestamps.

## CoverLetterCompositionVersion

`CoverLetterCompositionVersion` stores immutable cover-letter compositions with references to workspace, optional application, job opportunity, job description version, career profile version, requirement analysis, evidence retrieval run, evidence scoring run, match report run, optional resume composition source, optional finalized resume revision source, and optional predecessor version. It also stores contract, engine, configuration, deterministic input checksums, structured content JSON, summary JSON, diagnostics JSON, and completion timestamps.

## CoverLetterRevisionVersion

`CoverLetterRevisionVersion` stores editable and finalized cover-letter revisions derived from one exact `CoverLetterCompositionVersion`.

Fields:

- workspace, application, and exact upstream version linkage
- base cover-letter composition version id
- predecessor revision id nullable
- career profile, requirement analysis, evidence retrieval, evidence scoring, match-report, and optional resume source linkage
- revision contract, engine, and configuration versions
- content checksum and deterministic revision input checksum
- status
- content JSONB
- change set JSONB
- summary JSONB
- diagnostics JSONB
- user notes
- created, updated, finalized, and superseded timestamps

Behavior:

- the latest active draft is reused for the same base composition until finalization
- finalization freezes immutable content and preserves lineage
- successor drafts can branch from finalized revisions without mutating prior versions

## CoverLetterAuditRun

`CoverLetterAuditRun` stores immutable audit results for one exact `CoverLetterCompositionVersion` or one exact finalized `CoverLetterRevisionVersion`.

Fields:

- workspace, application, and exact upstream version linkage
- source type
- exact cover-letter composition version id
- optional exact cover-letter revision version id
- audit contract, engine, and configuration versions
- content checksum
- deterministic audit input checksum
- audit status
- rendering-readiness state
- result JSONB
- summary JSONB
- diagnostics JSONB
- error summary
- created and completed timestamps

Behavior:

- identical exact-source audit inputs reuse the latest existing audit run
- changed content checksum, changed source type, or changed audit versions create a new immutable run
- audit runs do not create `DocumentVersion` rows and do not mutate upstream records

## CoverLetterApproval

`CoverLetterApproval` records one immutable approval decision for one exact cover-letter content source and one exact audit.

Fields:

- workspace, application, and lineage linkage
- source type
- exact cover-letter composition version id
- optional exact cover-letter revision version id
- exact cover-letter audit run id
- predecessor approval id nullable
- approval contract, engine, and configuration versions
- content checksum
- audit input checksum
- status
- rendering readiness
- warning acknowledgement state
- warning and blocking counts
- optional approval note
- optional revocation reason
- approved, revoked, superseded, and created timestamps

Behavior:

- approval is stored separately from composition, revision, and audit content
- later approvals supersede prior active approvals for the same lineage
- revocation preserves history and does not mutate source content or audits

## StructuredResumeVersion

`StructuredResumeVersion` stores immutable structured resume plans with references to workspace, career profile version, requirement analysis, evidence retrieval run, evidence scoring run, match report run, job description version, optional application, and optional predecessor version.

Fields:

- contract version
- planning engine version
- planning configuration version
- match-report input checksum
- career-source checksum
- deterministic input checksum
- status
- plan JSONB
- summary JSONB
- diagnostics JSONB
- error summary
- created and completed timestamps

Behavior:

- same exact match report, career profile, contract, engine, and configuration versions reuse the latest successful plan
- changed match report, career profile, contract, engine, or configuration create a new immutable row
- successful plan rows remain read-only and are not stored as `DocumentVersion`

## ResumeCompositionVersion

`ResumeCompositionVersion` stores immutable employer-facing structured resume content with references to workspace, structured resume version, career profile version, requirement analysis, match report run, job description version, optional application, and optional predecessor version.

## ResumeAuditRun

`ResumeAuditRun` stores immutable audit results for one exact `ResumeCompositionVersion`.

Fields:

- workspace, application, and exact upstream version linkage
- audit contract, engine, and configuration versions
- resume-composition input checksum
- deterministic audit input checksum
- audit status
- rendering-readiness state
- result JSONB
- summary JSONB
- diagnostics JSONB
- error summary
- created and completed timestamps

Behavior:

- identical composed-resume and audit-version inputs reuse the latest existing audit run
- changed resume composition or audit versions create a new immutable run
- audit runs do not create `DocumentVersion` records and do not mutate upstream records

### ResumeRevisionVersion

`ResumeRevisionVersion` stores editable and finalized resume revisions derived from one exact `ResumeCompositionVersion`.

Fields:

- workspace, application, and exact upstream version linkage
- base resume composition version id
- predecessor revision id nullable
- structured resume version, career profile version, match report, requirement analysis, and job description linkage
- revision contract, engine, and configuration versions
- source input checksum and deterministic revision input checksum
- status
- content JSONB
- change set JSONB
- summary JSONB
- diagnostics JSONB
- review notes JSONB
- error summary
- created, updated, finalized, and superseded timestamps

Behavior:

- one active draft is reused for the same base composition until it is finalized
- finalization creates an immutable successor revision and marks the mutable draft superseded
- repeated finalization of the same superseded draft returns the already-created finalized successor
- revision audits link back through optional `ResumeAuditRun.resumeRevisionVersionId`

- `ResumeRevisionVersion` was added in `M6.1` because editable resume changes, local validation, finalized revision lineage, and revision-backed audits must remain separate from immutable composed resume content and from rendered document artifacts
## ResumeRenderingApproval

`ResumeRenderingApproval` records one immutable rendering decision for one exact resume content source and one exact audit. It references the upstream composition or finalized revision plus the structured resume, career profile, match report, requirement analysis, job description, and optional application lineage needed for downstream rendering verification.
## M8.3 Data Model Notes

`DocumentType.COVER_LETTER` now uses the existing `Document` and `DocumentVersion` models for immutable cover-letter artifacts. `DocumentVersion` preserves exact cover-letter lineage with nullable:

- `coverLetterApprovalId`
- `coverLetterAuditRunId`
- `coverLetterCompositionVersionId`
- `coverLetterRevisionVersionId`

Resume lineage remains intact on the same table, and successful renders continue to use relative local storage paths plus persisted checksums, MIME type, render checksum, template version, and validation summary metadata.

## M8.8 data model notes

Milestone `M8.8` does not add a new Prisma model for competencies.

- competency definitions remain source-controlled and versioned in TypeScript
- competency lineage is preserved inside immutable retrieval and scoring JSON payloads
- `EvidenceRetrievalRun.result` now carries competency catalog version, competency catalog checksum, competency mapping engine version, mapped requirement competencies, competency components, evidence cluster ids, matched competencies, restricted-evidence summary counts, and Career Knowledge Opportunities
- `EvidenceScoringRun.result` now carries competency lineage and scored candidate competency metadata so historical runs stay viewable without schema rewrites

This keeps the competency layer narrow, replayable, and aligned with the repository rule that derived artifacts remain immutable snapshots.
