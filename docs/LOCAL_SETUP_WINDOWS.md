# Local Windows Setup

## Required tools

- Git
- Node.js current LTS
- npm or pnpm (use the package manager selected during bootstrap)
- Docker Desktop with WSL2 backend
- Visual Studio Code or preferred editor
- Codex access
- Microsoft Excel for compatibility verification

## Repository

Create:

```powershell
mkdir career-operating-system
cd career-operating-system
git init
```

Copy this package's `docs`, `codex-prompts`, `fixtures`, and `AGENTS.md` into the repository before running Prompt 00.

## Environment values

Codex should generate `.env.example`. Expected local values include:

```env
DATABASE_URL=postgresql://career_os:career_os@localhost:5432/career_os
LOCAL_DATA_DIR=./local-data
DEFAULT_TIME_ZONE=America/Chicago
JOB_SEARCH_DAY_CUTOFF=03:00
OPENAI_API_KEY=
```

`local-data`, `.env`, `.env.local`, uploaded files, generated documents, and database volumes must be excluded from Git.
