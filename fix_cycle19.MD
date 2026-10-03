# Fix cycle 19

## Review findings

1. The authenticated connector sync endpoint ran crawling, extraction, and indexing directly inside the async request handler, so a slow source could block unrelated API requests.
2. Connector sync logs included source filenames, which can expose internal document names in operational logs.
3. Connector `last_error` values also included source filenames and were returned to connector administrators.
4. Slack status was publicly reachable even though it exposed integration readiness and OAuth scope details.
5. Slack event JSON was parsed but not checked for an object before calling `.get()`, so a valid JSON scalar could produce a server error.

## Action plan

- Move manual connector sync work to the same worker-thread boundary already used by scheduled and webhook syncs.
- Replace source-specific log and status text with generic, actionable failure messages.
- Require the existing API key and authenticated user on Slack status.
- Return a stable 400 response for non-object Slack event payloads.

## Implementation

- Applied all five changes in `api/opsmate/main.py`.
- Manual connector sync now avoids blocking the FastAPI event loop.
- Source names are no longer written to connector error status or warning logs.
- Slack status and Slack event payload handling now have bounded access and validation.

## Validation

- Compared manual, scheduled, and webhook connector execution paths to keep their behavior consistent.
- No server, build, test, deployment, or external Slack action was run.
