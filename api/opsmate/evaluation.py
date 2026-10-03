"""File-backed golden-question cases and retrieval evaluation runs."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EvaluationStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("EVALUATION_DIR", Path(__file__).resolve().parent / "data" / "evaluation"))
        root.mkdir(parents=True, exist_ok=True)
        self.cases_path = root / "cases.json"
        self.runs_path = root / "runs.json"

    def _read(self, path: Path, default):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else default
        except (OSError, json.JSONDecodeError):
            return default

    def _write(self, path: Path, value) -> None:
        temp_path = path.with_suffix(".json.tmp")
        temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def cases(self) -> list[dict]:
        return self._read(self.cases_path, [])

    def create_case(self, record: dict) -> dict:
        case = {"id": uuid.uuid4().hex[:12], "created_at": _now(), "updated_at": _now(), **record}
        cases = self.cases()
        cases.append(case)
        self._write(self.cases_path, cases)
        return case

    def runs(self) -> list[dict]:
        return self._read(self.runs_path, [])

    def add_run(self, record: dict) -> dict:
        run = {"id": uuid.uuid4().hex[:12], "created_at": _now(), **record}
        runs = self.runs()
        runs.append(run)
        self._write(self.runs_path, runs)
        return run


evaluation_store = EvaluationStore()
