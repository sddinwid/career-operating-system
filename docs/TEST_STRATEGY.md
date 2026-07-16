# Test Strategy

## Unit tests

- Job-search-date cutoff boundaries
- Workflow next-action rules
- Duplicate matching
- Column normalization
- Filename sanitization
- Document version numbering

## Integration tests

- Prisma repositories against a test PostgreSQL database
- Import job lifecycle
- Application and status-history transactions
- Activity creation and recalculation
- Document metadata and file storage
- XLSX export contents

## Fixture tests

Use `fixtures/job_outreach_tracker-July-US.xlsx`.

Required assertions:
- Workbook opens
- Tracker and Dashboard sheets are detected
- Header row is found
- Rows are previewed without mutation
- Dates are normalized
- Formula-derived fields are classified correctly
- Import can be repeated without uncontrolled duplicates

## End-to-end tests

- Import workbook -> inspect applications -> edit row -> export workbook
- Add application after midnight -> previous job-search date -> preserve real timestamp
- Upload document -> download exact bytes -> create new version
- Add activity -> Today screen updates

## Manual checks

- Copy grid rows and paste into Excel
- Open generated XLSX in Excel
- Confirm date and currency formatting
- Verify long notes do not make the grid unusable
- Confirm local file paths remain outside source control
