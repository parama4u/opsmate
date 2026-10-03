"""In-memory TF-IDF retriever for internal documents."""

import re
import math
import numpy as np
from typing import List, Tuple
from opsmate.models import DocumentChunk


class TfidfRetriever:
    """Simple TF-IDF based document retriever.

    Stores document chunks, builds a vocabulary, and returns the most
    relevant chunks for a query using cosine similarity.
    """

    def __init__(self, max_chunk_size: int = 512, overlap: int = 64):
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap
        self.chunks: List[DocumentChunk] = []
        self.vocab: dict = {}
        self.idf: dict = {}
        self.doc_tokens: List[List[str]] = []
        self.doc_matrix: np.ndarray = np.array([])
        self._dirty = False

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """Tokenize Latin and non-Latin words without discarding Japanese text."""
        return re.findall(r"[^\W_]+", text.lower(), flags=re.UNICODE)

    def _chunk_text(self, text: str, source: str) -> List[DocumentChunk]:
        """Split text into overlapping chunks of roughly max_chunk_size chars."""
        text = text.strip()
        if not text:
            return []

        # Split on paragraph boundaries first.
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks: List[DocumentChunk] = []
        current = ""

        for para in paragraphs:
            if len(current) + len(para) < self.max_chunk_size:
                current += ("\n\n" if current else "") + para
            else:
                if current:
                    chunks.append(DocumentChunk(text=current, source=source))
                current = para

                # If a single paragraph is too long, split it by sentences.
                if len(current) > self.max_chunk_size:
                    sentences = re.split(r"(?<=[.!?]) +", current)
                    current = ""
                    for sentence in sentences:
                        if len(sentence) > self.max_chunk_size:
                            if current:
                                chunks.append(current.strip())
                                current = ""
                            chunks.extend(
                                DocumentChunk(text=sentence[start:start + self.max_chunk_size].strip(), source=source)
                                for start in range(0, len(sentence), self.max_chunk_size)
                                if sentence[start:start + self.max_chunk_size].strip()
                            )
                            continue
                        if len(current) + len(sentence) < self.max_chunk_size:
                            current += (" " if current else "") + sentence
                        else:
                            if current:
                                chunks.append(DocumentChunk(text=current.strip(), source=source))
                            current = sentence
        if current:
            chunks.append(DocumentChunk(text=current.strip(), source=source))
        return chunks

    def ingest(self, text: str, source: str) -> int:
        """Ingest a document, replacing an older copy from the same source."""
        self.remove_source(source)
        new_chunks = self._chunk_text(text, source)
        self.chunks.extend(new_chunks)
        self._dirty = True
        return len(new_chunks)

    def _build_index(self) -> None:
        """Build TF-IDF vectors for all stored chunks."""
        if not self.chunks:
            self.doc_matrix = np.array([])
            return

        # Build vocabulary and document frequency.
        self.vocab = {}
        self.idf = {}
        doc_tokens: List[List[str]] = []
        term_doc_count: dict = {}

        for chunk in self.chunks:
            tokens = self._tokenize(chunk.text)
            doc_tokens.append(tokens)
            seen = set(tokens)
            for term in seen:
                term_doc_count[term] = term_doc_count.get(term, 0) + 1

        # Assign term IDs.
        for term in term_doc_count:
            self.vocab[term] = len(self.vocab)
            df = term_doc_count[term]
            self.idf[term] = math.log((len(self.chunks) + 1) / (df + 1)) + 1

        vocab_size = len(self.vocab)
        matrix = np.zeros((len(self.chunks), vocab_size), dtype=np.float32)

        for i, tokens in enumerate(doc_tokens):
            tf: dict = {}
            for term in tokens:
                tf[term] = tf.get(term, 0) + 1
            for term, count in tf.items():
                tid = self.vocab[term]
                tfidf = (1 + math.log(count)) * self.idf[term]
                matrix[i, tid] = tfidf

        # L2-normalize rows for cosine similarity.
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        self.doc_matrix = matrix / norms
        self.doc_tokens = doc_tokens
        self._dirty = False

    def search(self, query: str, top_k: int = 3, allowed_sources: set[str] | None = None) -> List[DocumentChunk]:
        """Return the top-k chunks most similar to the query."""
        if not self.chunks:
            return []

        if self._dirty:
            self._build_index()

        tokens = self._tokenize(query)
        if not tokens:
            return []

        query_vec = np.zeros(len(self.vocab), dtype=np.float32)
        tf: dict = {}
        for term in tokens:
            tf[term] = tf.get(term, 0) + 1
        for term, count in tf.items():
            if term in self.vocab:
                tid = self.vocab[term]
                query_vec[tid] = (1 + math.log(count)) * self.idf[term]

        norm = np.linalg.norm(query_vec)
        if norm == 0:
            return []
        query_vec /= norm

        vector_scores = self.doc_matrix @ query_vec
        query_terms = set(tokens)
        ranked = []
        for index, vector_score in enumerate(vector_scores):
            keyword_score = len(query_terms.intersection(self.doc_tokens[index])) / max(1, len(query_terms))
            score = (float(vector_score) * 0.7) + (keyword_score * 0.3)
            if score > 0:
                ranked.append((score, index))
        ranked.sort(reverse=True)

        results = []
        seen_sources: set[str] = set()
        for score, idx in ranked:
            chunk = self.chunks[int(idx)]
            if allowed_sources is not None and chunk.source not in allowed_sources:
                continue
            if chunk.source in seen_sources:
                continue
            seen_sources.add(chunk.source)
            results.append(DocumentChunk(text=chunk.text, source=chunk.source, score=score))
            if len(results) >= top_k:
                break
        return results

    def remove_source(self, source: str) -> int:
        """Remove all chunks belonging to a given source. Returns count removed."""
        before = len(self.chunks)
        self.chunks = [c for c in self.chunks if c.source != source]
        removed = before - len(self.chunks)
        if removed:
            self._dirty = True
        return removed

    def clear(self) -> None:
        """Remove all indexed documents."""
        self.chunks = []
        self.vocab = {}
        self.idf = {}
        self.doc_tokens = []
        self.doc_matrix = np.array([])
        self._dirty = False


# Global retriever instance used by the API.
# Uses pgvector if available, falls back to TF-IDF otherwise.
def _create_retriever():
    """Factory: try pgvector first, fall back to TF-IDF."""
    import os

    # If DATABASE_URL is explicitly set, or pgvector is available, use it.
    if os.environ.get("DATABASE_URL") or os.environ.get("USE_PGVECTOR", "").lower() in ("1", "true", "yes"):
        try:
            from opsmate.pgvector_store import VectorRetriever
            vr = VectorRetriever()
            if vr._available:
                return vr
            logger.warning("VectorRetriever not available, falling back to TF-IDF")
        except Exception as exc:
            logger.warning("Failed to init VectorRetriever: %s, falling back to TF-IDF", exc)
    return TfidfRetriever()


import logging
logger = logging.getLogger("orgchai.retriever")
retriever = _create_retriever()
