# Architecture

## Initial topology

A single Next.js application contains:

- React user interface
- Server actions and route handlers
- Domain services
- Prisma data access
- File-system document storage
- Excel import/export adapters
- OpenAI provider adapter foundation

PostgreSQL runs locally through Docker Compose.

## Why a modular monolith

A modular monolith minimizes setup and Codex coordination cost while maintaining clear boundaries. It can later be split only if real scaling needs appear.

## Modules

- applications
- companies
- activities
- contacts
- interviews
- documents
- imports
- exports
- calendar
- workflow
- career-profile
- ai
- settings
- audit

## Layering

Each module should separate:

1. Domain types and rules
2. Validation schemas
3. Application services
4. Prisma repository or queries
5. Route handlers/server actions
6. UI components

UI components must not contain core workflow calculations.

## Storage

### PostgreSQL

Relational operational data, workflow state, provenance, import records, and document metadata.

### JSONB

- Raw imported rows
- Parsed job-description data
- Career knowledge-base documents
- AI request/response metadata
- User-configurable rule payloads

### Local filesystem

Development document files under a configurable data directory outside source-controlled application code.

## Time model

- Persist UTC instants in PostgreSQL.
- Store the relevant IANA time zone with events when needed.
- Default user zone: `America/Chicago`.
- Derive job-search date through one centralized service.
- Never derive the date independently in UI components.

## Security for local release

- Bind to localhost by default.
- No login.
- Secrets remain in `.env.local` and never enter source control.
- Validate file extensions, MIME types, and file size.
- Sanitize stored filenames.
