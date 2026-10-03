# Fix cycle 12

## Findings

1. The dashboard sidebar exposed account navigation but no sign-out control, so users had to return to marketing pages to end their session.
2. Auth-provider sync failures logged the full error object, which could include internal request details.
3. The route error boundary logged the complete error object to the browser console.
4. Marketing sign-out failures were unhandled, leaving the user without feedback.
5. The dashboard sign-out path had no failure feedback after it was added.

## Action plan

1. Add sign-out to the dashboard profile menu.
2. Log only a stable auth-sync message.
3. Log only an error digest in the route boundary.
4. Catch marketing sign-out failures and show a translated alert.
5. Show a translated dashboard sign-out error.

## Implementation status

- Completed the auth logging and sign-out UX changes.

## Validation

- Reviewed both marketing and dashboard auth controls.
- Did not run builds, tests, or development servers, per repository instructions.
