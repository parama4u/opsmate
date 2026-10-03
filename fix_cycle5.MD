# Fix cycle 5

## Findings

1. File-backed chat storage built paths directly from request-controlled chat IDs, leaving a path traversal risk when PostgreSQL was unavailable.
2. File-backed chat writes were direct writes, so an interrupted write could leave a partial JSON session.
3. File-backed chat listing assumed every JSON file had a valid ID and could fail on a damaged or manually edited file.
4. Search and Slack audit records stored raw employee questions, which could put sensitive policy content into logs.
5. Knowledge metadata updates mutated the caller's dictionary with `pop`, causing request data to change unexpectedly before persistence.

## Action plan

1. Restrict file-backed chat IDs to generated safe characters and hash invalid lookup values into an unreachable fallback path.
2. Write chat JSON to a temporary file and replace the destination atomically.
3. Skip malformed chat records during file-backed listing.
4. Store short SHA-256 fingerprints for question audit details while keeping review records unchanged.
5. Copy metadata changes before removing internal fields.

## Implementation status

- Completed the storage hardening, audit minimization, and metadata-copy changes.

## Validation

- Reviewed both PostgreSQL and file-backed code paths.
- Did not run builds, tests, or development servers, per repository instructions.
