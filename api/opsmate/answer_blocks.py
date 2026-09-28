"""Small deterministic answer blocks derived from approved source metadata."""

import re


def build_answer_blocks(text: str, metadata: dict) -> dict:
    steps = []
    for line in text.splitlines():
        cleaned = line.strip()
        if re.match(r"^(?:[-*]|\d+[.)])\s+", cleaned):
            steps.append(re.sub(r"^(?:[-*]|\d+[.)])\s+", "", cleaned)[:300])
        if len(steps) >= 8:
            break
    if not steps:
        sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]
        for sentence in sentences:
            if re.search(r"\b(?:connect|go to|open|run|request|must|then|include|tag|report)\b", sentence, flags=re.IGNORECASE):
                steps.append(sentence[:300])
            if len(steps) >= 8:
                break
    return {
        "steps": steps,
        "owner": metadata.get("owner"),
        "subject_matter_expert": metadata.get("subject_matter_expert"),
        "reviewed_at": metadata.get("last_reviewed_at"),
        "effective_date": metadata.get("effective_date"),
        "expiration_date": metadata.get("expiration_date"),
        "related_sources": metadata.get("related_sources", [])[:5],
    }
