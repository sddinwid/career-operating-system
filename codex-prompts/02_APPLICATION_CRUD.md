# Prompt 02 - Application CRUD

Implement application and company management as the first vertical slice.

## Requirements

- Application list page
- Add application form optimized for entry in under one minute
- Edit application
- Archive and restore rather than hard delete
- Company create/reuse with normalized-name duplicate warning
- Job opportunity create/reuse
- Application status changes create status-history records
- Application detail page with overview and status history
- Zod validation
- Loading, empty, error, and success states
- Tests for services and key UI behavior

## Non-goals

- No spreadsheet grid yet
- No Excel import
- No activities beyond application-submitted and status-change events

## Acceptance criteria

- User can create an incomplete application with company, role, and date
- User can later add URL, source, salary, location, work arrangement, priority, and notes
- Status history is preserved
- Archived applications are hidden by default and restorable
- Tests, lint, typecheck, and build pass
