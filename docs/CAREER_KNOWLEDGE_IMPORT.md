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
- Source metadata includes filename, file type, MIME type, size, checksum, and detected source version.
- The normalized canonical snapshot is stored separately in `CareerProfileVersion.content`.
- Validation results are stored in `CareerProfileVersion.validationSummary`.

## Idempotency behavior

Same checksum, same contract version, same importer version:

- reuse the existing version
- do not create duplicates

Changed checksum:

- create a new immutable source record if needed
- create a new immutable version
- mark the previous active version as superseded

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

## M2.2 scope

The next slice should add:

- read-only inspection UI
- validation and conflict surfacing
- version metadata display
- diagnostics for missing, duplicate, stale, or conflicting facts
