# Data Model

The Prisma schema may adjust naming to Prisma conventions, but the relationships and semantics below are approved.

## Core entities

### Workspace

A single seeded local workspace. Included now to reduce later migration cost.

Fields: id, name, createdAt, updatedAt.

### Company

Fields: id, workspaceId, name, website, linkedinUrl, industry, notes, createdAt, updatedAt.

Unique strategy: normalized name within workspace, with manual duplicate resolution.

### JobOpportunity

Represents a job posting independent of whether an application was submitted.

Fields: id, workspaceId, companyId, title, jobUrl, source, location, workArrangement, employmentType, salaryMin, salaryMax, salaryCurrency, descriptionText, descriptionData JSONB, postedAt, capturedAt, status.

### Application

Fields: id, workspaceId, opportunityId, appliedAt, recordedAt, originalAppliedAt, jobSearchDate, status, priority, notes, archivedAt, createdAt, updatedAt.

### ApplicationStatusHistory

Fields: id, applicationId, fromStatus, toStatus, occurredAt, recordedAt, reason, source.

### Activity

Fields: id, workspaceId, applicationId nullable, companyId nullable, contactId nullable, interviewId nullable, type, occurredAt, originalOccurredAt, recordedAt, jobSearchDate, timeZone, summary, notes, metadata JSONB, createdAt.

### Contact

Fields: id, workspaceId, companyId nullable, name, title, linkedinUrl, email, emailConfidence, relationshipType, notes, createdAt, updatedAt.

### Interview

Fields: id, workspaceId, applicationId, stage, scheduledStart, scheduledEnd, timeZone, locationOrMeetingUrl, status, notes, createdAt, updatedAt.

### Document

Logical artifact record.

Fields: id, workspaceId, applicationId nullable, type, title, status, createdAt, updatedAt.

### DocumentVersion

Fields: id, documentId, versionNumber, format, originalFilename, storedFilename, storagePath, mimeType, sizeBytes, checksum, source, generatedAt, downloadedAt nullable, submittedAt nullable, metadata JSONB.

Unique: documentId plus versionNumber.

### ImportJob

Fields: id, workspaceId, filename, checksum, status, startedAt, completedAt, sheetName, mapping JSONB, summary JSONB, errorMessage.

### ImportRow

Fields: id, importJobId, sheetName, rowNumber, rawData JSONB, normalizedData JSONB, status, errorMessages JSONB, matchedApplicationId nullable.

### UserSetting

Fields: id, workspaceId, key, value JSONB, updatedAt.

Settings include local time zone and job-search cutoff.

### AuditEvent

Fields: id, workspaceId, entityType, entityId, action, occurredAt, before JSONB, after JSONB, reason.

### CareerProfileVersion

Fields: id, workspaceId, schemaVersion, sourceFilename, content JSONB, checksum, importedAt, active.

### AiRun

Fields: id, workspaceId, applicationId nullable, purpose, provider, model, promptVersion, request JSONB, response JSONB, structuredResult JSONB, status, tokenUsage JSONB, startedAt, completedAt, errorMessage.

## Derived values

Do not persist as authoritative unless a snapshot is required:

- days open
- days since last touch
- ready today
- next action
- outreach stage
- monthly totals

These are calculated through workflow/query services.

## Prisma implementation notes

- `Company.normalizedName` is added to support the approved workspace-scoped duplicate strategy and enforce uniqueness without mutating the display name.
- `Application.jobSearchDate` and `Activity.jobSearchDate` are stored as SQL `DATE` values, while actual event moments remain `DateTime` UTC timestamps.
- `AuditEvent.entityId` remains a string without a direct foreign key because audit rows must support multiple entity types without accidental cascade deletion.
- `Document.applicationId`, `Activity.applicationId`, `Activity.companyId`, `Activity.contactId`, `Activity.interviewId`, `ImportRow.matchedApplicationId`, and `AiRun.applicationId` are nullable so historical records can survive entity cleanup through `SET NULL` rather than deletion.
