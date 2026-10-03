# Fix cycle 15

## Findings

1. FastAPI validation errors used the framework default shape, while the rest of the API promises `{ success, error }` responses.
2. The web client therefore lost useful validation messages and fell back to a generic status error.
3. Validation output could grow with many invalid fields and become an oversized error response.
4. The root API response exposed service metadata without the same API-key boundary as health checks.
5. Invalid requests across the API did not have one consistent response contract.

## Action plan

1. Add a validation-error handler using the API's standard response shape.
2. Include bounded field-level messages for client correction.
3. Cap the combined validation message length.
4. Protect the root service metadata route with the server API key.
5. Keep HTTP, validation, and unhandled errors aligned on `{ success, error }`.

## Implementation status

- Completed the FastAPI validation handler and root-route protection.

## Validation

- Reviewed FastAPI exception paths and the web API parser.
- Did not run builds, tests, or development servers, per repository instructions.
