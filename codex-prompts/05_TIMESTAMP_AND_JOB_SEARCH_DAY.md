# Prompt 05 - Timestamp and Job-Search Day

Implement one centralized time service and timestamp adjustment workflow.

## Requirements

- Default timezone America/Chicago
- Default cutoff 03:00
- Persist occurredAt, originalOccurredAt, recordedAt, jobSearchDate, and timezone
- Application appliedAt follows equivalent semantics
- Quick actions: current time, prior job-search day, manual date/time
- Require an adjustment reason when changing an existing timestamp
- Create AuditEvent for changes
- Expose settings UI for timezone and cutoff
- Recalculate affected derived views after adjustment

## Required tests

- 11:59 PM
- 12:00 AM
- 2:59 AM
- 3:00 AM
- daylight-saving transitions
- manual override
- preserving original timestamp

## Acceptance criteria

- A 1:00 AM application may display under the prior job-search day while retaining the real instant
- Audit history shows what changed and why
- Time logic is not duplicated in UI components
