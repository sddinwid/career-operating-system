# Explainable Match Report

M4.3 adds an immutable, deterministic `MatchReportRun` derived from a successful `EvidenceScoringRun`.

## Inputs

- Successful `EvidenceScoringRun`
- Linked `EvidenceRetrievalRun`
- Linked confirmed `JobRequirementAnalysis`
- Linked immutable `CareerProfileVersion`
- Linked `JobDescriptionVersion`
- Optional `Application`

## Versions

- Contract: `1.0.0`
- Engine: `m4.3.0`
- Configuration: `scott-v1`

## Output

The report stores:

- Match tier
- Pursuit recommendation
- Resume readiness state
- Internal `alignmentIndex`
- Requirement conclusions
- Strengths
- Risks and gaps
- Structured resume guidance
- Diagnostics

## Match Tiers

- `STRONG_ALIGNMENT`
- `GOOD_ALIGNMENT`
- `PARTIAL_ALIGNMENT`
- `WEAK_ALIGNMENT`
- `INSUFFICIENT_EVIDENCE`

These are deterministic evidence-alignment categories, not hiring predictions.

## Pursuit Recommendations

- `PRIORITIZE`
- `APPLY`
- `CONSIDER`
- `LOW_PRIORITY`
- `DO_NOT_RECOMMEND_YET`

These are workflow recommendations based on evidence coverage and gap severity.

## Resume Readiness

- `READY`
- `READY_WITH_LIMITATIONS`
- `NEEDS_REVIEW`
- `NOT_READY`

This state now gates structured resume planning in M5.1 and remains the exact upstream input for later composition work in M5.2.

## Gap Rules and Criticality

Centralized gap types include:

- `NO_EVIDENCE`
- `WEAK_EVIDENCE`
- `PROJECT_ONLY`
- `STALE_EVIDENCE`
- `RESTRICTED_ONLY`
- `EXPIRED_CERTIFICATION`
- `MISSING_CURRENT_CERTIFICATION`
- `MISSING_EDUCATION`
- `MISSING_CLEARANCE`
- `MISSING_WORK_AUTHORIZATION`
- `MISSING_RECENT_EXPERIENCE`
- `INDIRECT_EVIDENCE_ONLY`
- `UNRESOLVED`

Criticality is deterministic:

- `CRITICAL`
- `MATERIAL`
- `MINOR`
- `NONE`

Mandatory wording, clearance, work authorization, current certifications, and central missing technologies can elevate a required gap.

## Internal Alignment Index

`alignmentIndex` is a bounded 0-100 evidence-alignment index used for deterministic tier assignment. It is not displayed as probability and must not be interpreted as interview odds.

## Idempotency and Immutability

Successful report runs are immutable. The system reuses an existing successful report when the following are unchanged:

- Evidence scoring run id
- Scoring input checksum
- Match report contract version
- Match report engine version
- Match report configuration version
- Canonically serialized match report configuration

## Traceability and Privacy

Each report conclusion links back to reviewed requirements and scored evidence ids. The UI is read-only and does not expose raw career payloads as the primary experience.

## Known Limitations

M4.3 does not generate resume prose, resume bullets, cover letters, DOCX output, PDFs, or AI summaries. M5.1 consumes match-report guidance to build an immutable structured resume plan, and final composition remains future work beginning with M5.2.
