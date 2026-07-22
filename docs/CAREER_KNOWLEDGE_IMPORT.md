# Career Knowledge Import

## Commands

Dry run:

```powershell
npm run career:import -- --file .\fixtures\career_knowledge_base_fixture_v1.json --dry-run
```

Commit:

```powershell
npm run career:import -- --file .\fixtures\career_knowledge_base_fixture_v1.json
```

Controlled fixture import without changing the current user profile:

```powershell
npm run career:import -- --file .\fixtures\career_knowledge_base_fixture_v1.json --fixture --no-current
```

The same command can be used with the real Scott CKB source when it is available locally.

## Import flow

1. Resolve the default workspace server-side.
2. Read the source file and compute SHA-256.
3. Validate source structure.
4. Normalize into the canonical contract.
5. Run semantic and privacy-oriented validation.
6. Reuse an existing `CareerProfileSource` when the workspace checksum already exists.
7. Reuse an existing `CareerProfileVersion` when checksum, contract version, and importer version already match.
8. Otherwise create a new immutable source-preservation record or normalized version as needed.
9. Return a concise report with counts, validation totals, and created or reused record identifiers.

## Source handling

- The original source payload is preserved in `CareerProfileSource.rawPayload`.
- Source metadata includes filename, file type, MIME type, size, checksum, detected source version, and source purpose (`USER` or `FIXTURE`).
- The normalized canonical snapshot is stored separately in `CareerProfileVersion.content`.
- Validation results are stored in `CareerProfileVersion.validationSummary`.
- `Workspace.currentCareerProfileVersionId` is the authoritative pointer for normal browser workflows.

## Idempotency behavior

Same checksum, same contract version, same importer version:

- reuse the existing version
- do not create duplicates

Changed checksum:

- create a new immutable source record if needed
- create a new immutable version
- when the import is marked current, mark the previous active current version as superseded and move the workspace pointer
- fixture imports can remain non-current so they stay available for controlled tests without becoming the default profile

Future importer or contract version changes:

- may create a new normalized version linked to the same preserved source when normalization semantics change

## Transaction behavior

- Dry run writes nothing.
- Blocking validation errors return a report without writing.
- Committed imports use a transaction so failed version creation does not leave partial source or version records behind.

## Private-data handling

- The real Scott CKB source is not copied into public fixtures.
- Import logs report metadata and counts only.
- Documentation does not reproduce the private payload.
- Tests use anonymized representative fixture data.

## Current-profile rules

- Normal local seeding imports `reference/Scott_Dinwiddie_Career_Knowledge_Base_MongoDB_v3.json` as the current real workspace profile.
- Normal browser workflows only use the workspace current profile when it is classified as `USER`.
- If the current pointer is missing or points to a fixture profile, evidence retrieval is blocked with an actionable message.
- Historical fixture-backed runs remain immutable and visible, but they are not promoted into normal current workflow state.

## M2.2 scope

The next slice should add:

- read-only inspection UI
- validation and conflict surfacing
- version metadata display
- diagnostics for missing, duplicate, stale, or conflicting facts
