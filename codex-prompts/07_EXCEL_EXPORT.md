# Prompt 07 - Excel Export

Implement polished XLSX and CSV exports.

## Requirements

- Export selected rows, filtered view, month, date range, or all data
- XLSX sheets: Applications, Daily Activity, Monthly Summary, Contacts, Interviews, Documents, Outcomes, Dashboard, Lookup Values
- Readable headers, widths, frozen rows, filters, date formats, currency formats, wrapped text only where appropriate
- Applications sheet follows the grid's current visible column order when exporting a view
- Calculated fields export as current values
- CSV export for the applications view
- Export metadata includes generated date and filter summary

## Acceptance criteria

- XLSX opens in Excel without repair warnings
- Copying from exported Applications sheet works
- Counts agree with web UI
- Fixture-based round-trip checks verify key fields
