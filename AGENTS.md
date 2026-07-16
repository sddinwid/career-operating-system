# AGENTS.md - Mandatory Codex Instructions

## Product intent

Build a local-first Career Operating System for personal job-search use. Personal utility takes precedence over multi-user SaaS features.

## Non-negotiable constraints

1. Read all files in `docs/` before making architectural changes.
2. Implement only the scope of the active prompt.
3. Do not refactor unrelated working code.
4. Do not add authentication, billing, multi-tenancy UI, cloud deployment, Redis, queues, or microservices during Phase 1.
5. PostgreSQL is the primary database. Prisma is the ORM.
6. Next.js and TypeScript are used for both UI and server functionality.
7. Preserve real timestamps and adjusted job-search dates separately.
8. Source facts, calculated values, AI suggestions, and user edits must remain distinguishable.
9. Imported spreadsheet files must never be modified in place.
10. Generated and uploaded documents are immutable versions.
11. Never claim work is complete without running the required tests.
12. Do not invent spreadsheet mappings or career facts when the source is ambiguous.

## Required completion report for every task

- Summary of implementation
- Files changed
- Database migrations created
- Tests added or changed
- Commands run and results
- Manual verification steps
- Known limitations
- Any deviations from the active prompt

## Quality rules

- TypeScript strict mode
- No `any` unless justified in code comments
- Validate all external input
- Handle time zones explicitly
- Use accessible labels and keyboard-friendly controls
- Include error, empty, loading, and partial-data states
- Use realistic fixture-based tests
- Keep functions and components focused
- Prefer boring, maintainable architecture over premature abstraction

## Stop conditions

Stop and report rather than guessing when:

- A spreadsheet column cannot be mapped confidently
- A migration would destroy existing data
- An architectural requirement conflicts with another approved document
- The requested feature requires credentials or external services not provided
