# Fix cycle 13

## Findings

1. Knowledge metadata writes were direct JSON writes and could leave the metadata store truncated.
2. Directory records used direct writes.
3. Discovery collections and saved-search records used direct writes.
4. Slack recap records used direct writes.
5. Backup metadata used a different direct-write path from the other file stores.

## Action plan

1. Use temporary-file replacement for knowledge metadata.
2. Use the same pattern for directory records.
3. Apply it to discovery data.
4. Apply it to recap data.
5. Apply it to backup metadata.

## Implementation status

- Completed the atomic-write changes across the remaining JSON-backed stores.

## Validation

- Reviewed every JSON store writer in the API package.
- Did not run builds, tests, or development servers, per repository instructions.
