# Requirement Classification

Date verified: July 20, 2026

## Scope

`M3.3` turns one immutable `JobDescriptionParse` into a reviewed `JobRequirementAnalysis`.

The parser result is never mutated.

Corrective updates on July 20, 2026:

- classifier version `m3.3.3`
- all-level competency items can remain required when section semantics support it
- senior-only and staff-only expectation items remain visible with explicit applicability and are no longer treated as universal required requirements
- downstream automation now uses deterministic readiness states so evidence retrieval pauses when extraction coverage is not trustworthy enough
- historical `JobRequirementAnalysis` JSON created before the coverage-summary extension remains readable through read-time compatibility normalization
- missing historical `summary.qualificationExtractionCount` and `summary.responsibilityExtractionCount` are derived in memory from stored `requirements` and `responsibilities`
- missing historical `summary.downstreamReadiness` defaults conservatively to `NEEDS_REVIEW`
- persisted historical rows remain immutable and current analyses still use strict validation
- competency-based postings now keep atomic requirement lines, contextual company-values content, contextual remote or multi-level guidance, and correct technology association instead of collapsing them into broad merged blocks
- the review UI now renders applicability and canonical section hierarchy while avoiding duplicate item text inside a single review card
- Marathon-style compound parser output now stays downstream-safe by preserving degree or experience equivalency as metadata, separating preferred tooling from certification lines, excluding compensation leakage from reviewed requirements, and promoting conservative contextual role-summary items

## Categories

- `REQUIRED`
- `PREFERRED`
- `CONTEXTUAL`
- `NOISE`

Responsibilities remain separate records.

## Requirement kinds

- `TECHNOLOGY`
- `EXPERIENCE`
- `RESPONSIBILITY`
- `EDUCATION`
- `CERTIFICATION`
- `LEADERSHIP`
- `ARCHITECTURE`
- `CLOUD`
- `DATA`
- `AI_ML`
- `SECURITY`
- `DOMAIN`
- `COMMUNICATION`
- `COLLABORATION`
- `WORK_AUTHORIZATION`
- `CLEARANCE`
- `LOCATION`
- `TRAVEL`
- `EMPLOYMENT`
- `OTHER`

## Deterministic rules

Priority order:

1. explicit parser label
2. obligation or optionality wording
3. source section type
4. deterministic lexical signals
5. conservative contextual fallback

Additional section-aware rules:

- child competency sections such as `Technical Craft` and `Impact & Execution` default to required unless applicability narrows them
- senior-only and staff-only sections remain `CONTEXTUAL` so they stay visible without inflating all-level hard-requirement counts
- company-values content and role-location context remain `CONTEXTUAL`
- preferred-experience sections stay item-for-item `PREFERRED`
- conditional growth language such as increasing ownership can preserve `CONDITIONAL_HIGHER_LEVEL` applicability

## Review workflow

Route:

- `/job-descriptions/[jobDescriptionVersionId]/requirements`

Supported actions:

- change category
- change requirement or responsibility kinds
- add review notes
- correct display text
- exclude and restore items
- add user requirements
- confirm the reviewed analysis
- create a revised successor analysis

## Versioning

- Draft generation is idempotent for the same parse and classifier version.
- Confirmed analyses are read-only.
- Later changes create successor analyses.

## Downstream readiness

Every analysis summary now carries one deterministic downstream readiness state:

- `READY`
- `NEEDS_REVIEW`
- `BLOCKED`

This state is derived from extraction coverage and review diagnostics and is used to gate evidence retrieval and later automation steps.

Blocking diagnostics now include merged-item and under-extraction coverage checks such as:

- `RESPONSIBILITY_ITEMS_MERGED`
- `QUALIFICATION_ITEMS_MERGED`
- `PREFERRED_ITEMS_MERGED`
- `ATOMIC_EXTRACTION_COVERAGE_LOW`
- `KNOWN_SECTION_UNRECOGNIZED`
- `LEVEL_APPLICABILITY_MISSING`
- `CONTEXTUAL_SECTION_UNDER_EXTRACTED`

Successful normalization signals now include parser-side or classifier-side informational diagnostics such as:

- `COMPOUND_EDUCATION_EXPERIENCE_DECOMPOSED`
- `CERTIFICATION_TOOLING_ITEMS_DECOMPOSED`
- `COMPENSATION_EXCLUDED_FROM_REQUIREMENTS`

## Next milestone

- `M4.1 - Evidence Retrieval Contract` is complete. See [docs/EVIDENCE_RETRIEVAL.md](docs/EVIDENCE_RETRIEVAL.md).
