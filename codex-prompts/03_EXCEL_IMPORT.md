# Prompt 03 - Excel Import

Implement a fixture-driven Excel import wizard using `fixtures/job_outreach_tracker-July-US.xlsx`.

## Requirements

- Do not modify the fixture
- Detect Tracker and Dashboard sheets
- Find the actual header row
- Preview raw and normalized rows
- Provide column mapping UI with inferred mappings
- Validate dates, URLs, statuses, priorities, emails, and row identity
- Classify derived columns instead of importing them as authoritative facts
- Detect strong and possible duplicates
- Require user confirmation before import
- Store ImportJob and ImportRow records
- Import applications, companies, opportunities, contacts, activities, interviews, and outcomes transactionally per row where practical
- Provide success, skipped, duplicate, warning, and error counts
- Permit retry of failed rows

## Acceptance criteria

- Real fixture produces a preview
- No source file changes
- Import summary is reproducible
- Reimport does not create uncontrolled duplicates
- Row-level errors identify sheet and row
- Fixture-based integration tests pass
