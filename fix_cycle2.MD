# Fix cycle 2

## Findings

1. Document upload state was cleared immediately after starting the mutation, so the picker could re-enable while the upload was still running and failures had no visible explanation.
2. Chat rows were clickable `div` elements without keyboard behavior, and chat and document delete controls had no accessible names.
3. The chat send control contained only an icon and had no accessible label.
4. A changed or cleared deep-link context was not reflected in the chat input because `initialValue` was only copied when it was non-empty.
5. Creating a chat or sending a message had no user-facing failure state, and a new chat could be created twice while the first request was pending.

## Action plan

1. Await the upload callback, keep the busy state until completion, and show a translated failure message.
2. Add keyboard activation and current-state semantics to chat rows, plus localized labels for destructive controls.
3. Add a localized accessible name to the send button.
4. Synchronize the input with both non-empty and empty initial values.
5. Catch chat mutations, show a stable error message, and disable input while a new chat is being created.

## Implementation status

- Completed the code and message-catalog changes above.
- Uploads now use `mutateAsync` so the shell can track completion.

## Validation

- Reviewed the affected component paths and mutation callbacks.
- Did not run builds, tests, or development servers, per repository instructions.
