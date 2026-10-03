# Fix cycle 16

## Findings

1. Document uploads read the entire request into memory without a size limit.
2. A long filename was accepted before being used in the destination path.
3. Compressed document formats could expand to an unbounded extracted text result.
4. Upload-size failures had no distinct HTTP status from ordinary extraction failures.
5. The upload pipeline did not use the normalized basename consistently for extension and destination handling.

## Action plan

1. Read uploads in bounded chunks with a 25 MiB limit.
2. Reject filenames longer than the filesystem-safe 255-character limit.
3. Cap extracted text at 5 million characters after decompression or OCR.
4. Return 413 for oversized uploads or extracted documents.
5. Normalize the filename once and reuse it for validation, extension checks, and storage.

## Implementation status

- Completed the ingestion size, filename, extraction, and normalization changes.

## Validation

- Reviewed direct uploads and document extraction paths.
- Did not run builds, tests, or development servers, per repository instructions.
