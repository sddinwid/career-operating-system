# Navigation and Discovery

Date: July 19, 2026

This corrective usability slice improves navigation and discovery for workflows that were already implemented through `M8.3`. It does not start a new roadmap milestone.

## Implemented navigation map

- Today: `/`
- Applications: `/applications`
- Jobs: `/jobs`
- New Job: `/jobs/new`
- Documents: `/documents`
- Imports/Exports: `/imports`
- System Health: `/health`

Record-specific workflow pages remain accessed from their parent workspaces:

- `/applications/[applicationId]`
- `/job-descriptions/[jobDescriptionVersionId]`
- `/job-descriptions/[jobDescriptionVersionId]/analysis`
- `/job-descriptions/[jobDescriptionVersionId]/requirements`
- `/job-descriptions/[jobDescriptionVersionId]/evidence`
- `/job-descriptions/[jobDescriptionVersionId]/evidence/scores`
- `/job-descriptions/[jobDescriptionVersionId]/match-report`
- `/job-descriptions/[jobDescriptionVersionId]/resume-plan`
- `/job-descriptions/[jobDescriptionVersionId]/resume`
- `/documents/[documentVersionId]`
- `/jobs/[jobOpportunityId]/job-description`

## Deferred navigation behavior

The sidebar now keeps these as honest deferred items instead of placeholder links:

- Calendar
- Companies
- Contacts
- Interviews
- Career Profile
- Analytics
- Settings

## Jobs workspace

`/jobs` lists every workspace-owned `JobOpportunity`, including opportunities that do not yet have a linked `Application`.

This matters because `/jobs/new` can create:

- a `JobOpportunity`
- an active `JobDescriptionVersion`

without creating an `Application`.

`M8.4` extends the Jobs workspace so each row can surface:

- deterministic summary badges
- the current primary next action
- direct access to the current job description, linked application, and rendered documents when available

## Current-version selection semantics

- Current job description: active version first; otherwise latest by `versionNumber`, then `createdAt`, then `id`
- Parse links: latest successful parse for the current job-description version
- Requirement review links: latest confirmed analysis when present; otherwise latest non-superseded analysis
- Downstream readiness: derived from the stored requirement-analysis summary when available
- Retrieval, scoring, match-report, plan, composition, audit, approval, and artifact links: latest successful or approved immutable record by descending timestamp and deterministic id ordering

Failed runs are not presented as current successful outputs.

## Workflow readiness surfaces

`M8.4` adds a shared workflow-readiness panel to:

- `/`
- `/jobs`
- `/jobs/[jobOpportunityId]`
- `/applications/[applicationId]`

The shared panel and row actions only expose implemented valid actions. When a step is unavailable, the UI explains the prerequisite instead of linking to placeholder or diagnostic pages.

See [docs/WORKFLOW_READINESS.md](docs/WORKFLOW_READINESS.md) for stage rules.

## Documents workspace

`/documents` is the first usable rendered-artifact index, not the full future document-library milestone.

It lists immutable `DocumentVersion` records with:

- logical document title and type
- company and role context
- linked application when present
- format, filename, and file size
- render status, renderer version, and template version
- rendering-approval readiness
- direct download and detail actions

## Diagnostics and accessibility

- Product navigation no longer points to `/health`, `/api/health`, `#`, or empty placeholders
- System Health remains in a secondary diagnostics section
- Shared primary, secondary, text-action, active-nav, and disabled-nav styles are consolidated
- Explicit visited-link color inheritance prevents dark visited text from overriding dark primary button backgrounds
- Focus-visible states remain visible across nav and action controls
## Cover Letter Artifacts

Cover-letter render and discovery entry points now appear on Cover Letter Preview, Application detail, Job detail, and the Documents workspace. These additions reuse the existing navigation shell and document-detail/download routes instead of introducing a separate cover-letter library surface.
