# Job Description Parser

## Scope

`M3.2` turns a saved `JobDescriptionVersion.normalizedText` record into a structured, versioned, inspectable parse result using deterministic TypeScript rules only.

Implemented:

- immutable `JobDescriptionParse` persistence
- parser version `m3.2.5`
- contract version `1.0.0`
- section detection and statement segmentation
- role metadata, compensation, responsibilities, qualifications, technologies, experience, education, certifications, and benefits extraction
- parser diagnostics and read-only analysis UI
- parser-version idempotency for the same saved source
- corrective handling for nested competency headings, preferred-experience sections, and level-specific expectation sections such as senior or staff guidance
- atomic list-item preservation for responsibilities, competency sections, and preferred qualifications
- wrapped-line continuation heuristics that keep physical list lines separate unless deterministic continuation signals are present
- canonical section hierarchy for `Core Competencies`, child competency sections, `Higher-Level Responsibilities`, and `Our Values`
- persisted section metadata for canonical heading, parent section, hierarchy depth, list orientation, and applicability
- deterministic scraped metadata-block recognition for title, company, location, work arrangement, employment type, department, and compensation labels
- normalized primary and secondary location extraction with raw-source preservation on extracted metadata fields
- multi-level seniority detection that prefers title and header context over later section mentions
- atomic decomposition of compound degree, experience, methodology, tooling, and certification statements with shared `sourceGroupId` provenance and preserved `equivalencyText`
- deterministic compensation-line and offer-disclaimer exclusion from requirement extraction while preserving compensation metadata
- conservative contextual extraction from role-summary and location sections for downstream document strategy

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
- `Core Competencies (All Levels)` -> `CORE_COMPETENCIES`
- `Technical Craft` -> `TECHNICAL_CRAFT`
- `Impact & Execution` -> `IMPACT_EXECUTION`
- `Collaboration & Influence` -> `COLLABORATION_INFLUENCE`
- `Culture & Growth` -> `CULTURE_GROWTH`
- `Higher-Level Responsibilities` -> `HIGHER_LEVEL_RESPONSIBILITIES`
- `At the Senior level, you may` -> `REQUIRED_QUALIFICATIONS` with `SENIOR_ONLY` applicability
- `At the Staff level, you may` -> `REQUIRED_QUALIFICATIONS` with `STAFF_ONLY` applicability
- `Nice-to-Have Experience` -> `PREFERRED_QUALIFICATIONS`
- `Our Values` -> `COMPANY_VALUES`

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
- extraction coverage warnings when a section contains substantial content but too few structured items were produced
- merged-item warnings when multiple logical list items were collapsed into one extracted record
- contextual-section under-extraction warnings when role-location or values context is missing from structured output
- successful normalization info events such as `COMPOUND_EDUCATION_EXPERIENCE_DECOMPOSED`, `CERTIFICATION_TOOLING_ITEMS_DECOMPOSED`, and `COMPENSATION_EXCLUDED_FROM_REQUIREMENTS`

## Atomic extraction and hierarchy

The parser now treats recognized list-oriented sections as atomic by default.

- each logical source line becomes its own item unless deterministic continuation signals show a wrapped line
- semicolon-containing compound items can remain one record when they are still one logical source line
- paragraph-style job descriptions are still segmented conservatively and do not become list explosions
- competency child sections retain parent linkage so the UI can render paths such as `Core Competencies > Technical Craft`
- applicability is stored at both section and extracted-item level so higher-level expectations stay available without becoming universal requirements

Fieldguide regression outcome on July 19, 2026:

- five `What You'll Do` lines now persist as five separate responsibilities
- `Technical Craft`, `Impact & Execution`, `Collaboration & Influence`, and `Culture & Growth` stay atomic instead of merging into large blocks
- `Nice-to-Have Experience` persists as seven separate preferred items
- `Our Values` is recognized as contextual company-value content instead of an unrecognized heading
- top metadata now resolves to `Fieldguide`, `Software Engineer (All Levels)`, `FULL_TIME`, `MULTI_LEVEL`, `Remote, United States`, `San Francisco, CA (Bay Area hybrid)`, and `Engineering`
- scraped labels such as `Employment Type`, `Location Type`, and `Department` no longer appear as `OTHER` sections

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
- department and secondary location metadata
- responsibilities
- qualifications
- technologies
- experience, education, certifications, and benefits

## Known limitations

- parser output is intentionally pre-review and does not become downstream authority until `M3.3` confirmation
- location and work-arrangement normalization remain string-based rather than a dedicated structured location object
- experience expectations without numeric years remain available through qualifications/contextual items rather than a separate experience-signal contract
- the technology dictionary is intentionally bounded rather than exhaustive
- the parser remains inspection-oriented and correction lives in the separate reviewed-analysis layer
