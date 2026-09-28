"""Answer generation for OrgChai."""

import os
from typing import List
from opsmate.models import DocumentChunk


def _build_prompt(
    question: str,
    sources: List[DocumentChunk],
    conversation_context: str = "",
    mode: str = "answer",
    language: str = "default",
) -> str:
    """Build a concise prompt from retrieved sources."""
    context = "\n\n---\n\n".join(
        f"Source: {s.source}\n{s.text}" for s in sources
    )
    answer_language = "the user's language" if language == "default" else language
    return (
        "You are OrgChai, an internal company knowledge assistant. Use ONLY the "
        "provided approved company documents. Be concise, cite source names, and "
        "say when the documents do not answer the question. Never invent policy.\n\n"
        f"Response mode: {mode}.\n"
        f"Answer language: {answer_language}.\n"
        "For compare, state similarities and differences. For summarize, cover the "
        "main points. For checklist, use actionable numbered steps. For research, "
        "briefly explain the sources considered before the cited conclusion.\n\n"
        f"Documents:\n{context}\n\n"
        f"Earlier conversation (treat as context, not evidence):\n{conversation_context or '(none)'}\n\n"
        f"Question: {question}\n\nAnswer:"
    )


def generate_answer(
    question: str,
    sources: List[DocumentChunk],
    model: str | None = None,
    conversation_context: str = "",
    mode: str = "answer",
    language: str = "default",
) -> tuple[str, str]:
    """Generate an answer from retrieved sources.

    Uses the AIAND OpenAI-compatible API if AIAND_API_KEY and AIAND_BASE_URL are
    set, otherwise falls back to a context-only extractive summary.

    Model name comes from MODEL_NAME, with a fallback to MODAL_NAME.

    Returns:
        A tuple of (answer, model_name).
    """
    api_key = os.environ.get("AIAND_API_KEY")
    base_url = os.environ.get("AIAND_BASE_URL")
    model = model or os.environ.get("MODEL_NAME") or os.environ.get("MODAL_NAME")

    if not api_key or not base_url or not model:
        return _fallback_answer(question, sources, mode, language)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url=base_url)
        prompt = _build_prompt(question, sources, conversation_context, mode, language)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful internal company assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=512,
        )
        answer = response.choices[0].message.content.strip()
        return answer, model
    except Exception as exc:
        # Degrade gracefully if generation fails without leaking provider details.
        answer, _ = _fallback_answer(question, sources, mode, language)
        return f"{answer}\n\n(Generated answer unavailable. Showing the verified source excerpts.)", "fallback"


def _fallback_answer(question: str, sources: List[DocumentChunk], mode: str = "answer", language: str = "default") -> tuple[str, str]:
    """Generate a simple answer by surfacing the most relevant source snippets."""
    if not sources:
        return (
            "I couldn't find any relevant documents to answer your question. "
            "Try uploading a document or rephrasing your question.",
            "fallback-no-context",
        )

    headings = {
        "compare": "Comparison based on the internal documents I found:",
        "summarize": "Summary based on the internal documents I found:",
        "checklist": "Checklist based on the internal documents I found:",
        "research": "Research notes based on the internal documents I found:",
    }
    if language == "ja":
        headings.update({
            "answer": "見つかった社内文書に基づく回答:",
            "compare": "見つかった社内文書に基づく比較:",
            "summarize": "見つかった社内文書に基づく要約:",
            "checklist": "見つかった社内文書に基づくチェックリスト:",
            "research": "見つかった社内文書に基づく調査メモ:",
        })
    lines = [headings.get(mode, "Based on the internal documents I found:")]
    if mode == "research":
        lines.append(f"Reviewed {len(sources)} source{'' if len(sources) == 1 else 's'} for: {question}")
    for i, source in enumerate(sources, 1):
        relevance = f"{source.score:.2f}" if source.score is not None else "unranked"
        marker = f"{i}." if mode == "checklist" else f"{i}. From"
        suffix = "" if mode == "checklist" else f" (relevance: {relevance})"
        lines.append(f"\n{marker} *{source.source}*{suffix}:")
        # Show first 400 chars of the chunk as the answer snippet.
        snippet = source.text.strip().replace("\n", " ")
        if len(snippet) > 400:
            snippet = snippet[:400].rsplit(" ", 1)[0] + "..."
        lines.append(f"> {snippet}")

    lines.append(
        "\nTo get a generated answer, set AIAND_API_KEY, AIAND_BASE_URL, and MODEL_NAME."
    )
    return "\n".join(lines), "fallback"
