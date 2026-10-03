"""pgvector-based retriever using sentence embeddings.

Stores document chunks and their embeddings in PostgreSQL with the pgvector
extension. Uses sentence-transformers (all-MiniLM-L6-v2, 384-dim) to generate
embeddings. Falls back to the in-memory TF-IDF retriever if the database or
model is unavailable.
"""

import logging
import math
import os
import re
from typing import List, Optional

from opsmate.models import DocumentChunk

logger = logging.getLogger("orgchai.pgvector")

DEFAULT_MODEL = "all-MiniLM-L6-v2"
DEFAULT_DB_URL = "postgresql://localhost:5432/orgchai"


def _chunk_text(text: str, source: str, max_chunk_size: int = 512, overlap: int = 64) -> List[DocumentChunk]:
    """Split text into overlapping chunks of roughly max_chunk_size chars."""
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[DocumentChunk] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) < max_chunk_size:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(DocumentChunk(text=current, source=source))
            current = para
            if len(current) > max_chunk_size:
                sentences = re.split(r"(?<=[.!?]) +", current)
                current = ""
                for sentence in sentences:
                    if len(sentence) > max_chunk_size:
                        if current:
                            chunks.append(DocumentChunk(text=current.strip(), source=source))
                            current = ""
                        chunks.extend(
                            DocumentChunk(text=sentence[start:start + max_chunk_size].strip(), source=source)
                            for start in range(0, len(sentence), max_chunk_size)
                            if sentence[start:start + max_chunk_size].strip()
                        )
                        continue
                    if len(current) + len(sentence) < max_chunk_size:
                        current += (" " if current else "") + sentence
                    else:
                        if current:
                            chunks.append(DocumentChunk(text=current.strip(), source=source))
                        current = sentence
    if current:
        chunks.append(DocumentChunk(text=current.strip(), source=source))
    return chunks


class VectorRetriever:
    """Retriever backed by PostgreSQL + pgvector + sentence-transformers.

    Provides the same interface as TfidfRetriever (ingest, search, remove_source,
    clear) so it can be used as a drop-in replacement.
    """

    def __init__(self, db_url: Optional[str] = None, model_name: str = DEFAULT_MODEL):
        self.db_url = db_url or os.environ.get("DATABASE_URL", DEFAULT_DB_URL)
        self.model_name = model_name
        self._conn = None
        self._model = None
        self._available = False

        # chunks list is kept for compatibility with code that reads .chunks
        self.chunks: List[DocumentChunk] = []

        self._init()

    def _init(self) -> None:
        """Initialize database connection and embedding model.

        Tables and the vector extension are created by Prisma migrations.
        """
        try:
            import psycopg2
            from pgvector.psycopg2 import register_vector

            self._conn = psycopg2.connect(self.db_url)
            self._conn.autocommit = True
            register_vector(self._conn)
            logger.info("Connected to PostgreSQL")

            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
            logger.info("Loaded embedding model: %s (%d dim)", self.model_name, self._model.get_embedding_dimension())

            self._available = True
            self._reload_cache()
        except Exception as exc:
            logger.warning("VectorRetriever unavailable, falling back to TF-IDF: %s", exc)
            self._available = False

    def _reload_cache(self) -> None:
        """Load chunk metadata into memory for the .chunks property and /documents endpoint."""
        if not self._available:
            return
        with self._conn.cursor() as cur:
            cur.execute("SELECT source, content FROM document_chunks ORDER BY id;")
            rows = cur.fetchall()
        self.chunks = [DocumentChunk(text=r[1], source=r[0]) for r in rows]

    def _embed(self, texts: List[str]) -> List[str]:
        """Generate embeddings and return as pgvector string format."""
        import numpy as np
        embeddings = self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        result = []
        for emb in embeddings:
            vec_str = "[" + ",".join(str(np.float32(x)) for x in emb.tolist()) + "]"
            result.append(vec_str)
        return result

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return set(re.findall(r"[^\W_]+", text.lower(), flags=re.UNICODE))

    def ingest(self, text: str, source: str) -> int:
        """Chunk and ingest a document into the vector store."""
        if not self._available:
            return 0

        # Remove existing chunks for this source (upsert semantics).
        self.remove_source(source)

        chunks = _chunk_text(text, source)
        if not chunks:
            return 0

        # Generate embeddings for all chunks at once.
        embeddings = self._embed([c.text for c in chunks])

        with self._conn.cursor() as cur:
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                cur.execute(
                    """
                    INSERT INTO document_chunks (source, content, embedding, chunk_index)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (source, chunk.text, emb, i),
                )

        self._reload_cache()
        logger.info("Ingested %d chunks from %s", len(chunks), source)
        return len(chunks)

    def search(self, query: str, top_k: int = 3, allowed_sources: set[str] | None = None) -> List[DocumentChunk]:
        """Return hybrid vector and keyword-ranked chunks with source deduplication."""
        if not self._available:
            return []

        query_vec = self._embed([query])[0]
        query_tokens = self._tokens(query)

        with self._conn.cursor() as cur:
            if allowed_sources is None:
                cur.execute(
                    """
                    SELECT source, content, 1 - (embedding <=> %s::vector) AS similarity
                    FROM document_chunks
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (query_vec, query_vec, max(top_k * 4, top_k)),
                )
            elif allowed_sources:
                cur.execute(
                    """
                    SELECT source, content, 1 - (embedding <=> %s::vector) AS similarity
                    FROM document_chunks
                    WHERE source = ANY(%s)
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (query_vec, list(allowed_sources), query_vec, max(top_k * 4, top_k)),
                )
            else:
                return []
            rows = cur.fetchall()

        ranked = []
        for source, content, similarity in rows:
            vector_score = max(0.0, float(similarity))
            content_tokens = self._tokens(content)
            keyword_score = len(query_tokens & content_tokens) / max(1, len(query_tokens))
            score = (vector_score * 0.7) + (keyword_score * 0.3)
            if score <= 0:
                continue
            ranked.append((score, source, content))

        ranked.sort(key=lambda item: item[0], reverse=True)
        results = []
        seen_sources: set[str] = set()
        for score, source, content in ranked:
            if source in seen_sources:
                continue
            seen_sources.add(source)
            results.append(DocumentChunk(text=content, source=source, score=score))
            if len(results) >= top_k:
                break
        return results

    def remove_source(self, source: str) -> int:
        """Remove all chunks belonging to a given source. Returns count removed."""
        if not self._available:
            return 0
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM document_chunks WHERE source = %s;", (source,))
            removed = cur.rowcount
        if removed:
            self._reload_cache()
        return removed

    def clear(self) -> None:
        """Remove all indexed documents."""
        if not self._available:
            self.chunks = []
            return
        with self._conn.cursor() as cur:
            cur.execute("TRUNCATE document_chunks RESTART IDENTITY;")
        self.chunks = []
