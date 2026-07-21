# Career Operating System Roadmap

Supersedes the historical roadmap in [reference/Career_Operating_System_Project_Roadmap.docx](../reference/Career_Operating_System_Project_Roadmap.docx).

Current canonical roadmap date: July 17, 2026

## Product Vision

Career Operating System is a local-first system for verified career data, application tracking, targeted document generation, and outcome learning.

Its job is to eliminate Scott's repeated manual work across:
- tracking applications
- reading job descriptions
- finding relevant experience evidence
- reordering stacks and skills
- building targeted resumes
- drafting concise cover letters
- preserving exact submitted artifacts

## Governing Principle

Prioritize work by:
1. frequency of the manual task
2. time saved per use
3. reduction in repeated cognitive work
4. reuse of existing architecture and data
5. truthfulness and provenance
6. personal daily usefulness
7. long-term completeness
8. commercial viability

## Current State

Verified in the repository today:
- Milestone 0 foundation is complete
- Milestone 1 application tracking foundation is substantially complete
- `M2.1` career knowledge import is complete
- `M3.1` job-description intake and immutable persistence are complete
- `M3.2` deterministic job-description parsing is complete
- `M3.3` requirement classification and review is complete
- `M4.1` evidence retrieval is complete
- `M4.2` evidence scoring is complete
- The repository supports application CRUD, status history, timestamp rules for applications/imports, fixture-driven import, reconciliation, grid inline editing, saved views, and persistent grid state
- The repository now preserves job-description source text, deterministic normalized text, checksum-based idempotency, predecessor linkage, and application or opportunity linkage
- Document, broader career-profile inspection, audit, and AI-run models exist in schema, but not as implemented workflows
- Spreadsheet copy/export, calendar, Today, contacts/interviews workspaces, and document storage are not yet implemented

## Why the Roadmap Changed

The original roadmap assumed the tracker had to be mostly finished before document generation could begin. Repository evidence no longer supports that assumption.

The tracker foundation is already strong enough to support the next higher-value milestone:
- structured applications exist
- status history exists
- timestamp semantics are verified
- import provenance exists
- opportunities and application linkage exist
- a daily-use grid exists
- saved views and layout persistence exist

The highest-frequency repetitive work now sits in targeted document preparation, not in another round of tracker ergonomics.

## Deterministic Document Architecture

```text
Career Knowledge Base
  -> Job Description Intake
  -> Deterministic Parser
  -> Requirement Classification
  -> Evidence Retrieval
  -> Evidence Scoring
  -> Structured Resume Composition
  -> Truthfulness and ATS Checks
  -> Resume Studio
  -> DOCX/PDF Rendering
  -> Immutable Document Versioning
  -> Application Package Tracking
  -> Outcome Analytics
```

AI may assist with parsing, wording, and review. AI is not the source of truth.

Deterministic rules and verified evidence remain authoritative for:
- eligible facts
- experience claims
- stack ordering
- evidence ranking
- section structure
- artifact provenance

## Revised Milestones

### Milestone 0 - Foundation
- Status: complete
- Scope: repository bootstrap, local runtime, schema, health, tests, seeded workspace

### Milestone 1 - Application Tracking Foundation
- Status: substantially complete
- Scope: application CRUD, status history, timestamps for applications/imports, fixture import, reconciliation, applications grid, inline editing, saved views, persistent grid state

### Milestone 2 - Deterministic Career Knowledge Engine
- Status: import foundation complete, broad inspection deferred
- Scope: Scott-specific career knowledge contract, versioned import, provenance, and later optional inspection

### Milestone 3 - Job Description Intelligence
- Status: complete with July 18, 2026 production-hardening correction
- Scope: intake, persistence, parsing, review, correction, opportunity/application linkage

### Milestone 4 - Evidence Retrieval and Scoring
- Status: `M4.1`, `M4.2`, and `M4.3` complete
- Scope: candidate evidence retrieval, deterministic scoring, explainable match output

### Milestone 5 - Resume Composition Engine
- Status: `M5.1` complete, `M5.2` complete, `M5.3` complete
- Scope: structured resume schema, deterministic composition, truthfulness and ATS checks

### Milestone 6 - Resume Studio and Review
- Status: `M6.1` complete, `M6.2` complete
- Scope: revision editing, provenance visibility, local validation, comparison, rendering approval, and immutable revision history

### Milestone 7 - Document Rendering and Artifact Versioning
- Status: `M7.1` complete, `M7.2` complete
- Scope: DOCX, PDF, render validation, storage metadata, immutable `DocumentVersion` linkage

