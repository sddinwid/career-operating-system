# Career Operating System

Prompt 00 bootstraps a local-first Career Operating System as a Next.js modular monolith for Windows, using PostgreSQL and Prisma without authentication or cloud dependencies.

## Stack

- Next.js App Router with strict TypeScript
- Tailwind CSS v4
- Prisma with PostgreSQL
- Vitest for unit tests
- Playwright for end-to-end tests
- Docker Compose for local database startup

## Windows setup

Run these commands in PowerShell from the repository root:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open `http://localhost:3000` for the application shell and `http://localhost:3000/health` for the status page.

## Verification commands

Run the full bootstrap verification with:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## Environment

The local environment is configured through `.env`:

```env
DATABASE_URL=postgresql://career_os:career_os@localhost:5433/career_os?schema=public
LOCAL_DATA_DIR=./local-data
DEFAULT_TIME_ZONE=America/Chicago
JOB_SEARCH_DAY_CUTOFF=03:00
OPENAI_API_KEY=
```

`local-data/` is reserved for local-only files and remains out of source control except for `.gitkeep`.

## Available scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run format`
- `npm run format:check`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:generate`
