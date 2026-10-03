# Fix cycle 8

## Findings

1. The Next.js API proxy had no upstream timeout, so a stalled API could leave browser requests hanging.
2. Proxy fetch failures fell through to framework-level errors instead of a stable JSON response the web client can display.
3. The auth verification route treated malformed JSON as an authentication failure instead of a client-input error.
4. Auth verification accepted any truthy `idToken` value before passing it to Firebase Admin.
5. Firebase configuration was eligible for stale caching even though it is environment-backed configuration.

## Action plan

1. Apply a bounded upstream timeout.
2. Return a controlled 502 response when the API cannot be reached.
3. Separate malformed JSON handling from token verification failures.
4. Require a non-empty string token before verification.
5. Mark the config route dynamic and disable caching.

## Implementation status

- Completed the proxy, Firebase config, and auth verification changes.

## Validation

- Reviewed the request and failure paths without starting a server.
- Did not run builds, tests, or development servers, per repository instructions.