### Milestone 8 - Application Package Generation
- Status: `M8.1` complete, `M8.2` complete, `M8.3` complete, `M8.4` corrective usability slice in progress, later package slices planned
- Scope: targeted resume, concise cover letter, related package artifacts, exact submitted-version tracking

### Milestone 9 - Daily Workflow Completion
- Status: deferred
- Scope: calculated columns, Today, copy behavior, export, calendar, contacts, outreach, interviews

### Milestone 10 - Analytics and Learning
- Status: deferred
- Scope: funnel, source, variant, response, and outcome analysis with confidence warnings

### Milestone 11 - Generic Ingestion
- Status: deferred
- Scope: generic resume/document ingestion and conflict resolution for users beyond Scott

### Milestone 12 - Commercial Product Foundation
- Status: deferred
- Scope: auth, tenant isolation, secure storage, onboarding, privacy controls, billing readiness

## New Prompt Order

Near-term sequence:
1. `M2.1 - Career Knowledge Contract and Versioned Scott CKB Import` complete
2. `M3.1 - Job Description Intake and Persistence` complete
3. `M3.2 - Deterministic Job Description Parser` complete
4. `M3.3 - Requirement Classification and Review` complete
5. `M4.1 - Evidence Retrieval Contract` complete
6. `M4.2 - Evidence Scoring Engine` complete
7. `M4.3 - Explainable Match Report` complete
8. `M5.1 - Structured Resume Contract` complete
9. `M5.2 - Deterministic Resume Composition` complete
10. `M5.3 - Resume Quality and Truthfulness Checks` complete
11. `M6.1 - Resume Studio Editing and Versioned Revision` complete

Deferred support slice:
- `M2.2 - Career Knowledge Validation and Read-Only Inspection` remains intentionally deferred as a larger standalone workspace while the deterministic generation pipeline is being completed end to end

Later sequence:
- `M7.3 - Immutable Document Versioning and Attachment`
- `M8.1 - Deterministic Cover Letter Composition` complete
- `M8.2 - Cover Letter Studio, Audit, and Approval` complete
- `M8.3 - Cover Letter Rendering and Document Integration` complete
- `M8.4 - End-to-End UI Readiness and URL Job Intake` corrective slice before package composition
- `M9.x` tracker ergonomics and exports
- `M10.x` analytics
- `M11.x` generic ingestion
- `M12.x` commercialization

## Historical Mapping

- Prompt `00` -> Milestone 0
- Prompt `01` -> Milestone 0 / Milestone 1 foundation
- Prompt `02` and `02 Corrections` -> Milestone 1
- Prompt `03`, `03 Corrections`, and `03 Reconciliation` -> Milestone 1
- Prompt `04A`, `04B`, and `04C` -> Milestone 1
- Historical Prompt `04D` -> deferred into Milestone 9 slices
- Historical Prompts `05-12` -> renumbered into Milestones 9-12

## Risks

- Career knowledge may be incomplete or inconsistent at import time
- Scott-specific rules are currently documented but not yet machine-readable
- Document and AI models are not yet backed by workflows
- Renderer work can grow too large if started before structured contracts exist
- Spreadsheet-only habits can pull priority away from higher-value document automation

## Acceptance Criteria for the Current Direction

The roadmap rebaseline is successful when:
- the tracker foundation remains stable and usable
- the repository preserves the two core deterministic inputs: career knowledge and job descriptions
- the repository already parses saved job descriptions deterministically and the next prompt classifies and reviews requirements
- later document-generation work depends on deterministic data structures rather than opaque prompt chains
- remaining tracker enhancements are deferred intentionally, not forgotten

## Commercialization Path

Commercial viability remains intact because deterministic, provenance-aware generation is a stronger long-term architecture than prompt-only generation. Multi-user requirements are deferred, not abandoned, until the Scott-specific workflow proves useful end to end.
## Immediate Next Step

Do not implement the next roadmap milestone during this verification pass.

The July 19, 2026 navigation/discovery correction is explicitly not a new roadmap milestone. It makes existing `M1` through `M7.2` workflows discoverable without changing milestone order.
## Resume Workflow Progress

- M6.2 introduced comparison and approval and now serves as the rendering gate for M7.1.
- M7.1 is complete.
- M7.2 adds direct deterministic PDF rendering plus shared artifact validation and is complete.
## M8.3

Complete deterministic approved cover-letter DOCX and PDF rendering through the existing immutable document-artifact pipeline. The next roadmap step remains application package composition and submission snapshot work.

## M8.4

`M8.4` is not the start of `M9`. It is a corrective usability-and-intake milestone that makes the already-implemented `M0` through `M8` workflow operable from the browser and adds safe public URL job-description preview intake before save.
