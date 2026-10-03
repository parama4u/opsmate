# Fix cycle 7

## Findings

1. Connector registry writes were direct JSON writes, so an interrupted update could corrupt the connector list.
2. Remote connector JSON and file downloads were unbounded, allowing an oversized response to consume excessive memory.
3. Google Drive file IDs were interpolated directly into download URLs instead of being URL-encoded.
4. SharePoint pagination followed any returned next-link while reusing the bearer token, so an unexpected host could receive credentials.
5. Local-folder crawling followed symlinks, which could index files outside the configured root.

## Action plan

1. Make connector registry writes atomic.
2. Add bounded response readers for JSON and downloaded source content.
3. Encode remote file IDs before URL construction.
4. Allow SharePoint pagination only on the Microsoft Graph host.
5. Skip symlinks during local-folder reconciliation.

## Implementation status

- Completed the connector hardening changes.
- JSON responses are capped at 10 MiB and downloaded source files at 25 MiB.

## Validation

- Reviewed local, Google Drive, SharePoint, and REST connector paths.
- Did not run builds, tests, or development servers, per repository instructions.
