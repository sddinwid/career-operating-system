# July Workbook Reconciliation

Fixture: `fixtures/job_outreach_tracker-July-US.xlsx`

## Summary

- Total physical tracker rows after header: 1001
- Blank rows: 903
- Meaningful rows: 98
- Submitted applications ready to import: 18
- Opportunities ready to import without applications: 0
- Rows requiring manual review: 56
- Intentional informational skips: 24
- Duplicate rows: 0

## Grouped Issue Counts

- `MISSING_COMPANY`: 56
- `MISSING_ROLE`: 56
- `ROW_REQUIRES_REVIEW`: 56
- `FORMULA_OR_DISPLAY_ONLY_VALUE`: 24
- `DERIVED_COLUMN_CLASSIFIED`: 18
- `OUTREACH_WITHOUT_DATE`: 1

## Distinct Source Values

- Status: `Applied`
- Priority: none present in meaningful rows
- Source: no source column in the workbook
- Work arrangement: no work-arrangement column in the workbook
- Outreach stage: `Need contact`, `Ready to send outreach`

## Row-Level Reconciliation

### Submitted applications

All rows below import as `submitted_application` with `import_with_warning`. The warning is the same unless noted: derived tracker columns were classified for preview and are not imported as authoritative facts.

| Row | Company | Role | Application date | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| 4 | SpotOn | Senior Software Engineer - Python/TypeScript | 2026-07-03 | warning | Derived columns only |
| 5 | Cleerly | Sr. Software Engineer (Operational Systems Team) | 2026-07-03 | warning | Derived columns only |
| 6 | BJAK | Backend Developer | 2026-07-12 | warning | Derived columns only |
| 7 | Nebulock | Backend Engineer | 2026-07-12 | warning | Derived columns plus `OUTREACH_WITHOUT_DATE` |
| 8 | Nira Energy | Software Engineer | 2026-07-12 | warning | Derived columns only |
| 9 | Tarro | Software Engineer | 2026-07-12 | warning | Derived columns only |
| 10 | Incisive/DeepEnd Talent? | Software Engineer | 2026-07-12 | warning | Derived columns only |
| 11 | Nametag | Senior Backend Engineer | 2026-07-12 | warning | Derived columns only |
| 12 | Cohere | Software Engineer, Agents & Automations | 2026-07-12 | warning | Derived columns only |
| 13 | Conquer AI | Software Engineer | 2026-07-12 | warning | Derived columns only |
| 14 | Engine | Senior Software Engineer, Backend | 2026-07-12 | warning | Derived columns only |
| 15 | Twilio | Software Engineer | 2026-07-12 | warning | Derived columns only |
| 16 | Radley James | Full Stack Engineer | 2026-07-12 | warning | Derived columns only |
| 17 | MeritFirst | Software Engineer (New Graduates) | 2026-07-12 | warning | Derived columns only |
| 18 | TrustPlus AI | AI Engineer | 2026-07-12 | warning | Derived columns only |
| 19 | SONIFI Health | Software Engineer | 2026-07-13 | warning | Derived columns only |
| 20 | SGA | Back-End Developer | 2026-07-13 | warning | Derived columns only |
| 21 | Intelex / Fortive Careers | Software Developer | 2026-07-13 | warning | Derived columns only |

### Manual-review research rows

Rows `22-77` each received the same classification and handling:

- Sheet: `Tracker`
- Company: missing
- Role: missing
- Application date: missing
- Classification: `invalid`
- Proposed record type: `unusable`
- Recommended handling: `requires_user_review`
- Validation errors:
  - `Company is required for import.`
  - `Position or role is required for import.`
- Issue groups:
  - `MISSING_COMPANY`
  - `MISSING_ROLE`
  - `ROW_REQUIRES_REVIEW`
- Reason:
  - the row contains a usable external job link, but not enough verified fields to import as either an `Application` or a `JobOpportunity`

### Informational placeholder rows

Rows `78-101` each received the same classification and handling:

- Sheet: `Tracker`
- Company: missing
- Role: missing
- Application date: missing
- Classification: `skipped_informational`
- Proposed record type: `informational`
- Recommended handling: `skip_intentionally`
- Validation warning:
  - `Job link is display-only text without a usable hyperlink target.`
- Issue group:
  - `FORMULA_OR_DISPLAY_ONLY_VALUE`
- Reason:
  - the row only contains display-only `Job Link` text plus false tracker flags, so there is no recoverable company, role, date, or hyperlink to import
