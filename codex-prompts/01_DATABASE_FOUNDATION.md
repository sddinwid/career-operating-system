# Prompt 01 - Database Foundation

Read the repository docs and inspect the current implementation. Implement the approved Phase 1 Prisma data model.

## Scope

Add Workspace, Company, JobOpportunity, Application, ApplicationStatusHistory, Activity, Contact, Interview, Document, DocumentVersion, ImportJob, ImportRow, UserSetting, AuditEvent, CareerProfileVersion, and AiRun.

## Requirements

- Use enums where stable and strings/JSONB where user configuration must remain flexible
- Add indexes for application status/date, activity date/application, company name, document/application, and import status
- Use deletion behavior deliberately; do not cascade-delete historical documents or audit events accidentally
- Add seed data for default settings: America/Chicago and 03:00 cutoff
- Add repository helpers only where needed to prove schema usability
- Add a database diagram in `docs/DATABASE_DIAGRAM.md` using Mermaid
- Update DATA_MODEL.md for any justified implementation differences

## Acceptance criteria

- Migration runs on an empty database
- Migration can be reapplied from scratch
- Seed succeeds
- Integration test creates an opportunity, application, status history, and activity transactionally
- Typecheck and all tests pass
