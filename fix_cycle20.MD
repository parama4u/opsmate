# Fix cycle 20

## Review findings

1. Admin timestamps used the browser default locale even when the app was in Japanese, so the same account could see inconsistent date formats across locales.
2. Review action buttons could be clicked repeatedly while a request was pending and gave no visible failure message.
3. Running the evaluation suite had no pending state or success/error feedback, making duplicate clicks and silent failures likely.
4. Collection creation reset the form immediately, even when the request failed, which forced an administrator to re-enter the data.
5. Glossary saves had the same premature reset behavior and did not show a recoverable error state.

## Action plan

- Format admin dates with the active next-intl locale.
- Disable review actions while a review mutation is pending and show failures in an alert region.
- Add pending protection and status feedback to evaluation runs.
- Await collection and glossary mutations, reset only after success, and show translated success/error messages.

## Implementation

- Updated `web/src/app/[locale]/(dashboard)/admin/page.tsx` with locale-aware date formatting and mutation feedback.
- Added English and Japanese messages for collection, glossary, evaluation-run, and review-update outcomes.
- Preserved existing API hooks and invalidation behavior.

## Validation

- Reviewed the final admin mutation paths and confirmed forms only reset after successful responses.
- Confirmed all twenty cycle files exist and no build, test, server, database, or deployment command was run.
