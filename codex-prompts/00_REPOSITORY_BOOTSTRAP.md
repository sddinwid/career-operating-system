# Prompt 00 - Repository Bootstrap

Read `AGENTS.md` and every file in `docs/` before editing.

Create the initial `career-operating-system` repository as a Next.js TypeScript modular monolith for local Windows use.

## Requirements

- Current stable Next.js with App Router and strict TypeScript
- Tailwind CSS or a similarly lightweight styling approach
- ESLint and formatting
- Vitest for unit tests
- Playwright foundation for end-to-end tests
- Docker Compose PostgreSQL service
- Prisma installed but schema may contain only Workspace and UserSetting in this prompt
- Health page and database health route
- Seed one local workspace
- Create `.env.example`
- Create `local-data/.gitkeep` while ignoring actual local files
- Add scripts for dev, build, lint, typecheck, unit test, e2e test, db migration, db seed
- Add a simple application shell with approved navigation labels
- Update README with exact Windows setup commands

## Non-goals

- No authentication
- No Excel parsing
- No application CRUD
- No OpenAI calls
- No cloud deployment

## Acceptance criteria

- `docker compose up -d` starts PostgreSQL
- Prisma migration and seed succeed
- App starts locally
- Health route reports application and database status
- Lint, typecheck, unit tests, and production build pass
- Playwright smoke test verifies the shell loads

Report all required completion details from AGENTS.md.
