# Fix cycle 10

## Findings

1. Metrics event writes could leave a partial JSON file during interruption.
2. Action proposal writes had the same corruption risk.
3. Evaluation case and run writes were also direct file writes.
4. Metrics analytics could fail completely when one malformed event contained a non-numeric latency or cost.
5. The file-backed stores used different write behaviors, making recovery behavior inconsistent across operational data.

## Action plan

1. Use temporary-file replacement for metrics writes.
2. Use temporary-file replacement for action proposal writes.
3. Use temporary-file replacement for evaluation writes.
4. Ignore malformed numeric metric values while keeping valid events visible.
5. Align the file-backed operational stores on the same atomic-write pattern.

## Implementation status

- Completed the atomic-write changes and defensive metrics aggregation.

## Validation

- Reviewed all three operational file stores and their analytics paths.
- Did not run builds, tests, or development servers, per repository instructions.
