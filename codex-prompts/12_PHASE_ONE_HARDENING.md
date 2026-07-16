# Prompt 12 - Phase 1 Hardening

Perform a bounded hardening pass. Do not redesign the application.

## Requirements

- Run full lint, typecheck, unit, integration, e2e, build, and migration-reset suite
- Review accessibility of forms, navigation, grid controls, dialogs, and error messages
- Review database indexes using representative imported data
- Validate no uploads or secrets are committed
- Add application-level error boundary and structured local logging
- Review file path traversal protection
- Review transaction boundaries for imports
- Document known limitations and Phase 2 backlog
- Do not add new product features

## Acceptance criteria

- All checks pass
- Personal release runbook is current
- Known limitations are explicit
- Repository is ready for daily use and future prompts
