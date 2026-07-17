# Evidence Scoring

Milestone `M4.2` adds deterministic evidence scoring on top of one immutable `EvidenceRetrievalRun`.

## Inputs

- one immutable retrieval run
- scoring contract version `1.0.0`
- scoring engine version `m4.2.0`
- scoring configuration version `scott-v1`

The engine never mutates career profiles, requirement analyses, parser output, job descriptions, retrieval runs, or application state.

## Configuration

- Requirement importance: `REQUIRED 1.00`, `PREFERRED 0.75`, `CONTEXTUAL 0.45`, `RESPONSIBILITY 0.65`
- Context weights: `PROFESSIONAL +15`, `PROJECT +8`, `EDUCATION +10 for education requirements`, `CERTIFICATION +10 for certification requirements`, `OTHER +2`
- Recency: `CURRENT +12`, `RECENT +8`, `OLDER +3`, `STALE -8`, `UNKNOWN 0`
- Record source: `SOURCE_FACT +10`, `USER_CONFIRMED +10`, `DERIVED 0`, `AI_SUGGESTION ineligible`
- Metrics: verified `+8`, unverified `+2`

## Positive Factors

- `EXACT_TECHNOLOGY_MATCH +22`
- `TECHNOLOGY_ALIAS_MATCH +18`
- `DIRECT_EVIDENCE_REFERENCE +24`
- `SKILL_EVIDENCE_LINK +20`
- `ROLE_RESPONSIBILITY_MATCH +18`
- `PROJECT_RESPONSIBILITY_MATCH +13`
- `ARCHITECTURE_CONCEPT_MATCH +16`
- `LEADERSHIP_MATCH +16`
- `DOMAIN_MATCH +10`
- `CLOUD_PLATFORM_ALIGNMENT +12`
- `EDUCATION_MATCH +18`
- `CERTIFICATION_MATCH +18`
- `EXPERIENCE_CONTEXT_MATCH +12`
- `USER_CONFIRMED_RELATIONSHIP +20`

## Penalties

- `STALE_SKILL -12`
- `PROJECT_ONLY -5`
- `EXPIRED_CERTIFICATION -30`
- `UNVERIFIED_METRIC -4`
- `DERIVED_ONLY -8`
- `UNCONFIRMED -15`
- `INTERMITTENT_USE -5`
- `NO_DIRECT_REQUIREMENT_LINK -10`
- `MISSING_DATE -3`
- `FACTOR_FAMILY_CAP -2`

## Explainability

Every candidate stores:

- final score
- unclamped subtotal
- strength band
- positive factor contributions
- penalty contributions
- restrictions
- retrieval reasons
- provenance

## Strength States

Candidate bands:

- `STRONG`
- `GOOD`
- `LIMITED`
- `WEAK`
- `INELIGIBLE`

Requirement states:

- `STRONG_EVIDENCE`
- `GOOD_EVIDENCE`
- `LIMITED_EVIDENCE`
- `WEAK_EVIDENCE`
- `NO_EVIDENCE`
- `RESTRICTED_ONLY`
- `EXCLUDED`

## Ranking

Deterministic ordering uses:

1. eligibility
2. final score descending
3. direct relationship strength
4. professional context over equivalent project context
5. recency
6. verified metric
7. stable candidate id

## Idempotency

- successful reruns reuse the latest scoring row when retrieval run, contract version, engine version, and configuration version are identical
- changed versions or retrieval input create a new immutable scoring run

## Privacy And Non-goals

- no AI scoring
- no embeddings or semantic similarity
- no raw private career payload logging
- no overall application match percentage in `M4.2`

## Known Limitations

- no explainable aggregate requirement report yet
- no resume composition yet
- no manual scoring overrides

## Next Dependency

`M4.3 - Explainable Match Report`
## Downstream Match Reports

Successful evidence scoring runs are now authoritative inputs to M4.3 explainable match reports. Match-report generation is deterministic, idempotent, and read-only, and it must not rescore evidence or infer hiring probability.
