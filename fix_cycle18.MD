# Fix cycle 18

## Review findings

1. Several file-backed stores trusted parsed JSON to be a list, so a valid but wrong-shaped file could make `.append()` or iteration fail.
2. List-backed records were also assumed to contain objects, so a stray scalar entry could break `.get()` calls in connector, directory, recap, metrics, backup, or evaluation views.
3. Discovery settings had the same shape problem across collections, saved searches, and glossary records.
4. Knowledge metadata mixed dictionary-backed and list-backed files without validating the expected top-level type.
5. A corrupted or hand-edited local metadata file could therefore turn a normal API request into a server error instead of an empty, recoverable result.

## Action plan

- Validate the top-level JSON shape in every file-backed store touched by user-facing reads.
- Filter list records to dictionaries before returning them to business logic.
- Preserve dictionary-backed defaults for knowledge metadata and discovery settings.
- Keep malformed files recoverable without exposing parser details to API clients.

## Implementation

- Hardened connector, directory, discovery, recap, knowledge, evaluation, metrics, and backup store readers.
- Invalid record shapes now fall back to the store's safe empty value or are ignored.

## Validation

- Reviewed each changed reader against its existing callers and preserved the current file formats.
- No database, server, build, or test command was run.
