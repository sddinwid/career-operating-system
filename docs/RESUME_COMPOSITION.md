# Resume Composition

Date: July 17, 2026

`M5.2` converts one immutable `StructuredResumeVersion` plus one exact `CareerProfileVersion` into employer-facing structured resume content without creating DOCX or PDF artifacts.

The result is stored in `ResumeCompositionVersion` and contains:

- header fields and inclusion decisions
- professional summary sentences
- grouped skills
- professional experience entries and ordered bullets
- selected projects and ordered bullets
- education
- current certifications only
- final section ordering
- statement-level provenance
- truthfulness classifications
- diagnostics
- estimated line and page counts

Versions:

- `resumeCompositionContractVersion: 1.0.0`
- `resumeCompositionEngineVersion: m5.2.0`
- `resumeCompositionConfigurationVersion: scott-v1`

Successful compositions are immutable and reused when the structured resume version, structured-resume input checksum, career profile version, career source checksum, contract version, engine version, configuration version, and canonically serialized configuration are identical.

Routes:

- `/job-descriptions/[jobDescriptionVersionId]/resume`
- application detail composition status on `/applications/[applicationId]`

Known limitations:

- no DOCX rendering
- no PDF rendering
- no Resume Studio editing
- no automatic resume fixing
- no `DocumentVersion` output yet

Next dependency:

`M5.3 - Resume Quality and Truthfulness Checks`

M5.3 now consumes `ResumeCompositionVersion` and stores rendering-readiness findings in immutable `ResumeAuditRun` rows without mutating the composed resume content.
