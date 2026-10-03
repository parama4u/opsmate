# Fix cycle 6

## Findings

1. The direct `/api/ask` request model accepted unbounded question text, unlike the search endpoint.
2. Chat message requests also accepted unbounded question text, allowing oversized prompts and avoidable model or storage pressure.
3. Chat rename requests had no length bounds even though storage later truncated them.
4. Search accepted an effective date range where the start came after the end, producing a confusing empty result instead of a validation error.
5. Document metadata permission lists had no maximum item count, so a single update could submit an unbounded payload.
6. Feedback message IDs had no bounds, allowing malformed oversized identifiers into API processing.

## Action plan

1. Bound direct questions to the same practical maximum used by the chat flow.
2. Bound chat questions before retrieval or generation begins.
3. Validate rename titles at the request boundary.
4. Reject inverted date ranges with a clear validation error.
5. Cap metadata email, domain, and group lists.
6. Validate feedback message ID length and presence.

## Implementation status

- Completed the Pydantic request-model validation changes.

## Validation

- Reviewed the request models used by web and Slack-backed flows.
- Did not run builds, tests, or development servers, per repository instructions.
