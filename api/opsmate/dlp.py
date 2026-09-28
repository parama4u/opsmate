"""Small, configurable DLP scanner for indexed source text."""

import os
import re


_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "phone": re.compile(r"(?<!\w)(?:\+?\d[\d .()/-]{7,}\d)(?!\w)"),
    "credential": re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,})\b|-----BEGIN [A-Z ]+ KEY-----"),
}


def _action(override: str | None = None) -> str:
    configured = (override or os.environ.get("DLP_ACTION") or "flag").strip().lower()
    return configured if configured in {"flag", "redact", "block"} else "flag"


def inspect_text(text: str, action: str | None = None) -> dict:
    findings = {name: len(pattern.findall(text)) for name, pattern in _PATTERNS.items()}
    findings = {name: count for name, count in findings.items() if count}
    if any(name == "credential" for name in findings):
        classification = "restricted"
    elif findings:
        classification = "personal"
    else:
        classification = "internal"
    return {
        "action": _action(action),
        "classification": classification,
        "findings": findings,
        "blocked": bool(findings) and _action(action) == "block",
    }


def process_text(text: str, action: str | None = None) -> tuple[str, dict]:
    report = inspect_text(text, action)
    if not report["findings"] or report["action"] != "redact":
        return text, report
    redacted = text
    for name, pattern in _PATTERNS.items():
        redacted = pattern.sub(f"[REDACTED:{name.upper()}]", redacted)
    return redacted, report
