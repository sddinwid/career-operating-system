# Career Knowledge Contract

Contract version: `1.0.0`

Importer version introduced in `M2.1`: `m2.1.0`

## Purpose

The canonical career-knowledge contract is the validated, normalized, inspectable snapshot used by later deterministic document-generation milestones.

It keeps these categories distinct:

- `SOURCE_FACT`
- `USER_CONFIRMED`
- `DERIVED`
- `AI_SUGGESTION`

It also keeps confirmation state separate from record kind so imported source facts do not silently become verified facts.

## Supported sections

- Candidate identity and preferences
- Contact metadata
- Target roles and positioning guidance
- Career themes and known unknowns
- Generation rules
- Stack-ordering rules
- Experience-claim rules
- Employment history
- Projects
- Skills
- Education
- Certifications
- Evidence records
- Interview stories

## Core design rules

- Every snapshot has an explicit schema version.
- Stable identifiers are required for imported entities.
- Provenance is attached to imported records through source section, source identifier, and source path metadata.
- Unknown and null remain distinct from false.
- Normalized dates preserve declared precision such as `YEAR`, `MONTH`, `DATE`, or `UNKNOWN`.
- Original source values remain available through the preserved source payload and per-record provenance.

## Validation layers

### File and source validation

- file readable
- valid JSON
- supported top-level source sections
- required source metadata and candidate identity

### Canonical contract validation

- contract shape matches the Zod schema
- identifiers are present and unique where required
- evidence references point at existing records
- date ranges are internally consistent
- certification status is semantically consistent
- rule data remains machine-readable

### Privacy-oriented validation

- suspicious API keys
- token-like values
- password-like values
- private-key markers

Findings report location and category only. Secret values are never echoed.

## Normalization rules

- trim surrounding whitespace
- normalize empty strings to null where safe
- normalize safe enum casing and status values
- preserve prose and metrics instead of rewriting them
- preserve source precision when normalizing dates
- infer additional evidence references only from existing source relationships, not invented facts

## Current limitations

- The contract is stored as validated JSONB, not decomposed relational tables.
- No read-only inspection UI exists yet.
- No editing or confirmation workflow exists yet.
- No document-generation or evidence-scoring logic depends on this contract yet.
