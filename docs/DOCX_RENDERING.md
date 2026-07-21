# DOCX Rendering

M7.1 introduced deterministic DOCX rendering, and M7.2 keeps DOCX inside the shared multi-format rendering contract.

## Rendering Input Contract

- input comes from `getApprovedResumeForRendering(...)`
- the gate resolves the exact approval, exact audit, exact approved content, and exact content checksum
- render reuse keys from approval id, audit id, source type, source id, checksum, and renderer/template/config versions

## Gate Requirements

- one active rendering approval must exist
- the approval must match the current application and job-description lineage
- the approved source must match the audit lineage and checksum validated by the gate
- blocked, needs-review, or mutable sources remain ineligible before rendering starts

## Libraries

- DOCX generation: `docx`
- ZIP and OOXML validation: `jszip`

## Versions

- render contract version: `1.1.0`
- renderer version: `m7.2.0`
- template version: `resume-docx-v1`
- configuration version: `local-first-v1`

## ATS Layout Decisions

- DOCX remains one shared output format
- plain text-forward structure with standard headings
- no images, tables, columns, or decorative layout dependencies
- section order comes from the approved resume content

## Page Size And Margins

- Word default page size is used
- margins are set to 720 twips on all sides, which is 0.5 inches

## Typography

- M7.1 sets paragraph sizes and emphasis but does not pin a custom font family
- header name uses size `30`
- contact line uses size `20`
- section headings use size `24`
- summary, skills, role headings, and education/project text use sizes `20-22`

## Section Rendering

- header renders the candidate name and one compact contact line
- professional summary renders as a single paragraph when present
- core skills render group label plus a pipe-separated skill list
- professional experience renders one heading, one metadata line, and bullet paragraphs
- selected projects render similarly to roles when included upstream
- education and certifications render as simple text rows

## Bullet Rendering

- experience and project bullets render as standard level-0 DOCX bullets
- bullet text is copied from approved employer-facing content only

## Hyperlinks

- M7.1 does not create DOCX hyperlink fields yet
- contact links render as plain text values

## Filename Rules

- filenames derive from candidate name, company, role, and version number
- filename segments are normalized and sanitized to letters, numbers, underscores, periods, and dashes
- downloads use sanitized suggested filenames ending in `.docx`

## Local Storage

- persisted storage uses `LOCAL_DATA_DIR`
- `storagePath` stores only a relative key such as `artifacts/documents/<workspace>/<document>/<file>`
- absolute filesystem paths are not persisted or exposed through the route

## Temporary-File Behavior

- M7.1 does not use a separate temp file path
- it creates the destination directory, writes the file at the final relative key, and deletes the file if the transaction fails

## Atomic Move

- no OS-level atomic rename step exists in M7.1
- current protection is transaction-coupled cleanup plus checksum and size validation on download

## Checksum And File-Size Validation

- render persistence stores SHA-256 checksum and byte size on `DocumentVersion`
- download re-reads the file and rejects size or checksum mismatches before streaming bytes

## OOXML Validation

- render persistence opens the buffer as a ZIP container with `jszip`
- required entries are `[Content_Types].xml`, `_rels/.rels`, and `word/document.xml`
- validation summary is stored on `DocumentVersion`

## Document Behavior

- `Document` is the logical artifact record
- one document can own many immutable versions
- M7.1 creates or reuses one logical resume document per workspace, application, job-description lineage, and title

## DocumentVersion Behavior

- each `DocumentVersion` is immutable
- lineage includes approval, audit, base composition, and optional finalized revision
- metadata also stores renderer/template/config versions and render-input checksum

## Idempotency

- identical approved inputs reuse the latest successful `DocumentVersion`
- changed approval, changed audit, changed approved content, or changed renderer metadata create a new version

## Download Route

- route: `/api/documents/[documentVersionId]/download`
- success returns DOCX bytes, MIME type, content length, and safe content disposition
- missing version, missing file, not-ready version, and checksum or size mismatches return structured error responses

## Artifact History

- artifact detail route: `/documents/[documentVersionId]`
- the page shows lineage, validation, and current version history for the logical document

## Privacy

- local storage remains ignored from git
- browser and artifact tests use anonymized fixture data
- employer-facing DOCX content excludes internal revision notes, audit findings, provenance metadata, and internal fixture ids

## Known Limitations

- no hyperlink fields
- no temp-file plus atomic move flow
- no attachment package workflow yet

## Shared Contract

M7.2 reuses the same approval gate, format-aware render-input checksum, immutable artifact lineage, relative local storage, and download integrity checks for DOCX and PDF.
## Cover Letter DOCX

M8.3 adds ATS-friendly cover-letter DOCX rendering with restrained text-only layout, standard margins, deterministic paragraph order, and no draft or internal provenance leakage. Validation checks the OOXML package, `word/document.xml`, required content snippets, forbidden internal fragments, UUID leakage, and artifact size before persistence.
