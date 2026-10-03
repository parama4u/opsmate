# Fix cycle 11

## Findings

1. Both retrievers could emit chunks larger than the configured maximum when a paragraph had no sentence punctuation, especially for long CJK or minified text.
2. The TF-IDF chunker claimed to split long text by sentences but had no hard fallback for a single oversized sentence.
3. The pgvector chunker had the same oversized-sentence behavior, creating inconsistent retrieval inputs between backends.
4. Vector startup logs printed the full database URL, which can contain credentials.
5. The two retrieval backends handled the same oversized source differently, making fallback behavior unpredictable.

## Action plan

1. Add hard character-boundary splitting for oversized sentences in the TF-IDF retriever.
2. Apply the same hard cap in the pgvector retriever.
3. Remove the database URL from connection logs.
4. Keep chunk size enforcement consistent across both implementations.
5. Preserve source names and ordering while enforcing the bound.

## Implementation status

- Completed the hard chunk bounds and log redaction changes.

## Validation

- Reviewed both retriever implementations and their fallback relationship.
- Did not run builds, tests, or development servers, per repository instructions.
