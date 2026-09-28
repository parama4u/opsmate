"""Persistent definitions for governed Slack recaps and digests."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RecapStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("RECAPS_DIR", Path(__file__).resolve().parent / "data" / "recaps"))
        root.mkdir(parents=True, exist_ok=True)
        self.path = root / "digests.json"

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def create(self, record: dict) -> dict:
        digest = {
            "id": uuid.uuid4().hex[:12],
            "created_at": _now(),
            "updated_at": _now(),
            "active": True,
            "last_run_at": None,
            **record,
        }
        records = self._read()
        records.append(digest)
        self._write(records)
        return digest

    def list(self, owner_id: Optional[str] = None) -> list[dict]:
        records = self._read()
        if owner_id is None:
            return records
        return [record for record in records if record.get("owner_id") == owner_id]

    def get(self, digest_id: str) -> Optional[dict]:
        return next((record for record in self._read() if record.get("id") == digest_id), None)

    def mark_run(self, digest_id: str) -> Optional[dict]:
        records = self._read()
        for record in records:
            if record.get("id") == digest_id:
                record["last_run_at"] = _now()
                record["updated_at"] = _now()
                self._write(records)
                return record
        return None

    def due(self) -> list[dict]:
        now = datetime.now(timezone.utc)
        due_records = []
        for record in self._read():
            if not record.get("active") or record.get("schedule") == "on_demand":
                continue
            last_run = record.get("last_run_at")
            if last_run:
                try:
                    previous = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
                except ValueError:
                    previous = now - timedelta(days=2)
            else:
                previous = now - timedelta(days=2)
            interval = timedelta(hours=1) if record.get("schedule") == "hourly" else timedelta(days=1)
            if now - previous >= interval:
                due_records.append(record)
        return due_records

    def delete_owner(self, owner_id: str) -> int:
        records = self._read()
        kept = [record for record in records if record.get("owner_id") != owner_id]
        if len(kept) != len(records):
            self._write(kept)
        return len(records) - len(kept)


recap_store = RecapStore()
