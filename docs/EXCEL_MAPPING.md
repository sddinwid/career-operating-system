# Excel Import and Export Mapping

## Source fixture

File: `fixtures/job_outreach_tracker-July-US.xlsx`
Sheets detected: `Tracker`, `Dashboard`.

## Import principles

- Read the Tracker sheet as the primary row source.
- Dashboard is reference output, not authoritative source data.
- Detect the actual header row rather than assuming row 1.
- Preserve raw values and row number.
- Normalize dates carefully because Excel cells may contain true dates, text dates, or formulas.
- Never evaluate a displayed calculated column as a permanent fact if the application can derive it.

## Conceptual mapping

- Status -> Application.status
- Date of Application -> Application.appliedAt and jobSearchDate
- Company -> Company.name
- Position/Role -> JobOpportunity.title
- Job link -> JobOpportunity.jobUrl
- Job source -> JobOpportunity.source
- Recruiter/contact name -> Contact.name
- Recruiter LinkedIn -> Contact.linkedinUrl
- Recruiter email -> Contact.email
- LinkedIn request/message/response dates -> Activity records
- Email/follow-up/response dates -> Activity records
- Interview stage/date -> Interview and Activity records
- Rejection date/reason -> status history and Activity metadata
- Priority -> Application.priority
- Notes -> Application.notes

## Derived columns

The following should be recalculated by services:

- Outreach stage
- Last touch
- Next step
- Due date
- Days open
- Days since last touch
- Ready today

## Duplicate detection

Strong match:
- normalized company + normalized role + application date within one day

Possible match:
- normalized company + normalized role
- identical job URL

Never auto-merge uncertain rows.

## Export

The Applications sheet should closely resemble the user-facing grid. Calculated fields are exported as values. A later optional mode may export formulas.
