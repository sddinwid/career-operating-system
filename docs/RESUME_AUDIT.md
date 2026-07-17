# Resume Audit

Date: July 17, 2026

`M5.3` adds a deterministic, immutable audit layer on top of one exact `ResumeCompositionVersion`.

## Inputs

Each `ResumeAuditRun` references exactly:

- one `ResumeCompositionVersion`
- one linked `StructuredResumeVersion`
- one linked `CareerProfileVersion`
- one linked `MatchReportRun`
- one linked confirmed `JobRequirementAnalysis`
- one linked `JobDescriptionVersion`
- one optional `Application`

## Versioning

- `resumeAuditContractVersion: 1.0.0`
- `resumeAuditEngineVersion: m5.3.0`
- `resumeAuditConfigurationVersion: scott-v1`

## Rendering Readiness

- `READY_FOR_RENDERING`
- `READY_WITH_WARNINGS`
- `NEEDS_REVIEW`
- `BLOCKED`

Blocking findings include unsupported provenance, unsupported facts, unsafe experience claims, project-as-professional misrepresentation, expired certification misuse, ATS blockers, privacy leakage, and page-budget overflow.

## Findings

Severity:

- `ERROR`
- `WARNING`
- `INFORMATION`

Categories:

- `CONTRACT`
- `PROVENANCE`
- `TRUTHFULNESS`
- `EXPERIENCE`
- `METRIC`
- `RECENCY`
- `PROJECT_CONTEXT`
- `CERTIFICATION`
- `RELEVANCE`
- `KEYWORD`
- `DUPLICATION`
- `ATS`
- `SEVEN_SECOND_SCAN`
- `PAGE_BUDGET`
- `STYLE`
- `PRIVACY`
- `OTHER`

## Checks

The audit currently validates:

- statement provenance
- source fidelity for header, roles, education, and certifications
- truthfulness classification handling
- explicit experience claims
- metric preservation
- project context
- stale and project-only skill qualification
- claims-to-avoid enforcement
- first-third relevance visibility
- duplicate skills and bullets
- ATS-hostile characters
- privacy leakage tokens
- page-budget status

## Idempotency

The system computes a deterministic input checksum from:

- resume composition version id
- resume composition input checksum
- audit contract version
- audit engine version
- audit configuration version
- canonically serialized audit configuration

Identical inputs reuse the latest existing audit run instead of creating a duplicate row.

## UI

Routes:

- `/job-descriptions/[jobDescriptionVersionId]/resume`
- `/job-descriptions/[jobDescriptionVersionId]/resume/audit`
- application detail audit summary on `/applications/[applicationId]`

The UI is read-only. It shows status, rendering readiness, finding counts, blocking findings, warning findings, section results, statement findings, and provenance links.

## Privacy

- no raw career-source payloads in the browser
- no internal paths or checksums in employer-facing content
- no AI calls
- no `DocumentVersion` creation

## Known Limitations

- no Resume Studio editing yet
- no manual audit overrides
- no automatic finding fixes
- no DOCX or PDF rendering
- no renderer-specific pagination or layout checks yet

## Next Dependency

`M6.1 - Resume Studio Read-Only Review`
