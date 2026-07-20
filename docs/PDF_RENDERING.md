# PDF Rendering

M7.2 adds deterministic direct PDF rendering on top of the existing rendering approval gate and immutable artifact model.

## Rendering Input Contract

- input comes from `getApprovedResumeForRendering(...)`
- the gate resolves the exact approval, exact audit, exact approved content, and exact content checksum
- render reuse keys from approval id, audit id, source type, source id, checksum, requested format, and renderer/template/config versions

## Gate Requirements

- one active rendering approval must exist
- the approval must match the current application and job-description lineage
- the approved source must match the audit lineage and checksum validated by the gate
- blocked, needs-review, or mutable sources remain ineligible before rendering starts

## Libraries

- PDF generation: `pdf-lib`
- Unicode font embedding: `@pdf-lib/fontkit`
- artifact validation and text extraction: `pdfjs-dist`

## Versions

- render contract version: `1.1.0`
- renderer version: `m7.2.0`
- template version: `resume-pdf-v1`
- configuration version: `local-first-v1`

## Output Contract

- output is generated directly as PDF, not by converting DOCX output
- the artifact must remain text selectable and searchable
- the artifact must stay ATS friendly and avoid rasterized pages
- section order comes from the approved resume content

## Typography And Layout

- output uses an embedded Unicode-capable font family
- rendering uses a plain text-forward single-column layout
- no images, tables, columns, browser screenshots, or decorative dependencies are used
- bullets render as text bullets rather than image assets

## Validation

- validation runs before `DocumentVersion` persistence
- validation extracts text from every PDF page and confirms expected resume headings and approved content snippets are present
- validation rejects PDFs with image paint operators because the output must not be rasterized
- validation inspects persisted metadata and rejects known internal-only leakage patterns
- validation summary is stored on `DocumentVersion`

## Filename Rules

- filenames derive from candidate name, company, role, and version number
- downloads use sanitized suggested filenames ending in `.pdf`

## Local Storage

- persisted storage uses `LOCAL_DATA_DIR`
- `storagePath` stores only a relative key such as `artifacts/documents/<workspace>/<document>/<file>`
- absolute filesystem paths are not persisted or exposed through the route

## Shared Lineage

- `Document` remains the logical artifact record
- `DocumentVersion` remains immutable
- lineage includes approval, audit, base composition, optional finalized revision, format, and render-input checksum
- identical approved PDF inputs reuse the latest successful PDF version

## Browser Verification

- application detail and resume pages can render and download PDF artifacts
- the document detail page shows PDF-specific validation fields including page count, extracted text count, image operator count, and metadata checks
- end-to-end coverage downloads the PDF, extracts text, verifies required sections and bullets, checks metadata, and confirms identical PDF rerenders reuse the same immutable version

## Privacy

- local storage remains ignored from git
- browser and artifact tests use anonymized fixture data
- employer-facing PDF content excludes internal revision notes, audit findings, provenance metadata, and internal fixture ids

## Known Limitations

- no hyperlink field rendering
- no temp-file plus atomic move flow
- no attachment package workflow yet
