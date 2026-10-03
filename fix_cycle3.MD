# Fix cycle 3

## Findings

1. Settings export had no pending or failure state, so a failed download looked like a no-op.
2. Personal-data and chat-history deletion failures were not shown, and confirmation text could be cleared before the mutation settled.
3. Settings labels for display name and email were not associated with their disabled inputs.
4. The admin database card used hardcoded English status text, so the Japanese admin view was partly untranslated.
5. The evaluation-case form reset immediately after starting its mutation, losing the entered case when saving failed and giving no result message.

## Action plan

1. Track export progress and surface translated success or error feedback.
2. Keep confirmation state until deletion settles and show a stable error message.
3. Add explicit input IDs and label associations.
4. Move database status text into both message catalogs.
5. Await evaluation-case creation before resetting the form, with translated success and failure feedback.

## Implementation status

- Completed the settings and admin changes above.
- Destructive actions still require the existing explicit confirmation phrases.

## Validation

- Reviewed the settings and admin mutation paths.
- Did not run builds, tests, or development servers, per repository instructions.
