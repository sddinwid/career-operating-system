# Job Description Parser

## Scope

`M3.2` turns a saved `JobDescriptionVersion.normalizedText` record into a structured, versioned, inspectable parse result using deterministic TypeScript rules only.

Implemented:

- immutable `JobDescriptionParse` persistence
- parser version `m3.2.0`
- contract version `1.0.0`
- section detection and statement segmentation
- role metadata, compensation, responsibilities, qualifications, technologies, experience, education, certifications, and benefits extraction
- parser diagnostics and read-only analysis UI
- parser-version idempotency for the same saved source

Deferred:

- evidence retrieval and scoring
- AI-assisted parsing
- automatic opportunity correction

## Storage model

`JobDescriptionVersion` remains the immutable source of truth for original and normalized text.

`JobDescriptionParse` stores the derived parser run:

- workspace ownership
- job-description version linkage
- parser version
- contract version
- source checksum
- parse status
- diagnostics JSONB
- structured result JSONB
- workflow identifier
- optional error summary
- created and completed timestamps

Successful parse reuse is scoped to:

- same workspace
- same job-description version
- same parser version
- same contract version

New parser versions create new immutable rows.

## Deterministic pipeline

```text
JobDescriptionVersion.normalizedText
  -> line segmentation
  -> section alias detection
  -> statement segmentation
  -> deterministic extraction rules
  -> Zod contract validation
  -> immutable parse record
```

The parser never mutates the source version.

## Section aliases

Centralized in `src/lib/job-descriptions/section-aliases.ts`.

Examples:

- `What You'll Do` -> `RESPONSIBILITIES`
- `Requirements` and `Minimum Qualifications` -> `REQUIRED_QUALIFICATIONS`
- `Preferred Qualifications`, `Nice to Have`, and `Bonus Points` -> `PREFERRED_QUALIFICATIONS`

Leading company and role lines are treated as overview content rather than fake sections.

## Technology dictionary

Centralized in `src/lib/job-descriptions/technology-dictionary.ts`.

The dictionary is deterministic and intentionally bounded. It includes common target-role technologies and the current Scott CKB stack such as:

- TypeScript
- Node.js
- PostgreSQL
- AWS
- Lambda
- Docker
- Prisma
- GraphQL

Alias matching is deterministic and avoids known short-alias false positives such as ordinary lowercase `go`.

## Confidence model

- `HIGH`: explicit heading or explicit structured statement
- `MEDIUM`: strong lexical match with clear local context
- `LOW`: deterministic but ambiguous inference

Confidence is explanatory only. It is not a probability score.

## Diagnostics

Diagnostics are persisted with severity, message, rule, and optional line location.

Severities:

- `ERROR`
- `WARNING`
- `INFO`

Examples:

- no responsibilities section detected
- experience without a clear associated skill
- company mismatch with opportunity
- role mismatch with opportunity
- duplicate requirement or responsibility text

## Read-only inspection

UI entry points:

- application detail parse action
- job-description detail parse action
- `/job-descriptions/[jobDescriptionVersionId]/analysis`

The analysis page shows:

- parser metadata
- diagnostic counts
- detected sections
- role metadata and agreement with the linked opportunity
- compensation
- responsibilities
- qualifications
- technologies
- experience, education, certifications, and benefits

## Known limitations

- parser output is intentionally pre-review and does not become downstream authority until `M3.3` confirmation
- top-line company and role extraction still relies on simple deterministic preamble heuristics
- the technology dictionary is intentionally bounded rather than exhaustive
- the parser remains inspection-oriented and correction lives in the separate reviewed-analysis layer
