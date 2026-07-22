# Evidence Retrieval UX

Date verified: July 22, 2026

This document describes the read-only Evidence Retrieval page presentation after the focused usability and retrieval-quality corrective slice.

## Information hierarchy

The Evidence Retrieval page is decision-oriented by default:

1. page header and primary next action
2. concise Career Knowledge provenance
3. executive evidence summary
4. strongest supported areas and largest gaps
5. compact requirement coverage list
6. expandable requirement details
7. technical details disclosure

Immutable lineage remains preserved and inspectable, but raw ids, checksums, and engine metadata no longer dominate the first screen.

## Retrieval-level support states

The page uses retrieval-level support states, not scoring conclusions:

- `Strong support`
- `Good support`
- `Limited support`
- `Restricted support only`
- `Related evidence only`
- `No qualifying evidence`
- `Excluded`

These states are derived from deterministic retrieval metadata, requirement-aware candidate ordering, bundle coverage, and preserved restrictions.

## Gap language

The page distinguishes:

- no evidence retrieved
- related evidence only
- restricted support only
- direct project evidence without qualifying professional evidence
- excluded items

The page does not imply that Scott lacks a skill when the system only lacks qualifying or unrestricted retrieved evidence.

## Progressive disclosure

- requirement rows are collapsed by default
- each expanded requirement shows the strongest candidate set first
- candidate details preserve retrieved-because explanations, restrictions, and provenance
- technical ids and checksums remain hidden until the technical-details disclosure is expanded
- the interactive explorer is a Client Component, but it receives only a serializable section model and technical-details view from a browser-safe presentation-types module

## Candidate ordering

The display layer uses deterministic requirement-aware ordering. It prefers:

1. eligible evidence over restricted evidence
2. direct relationship signals over indirect ones
3. professional context over project context when relevance is otherwise similar
4. requirement-appropriate evidence types
5. recent evidence over older or stale evidence
6. stable candidate ids as the final tie-breaker

This ordering improves daily evidence review without mutating the stored immutable retrieval run.

## Duplicate handling

The display layer clusters identical candidate representations so repeated records do not flood the page. Hidden related variants remain traceable through the expanded candidate card.

## Compound technology coverage

Requirements that mention multiple technologies show per-technology coverage:

- supported
- restricted
- unsupported

Requirement state is capped to partial support when a compound bundle is only partially covered.

## Domain specificity

Domain matching now uses boundary-aware term matching instead of broad substring overlap. This prevents false positives such as generic `ai` matches inside unrelated words like `familiarity`.

## Known limitations

- Retrieval-level support states are still approximations before M4.2 scoring runs are viewed.
- Historical confirmed analyses created before the classifier correction may still retain older `kind` assignments until a revised analysis is created and reconfirmed.
- Project-only document-ingestion or ML-search evidence remains visible and explainable, but it is still restricted evidence rather than professional qualifying evidence.
