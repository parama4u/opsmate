# Fix cycle 4

## Findings

1. Browser API calls assumed every successful or failed response was JSON, so an HTML or empty upstream response produced an uncaught parsing error instead of a stable request error.
2. The user-sync endpoint returned a server error for malformed JSON because it called `request.json()` without validation.
3. Document deletion did not reject path-shaped filenames before resolving the filesystem target and audit entry.
4. The unauthenticated health endpoint exposed chunk counts and database availability to any caller.
5. Slack logs included the first 80 characters of employee questions, which could place sensitive policy or support content in logs.

## Action plan

1. Parse response bodies defensively and retain the existing status-based fallback message.
2. Validate the user-sync body shape and return a client error for malformed requests.
3. Apply the same safe filename validation used by document preview and metadata updates.
4. Require the server API key for health checks so internal operational details are not public.
5. Keep Slack identifiers useful for troubleshooting but remove question text from log messages.

## Implementation status

- Completed the web API parsing, FastAPI validation, filename validation, health protection, and Slack logging changes.

## Validation

- Reviewed the affected request handlers and logging paths.
- Did not run builds, tests, or development servers, per repository instructions.
