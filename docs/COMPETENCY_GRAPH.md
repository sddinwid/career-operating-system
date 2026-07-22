# Competency Graph

Date verified: July 22, 2026

Milestone `M8.8` adds a deterministic competency layer between confirmed job requirements and immutable Career Knowledge evidence.

## Scope

The implemented flow is:

```text
Reviewed requirement
  -> normalized concepts
  -> explicit competencies
  -> bounded deterministic relationships
  -> evidence candidates
  -> restrictions and eligibility
  -> scoring
  -> read-only explanation
```

This milestone does not implement:

- embeddings
- vector search
- probabilistic semantic matching
- AI-generated evidence
- automatic Career Knowledge mutation
- competency CRUD screens
- a generic graph database

## Contract

The source-controlled competency contract lives in:

- `src/lib/competencies/contract.ts`
- `src/lib/competencies/catalog.ts`
- `src/lib/competencies/service.ts`

Each competency definition carries bounded metadata such as:

- id
- name
- category
- description
- aliases
- requirement signals
- evidence signals
- technology signals
- parent competency ids
- related competency ids
- strongly implied competency ids
- weakly related competency ids
- allowed requirement kinds
- preferred evidence families
- disallowed evidence families
- minimum relationship strength
- version

## Categories

The initial catalog uses bounded categories instead of an open-ended tag cloud, including:

- `SOFTWARE_ENGINEERING`
- `BACKEND_ENGINEERING`
- `API_ENGINEERING`
- `SYSTEM_DESIGN`
- `DISTRIBUTED_SYSTEMS`
- `PERFORMANCE`
- `RELIABILITY`
- `TESTING_AND_QUALITY`
- `CLOUD_AND_INFRASTRUCTURE`
- `DATA_AND_STORAGE`
- `SECURITY`
- `AI_AND_SEARCH`
- `DELIVERY_AND_OPERATIONS`
- `LEADERSHIP`
- `COMMUNICATION`
- `COLLABORATION`
- `OWNERSHIP_AND_EXECUTION`
- `PRODUCT_AND_BUSINESS`
- `LEARNING_AND_ADAPTABILITY`
- `DOMAIN`

## Relationship strengths

The competency service uses explicit relationship strengths:

- `EXACT`
- `DIRECT`
- `STRONG_IMPLICATION`
- `SUPPORTING`
- `WEAK_RELATED`
- `NONE`

Weak relationships never satisfy a requirement the same way as direct or exact support.

## Requirement mapping

Requirement mapping is derived, not persisted as a new mutable model.

Inputs include:

- reviewed requirement text
- requirement kind
- normalized technologies
- bounded concept signals

Outputs include:

- competency id and name
- relationship strength
- matched signals
- explanation
- direct-versus-inferred flag

Compound requirements can emit multiple competency components so partial support remains visible.

## Evidence mapping

Evidence mapping stays grounded in existing immutable Career Knowledge records.

Signals include:

- exact technologies
- evidence text
- evidence family
- linked skills
- source context
- restrictions

Mapped evidence families include professional examples, responsibilities, accomplishments, metrics, projects, interview stories, skills, certifications, education, and resume-bullet representations.

## Clustering

Retrieval adds deterministic evidence clustering so the same underlying experience does not flood the page or score repeatedly.

Cluster identity uses bounded deterministic signals such as:

- shared source linkage
- same role or project context
- explicit linked evidence
- normalized event text
- shared competency identity

Clustering preserves provenance, related record ids, restrictions, and context labels.

## Overretrieval safeguards

The implementation uses bounded controls:

- minimum relationship strength
- requirement-kind compatibility
- evidence-family compatibility
- explicit explanation naming the matched competency
- bounded traversal depth
- bounded candidate limits
- no unrestricted parent-category expansion
- technology guardrails for technology-heavy requirements

## Retrieval and scoring interaction

Exact technology matching remains the strongest retrieval path. Competency reasoning augments, but does not replace, direct evidence.

Retrieval now records:

- competency catalog version
- competency catalog checksum
- competency mapping engine version
- mapped requirement competencies
- competency components
- matched evidence competencies
- evidence cluster ids
- gap explanations
- restricted-evidence summary counts
- Career Knowledge Opportunities

Scoring consumes the retrieval output without rewriting historical runs.

## Career Knowledge Opportunities

The Evidence Retrieval page now includes a read-only `Career Knowledge Opportunities` section. It highlights cases such as:

- only skill evidence exists
- only project evidence exists
- only stale evidence exists
- compound coverage is partial
- related evidence exists but lacks a stronger structured example

The UI suggests review actions only. It does not add evidence automatically.

## Known limitations

- the catalog is intentionally bounded to current real workflow gaps rather than exhaustive software-engineering coverage
- weakly related evidence is still demoted and may remain truthful-but-limited support
- historical retrieval pages remain viewable even when a newer competency engine exists
