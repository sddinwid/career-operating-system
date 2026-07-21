# Cover Letter Rendering

M8.3 renders approved cover letters into immutable DOCX and PDF artifacts through the existing `Document` and `DocumentVersion` pipeline.

## Render Gate

- Rendering requires an active `CoverLetterApproval`.
- The approval must still point to a successful matching `CoverLetterAuditRun`.
- Blocking or needs-review audit states are rejected.
- Mutable Studio drafts are never rendered.

## Approved Sources

- `BASE_COMPOSITION` approvals render the exact immutable `CoverLetterCompositionVersion` referenced by the approval.
- `FINALIZED_REVISION` approvals render the exact immutable finalized `CoverLetterRevisionVersion` referenced by the approval.
- The renderer does not automatically switch to a newer revision.

## Canonical Model

The canonical render model includes candidate name, contact data, date, company, role, salutation, ordered employer-facing paragraphs, closing, signature name, source type, and exact approval/audit/composition/revision lineage metadata. Internal identifiers are retained only in persisted metadata and forbidden-content validation, not in employer-facing output.

## Date Policy

The rendered date comes from the approved source header date. This keeps rerenders deterministic for the same approved immutable input and avoids daily checksum churn from wall-clock rendering time.

## DOCX Behavior

- Text-based ATS-friendly structure
- Standard margins
- Deterministic spacing and paragraph ordering
- No tables, text boxes, decorative graphics, or image-based text
- Employer-facing content only

## PDF Behavior

- Direct local PDF generation from the canonical render model
- Searchable and selectable text
- Embedded Unicode-capable fonts
- One-page target enforced
- No DOCX conversion pipeline or external executables

## Validation

DOCX validation checks:

- OOXML ZIP opens
- required entries exist
- `word/document.xml` exists
- expected snippets are present
- forbidden internal fragments are absent
- UUID leakage is absent where practical
- artifact size stays within expected bounds

PDF validation checks:

- parse succeeds
- text extraction succeeds
- expected snippets are present
- output stays text-based
- no image-only content appears
- forbidden internal fragments are absent
- one-page target is met
- UUID leakage is absent where practical

## Storage and Versioning

- Artifacts are stored under relative paths in `LOCAL_DATA_DIR`
- logical `Document` identity stays grouped by company/role/application family
- immutable `DocumentVersion` rows remain format-specific
- successful renders reuse identical inputs by `renderInputChecksum`
- DOCX and PDF never reuse each other

## Revocation Behavior

Historical artifacts remain downloadable after approval revocation or supersession. New rendering is blocked unless a current active approval exists for the exact source being rendered.

## Surface Integration

- Cover Letter Preview can render and download DOCX/PDF
- Application detail shows latest cover-letter artifacts and render actions
- Job detail shows cover-letter artifact state and latest artifact links
- Documents workspace lists cover-letter artifacts alongside resumes

## Known Limitations

- Cover-letter hyperlink enrichment is still conservative and does not attempt broad OOXML hyperlink-field expansion.
- Resume artifact rendering remains on its existing persistence path; M8.3 only adds atomic temp-write behavior to the new cover-letter rendering path.
