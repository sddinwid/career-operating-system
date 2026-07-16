# Prompt 10 - Real Fixture Validation and Personal Release

Use the actual July workbook to validate the complete Phase 1 workflow.

## Requirements

- Import into a clean local database
- Document detected headers, mappings, warnings, duplicates, and totals
- Compare web counts with workbook content
- Verify grid copy/paste into Excel
- Export full workbook and open-validation instructions
- Exercise timestamp adjustment, document upload/download, calendar, and Today screen
- Fix defects found without expanding scope
- Create `docs/PERSONAL_RELEASE_RUNBOOK.md`
- Create backup and restore instructions for PostgreSQL plus local document files

## Acceptance criteria

- Phase 1 definition of functional personal release is met
- All automated tests pass
- No high-severity known data-loss issue remains
- Runbook lets the user start, stop, back up, restore, import, and export the application
