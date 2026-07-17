# Evidence Retrieval

Date verified: July 17, 2026

Milestone `M4.1` adds a deterministic, inspectable retrieval layer between a confirmed requirement analysis and a specific immutable career-profile version.

## Inputs

Each retrieval run references exactly:

- one workspace
- one confirmed `JobRequirementAnalysis`
- one immutable `CareerProfileVersion`
- one immutable `JobDescriptionVersion`
- one retrieval contract version
- one retrieval engine version

The persisted run stores exact IDs plus source checksums so later source changes do not rewrite historical retrieval results.

## Contract and Versioning

- Retrieval contract version: `1.0.0`
- Retrieval engine version: `m4.1.0`
- Persistence model: `EvidenceRetrievalRun`
- Statuses: `PENDING`, `SUCCESS`, `SUCCESS_WITH_WARNINGS`, `FAILED`
- Coverage states: `CANDIDATES_FOUND`, `LIMITED_CANDIDATES`, `NO_CANDIDATES`, `EXCLUDED`, `NOT_APPLICABLE`
- Eligibility states: `ELIGIBLE`, `ELIGIBLE_WITH_RESTRICTIONS`, `INELIGIBLE`

Successful runs are immutable. Identical inputs reuse the latest successful run instead of creating duplicates.

## Evidence Types

The retrieval contract currently supports:

- `ROLE`
- `RESPONSIBILITY`
- `ACCOMPLISHMENT`
- `PROJECT`
- `PROJECT_RESPONSIBILITY`
- `PROJECT_ACCOMPLISHMENT`
- `SKILL`
- `TECHNOLOGY_USAGE`
- `METRIC`
- `EDUCATION`
- `CERTIFICATION`
- `INTERVIEW_STORY`
- `LEADERSHIP`
- `ARCHITECTURE`
- `DOMAIN`
- `OTHER`

## Eligibility

Retrieval only uses records present in the selected career-profile version.

Eligible by default:

- preserved source facts
- confirmed or accepted records
- evidence linked to a valid employer, role, project, education record, certification, or supporting evidence record

Eligible with restrictions:

- project-only evidence
- stale evidence
- derived evidence
- expired certifications
- missing dates
- intermittent-use evidence
- unverified metrics
- unconfirmed evidence

Ineligible:

- AI suggestions
- malformed references
- missing parent records

## Restrictions

Restriction codes currently emitted:

- `STALE_SKILL`
- `PROJECT_ONLY`
- `EXPIRED_CERTIFICATION`
- `UNVERIFIED_METRIC`
- `DERIVED_ONLY`
- `UNCONFIRMED`
- `AI_SUGGESTION`
- `INTERMITTENT_USE`
- `NO_DIRECT_REQUIREMENT_LINK`
- `MISSING_DATE`

Restrictions remain visible in the result instead of silently removing the candidate.

## Deterministic Lookup Rules

The retrieval engine uses deterministic rule sets only.

Technology lookup:

- canonical technology match
- explicit alias match from the job-description technology dictionary
- skill-to-supporting-evidence traversal
- role, project, responsibility, accomplishment, and metric lookup tied to matched technology

Concept lookup:

- bounded responsibility and architecture concept dictionary
- explicit leadership detection
- explicit domain-tag overlap only

Education and certification lookup:

- exact name overlap
- issuer and expiration metadata preserved

The engine does not use AI, embeddings, semantic search, or unsupported inferred adjacency.

## Recency

Recency values:

- `CURRENT`
- `RECENT`
- `OLDER`
- `STALE`
- `UNKNOWN`

Current thresholds:

- current: up to 1 year
- recent: more than 1 and up to 3 years
- older: more than 3 and up to 5 years
- stale: more than 5 years

The run stores the policy thresholds and evaluated date.

## Diagnostics

Diagnostics are grouped by:

- `ERROR`
- `WARNING`
- `INFO`

Examples include skipped noise items, skipped excluded items, no-candidate gaps, stale-only candidates, project-only candidates, and expired-certification-only coverage.

## Read-Only UI

Routes:

- `/job-descriptions/[jobDescriptionVersionId]/requirements`
- `/job-descriptions/[jobDescriptionVersionId]/evidence`
- application detail retrieval status on `/applications/[applicationId]`

The UI exposes:

- retrieval readiness
- run summary
- grouped requirement coverage
- candidate evidence
- restrictions
- provenance
- gap summary

The UI does not display scores, match percentages, satisfaction labels, or ranking.

## Privacy

- raw career source JSON is not exposed in the browser
- retrieval pages show provenance metadata, not full private payloads
- tests use the anonymized fixture `fixtures/career_knowledge_base_fixture_v1.json`

## Known Limitations

`M4.1` stops at candidate retrieval and explanation. `M4.2` consumes the immutable retrieval run and adds deterministic candidate scoring in a separate immutable layer.

Deferred to later milestones:

- final evidence scoring
- weighted ranking
- match percentages
- manual evidence approval or rejection
- manual linking
- resume generation
- cover letters

## Next Dependency

Next prompt:

`M4.2 - Evidence Scoring Engine`
