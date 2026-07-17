# Requirement Classification

Date verified: July 16, 2026

## Scope

`M3.3` turns one immutable `JobDescriptionParse` into a reviewed `JobRequirementAnalysis`.

The parser result is never mutated.

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

## Next milestone

- `M4.1 - Evidence Retrieval Contract` is complete. See [docs/EVIDENCE_RETRIEVAL.md](docs/EVIDENCE_RETRIEVAL.md).
