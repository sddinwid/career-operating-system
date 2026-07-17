# Structured Resume Contract

Date: July 17, 2026

## Purpose

M5.1 adds a deterministic, immutable structured resume planning layer. It converts one exact match report plus one exact career profile version into a render-independent plan that later stages can compose into employer-facing artifacts.

This stage does not generate final prose, bullets, DOCX files, PDFs, or AI-authored output.

## Inputs

Each `StructuredResumeVersion` is derived from:

- one `CareerProfileVersion`
- one confirmed `JobRequirementAnalysis`
- one `EvidenceRetrievalRun`
- one `EvidenceScoringRun`
- one `MatchReportRun`
- one `JobDescriptionVersion`
- one optional `Application`

Plan creation is allowed only when the upstream match report succeeded and resume readiness is not `NOT_READY`.

## Versioning

- `structuredResumeContractVersion: 1.0.0`
- `resumePlanningEngineVersion: m5.1.0`
- `resumePlanningConfigurationVersion: scott-v1`

These values are persisted on every structured resume row and participate in idempotency.

## Target Configuration

The plan stores:

- target company
- target role
- target role family
- target stack family and stack rule provenance
- work arrangement and location
- page target and maximum page count
- section enablement and ordering
- role and project limits
- bullet budgets
- contact-field inclusion policy
- date and location display preferences

Supported role families:

- `GENERAL_BACKEND`
- `PYTHON_BACKEND`
- `NODE_TYPESCRIPT_BACKEND`
- `MICROSOFT_DOTNET`
- `JAVA_KOTLIN`
- `AI_AGENTIC`
- `FULL_STACK`
- `TECHNICAL_LEADERSHIP`
- `OTHER`

## Structured Plan Contents

The plan records:

- section definitions and ordering
- summary blueprint
- skill eligibility and restrictions
- role eligibility
- project eligibility
- bullet-evidence eligibility
- claims to avoid
- duplication groups
- page-budget estimates
- diagnostics

## Truthfulness and Constraints

The plan preserves structured constraints instead of final wording:

- claim restrictions from the match report
- project-only and qualification requirements
- stale-skill limitations
- experience-claim caps
- duplication controls
- expired-certification omission rules

## Persistence Model

`StructuredResumeVersion` is separate from `DocumentVersion`.

Why:

- the plan is not an employer-facing artifact
- later composition and rendering stages need a stable machine-readable contract
- immutable planning history is valuable independently of final document output

## Idempotency

The system computes a deterministic input checksum from:

- match report run id
- match report input checksum
- career profile version id
- career source checksum
- structured resume contract version
- planning engine version
- planning configuration version
- canonically serialized planning configuration

Matching successful inputs reuse the latest successful structured plan instead of creating a duplicate row.

## Privacy

The planning layer does not expose raw career source JSON or private local filesystem paths in UI surfaces. Read-only pages show structured plan outputs and source linkage metadata only.

## Known Limitations

- No final resume prose is generated in M5.1
- No deterministic bullet composition is generated in M5.1
- No DOCX or PDF rendering is generated in M5.1
- No Resume Studio editing is generated in M5.1

## Next Dependency

Next prompt:

`M5.2 - Deterministic Resume Composition`

M5.2 now consumes this plan and persists employer-facing structured resume content in `ResumeCompositionVersion` while keeping rendering out of scope.
