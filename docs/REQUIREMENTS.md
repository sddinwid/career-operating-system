# Requirements

## Phase 1 goal

Replace the current monthly Excel tracker with a local web application that remains Excel-compatible and preserves the user's existing workflow.

## Functional requirements

### Applications

- Create, read, update, archive, and restore applications.
- Store company, role, job URL, source, status, priority, salary, work arrangement, location, notes, and application timestamp.
- Preserve status history.
- Allow incomplete records for rapid entry.

### Spreadsheet-style grid

- Sort, filter, resize, reorder, hide, and freeze columns.
- Copy selected cells and rows as tab-separated clipboard data.
- Paste compatible tabular data where safe.
- Save at least one default view closely resembling the uploaded tracker.

### Excel import

- Import XLSX without modifying the source file.
- Support workbook preview, sheet selection, column mapping, row validation, duplicate detection, and import summary.
- Target workbook contains `Tracker` and `Dashboard` sheets.
- Import source metadata: file name, sheet, row number, import time, and raw row snapshot.
- Recalculate derived workflow values rather than importing formulas as authoritative facts.

### Excel export

- Export all data, filtered data, selected rows, a month, or a date range.
- Generate workbook sheets: Applications, Daily Activity, Monthly Summary, Contacts, Interviews, Documents, Outcomes, Dashboard, Lookup Values.
- Make exported workbooks usable for local viewing and copying.

### Time and calendar

- Store actual occurrence timestamp, recorded timestamp, original occurrence timestamp, and derived job-search date.
- Configurable cutoff defaults to 03:00 local time.
- Activity after midnight but before cutoff may count toward the prior job-search date.
- User can manually override date/time with an audit record.
- Month calendar and chronological day timeline.

### Activities and workflow

- Separate applications from activities.
- Activity examples: submitted, contact found, LinkedIn request, message, email, response, interview, rejection, offer, follow-up, note, document generated.
- Calculate next action, due date, days open, days since last touch, and due-today state.
- Calculated recommendations may be overridden without rewriting history.

### Documents

- Upload, store, list, download, and version resumes, cover letters, application answers, interview prep, and other artifacts.
- Link documents to applications.
- Mark draft, reviewed, downloaded, submitted, superseded, or archived.
- Never overwrite an existing version.

### Career knowledge base

- Store the user's structured v3 JSON file.
- Display metadata and validation state.
- Initial release may package the knowledge base and job description for external AI use.

### OpenAI

- Use a provider abstraction.
- Store API key only in local environment variables.
- No direct OpenAI dependency is required for the tracker milestone.
- Initial OpenAI foundation should support structured output and audit metadata.

## Non-functional requirements

- Local Windows development and use.
- No login in personal release.
- PostgreSQL persists data.
- Responsive desktop-first design.
- Fast enough for daily entry and hundreds or thousands of applications.
- Import/export operations provide progress and actionable errors.
- Tests cover timezone boundaries and workbook fixtures.
