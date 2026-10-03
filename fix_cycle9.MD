# Fix cycle 9

## Findings

1. Source links rendered URLs supplied by metadata without checking the protocol.
2. Slack recap source links used the same unvalidated URL data.
3. Document metadata accepted non-HTTP source URLs, including schemes that should not be rendered as web links.
4. Connector-provided source URLs could reach both web and Slack link surfaces without a shared safety rule.
5. The web source-link handling duplicated protocol checks at call sites instead of centralizing the rule.

## Action plan

1. Add a browser helper that permits only HTTP and HTTPS URLs.
2. Apply it to chat citations and Slack recap links.
3. Validate metadata URLs at the FastAPI model boundary.
4. Keep Slack links defensive even for records created before validation existed.
5. Reuse the helper at every web source-link surface.

## Implementation status

- Completed the shared URL validation and applied it to web, API, and Slack citation paths.

## Validation

- Reviewed metadata, connector, chat citation, and Slack recap link flows.
- Did not run builds, tests, or development servers, per repository instructions.
