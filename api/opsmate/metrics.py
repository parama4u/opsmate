"""Privacy-preserving operational metrics for answer quality and usage."""

import json
import os
import statistics
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MetricsStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("METRICS_DIR", Path(__file__).resolve().parent / "data" / "metrics"))
        root.mkdir(parents=True, exist_ok=True)
        self.path = root / "events.json"

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def record(self, event: str, **values) -> dict:
        record = {"id": uuid.uuid4().hex[:12], "created_at": _now(), "event": event}
        record.update({key: value for key, value in values.items() if value is not None})
        records = self._read()
        records.append(record)
        self._write(records)
        return record

    def analytics(self) -> dict:
        records = self._read()
        latencies = [float(item["latency_ms"]) for item in records if item.get("latency_ms") is not None]
        models: dict[str, int] = {}
        for item in records:
            model = item.get("model")
            if model:
                models[model] = models.get(model, 0) + 1
        sorted_latencies = sorted(latencies)
        p95_index = min(len(sorted_latencies) - 1, max(0, int(len(sorted_latencies) * 0.95) - 1)) if sorted_latencies else 0
        return {
            "answer_count": sum(1 for item in records if item.get("event") == "answer"),
            "average_latency_ms": round(statistics.fmean(latencies), 1) if latencies else 0,
            "p95_latency_ms": round(sorted_latencies[p95_index], 1) if sorted_latencies else 0,
            "estimated_usage_cost": round(sum(float(item.get("estimated_cost", 0)) for item in records), 6),
            "model_counts": models,
            "fallback_count": sum(1 for item in records if item.get("model") in {"fallback", "fallback-no-context", "abstention"}),
        }

    def apply_retention(self, days: int) -> int:
        if days <= 0:
            return 0
        cutoff = datetime.now(timezone.utc).timestamp() - days * 86400
        records = self._read()
        kept = []
        for record in records:
            try:
                stamp = datetime.fromisoformat(record["created_at"].replace("Z", "+00:00")).timestamp()
            except (KeyError, ValueError):
                stamp = cutoff
            if stamp >= cutoff:
                kept.append(record)
        if len(kept) != len(records):
            self._write(kept)
        return len(records) - len(kept)


metrics_store = MetricsStore()
