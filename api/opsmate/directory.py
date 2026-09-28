"""File-backed directory identities used for connector groups and roles."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DirectoryStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("DIRECTORY_DIR", Path(__file__).resolve().parent / "data" / "directory"))
        root.mkdir(parents=True, exist_ok=True)
        self.path = root / "users.json"

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def list(self) -> list[dict]:
        return self._read()

    def get(self, external_id: str) -> Optional[dict]:
        return next((record for record in self._read() if record.get("external_id") == external_id), None)

    def get_by_email(self, email: Optional[str]) -> Optional[dict]:
        normalized = (email or "").strip().lower()
        return next((record for record in self._read() if record.get("email", "").lower() == normalized), None)

    def groups_for(self, email: Optional[str]) -> set[str]:
        record = self.get_by_email(email)
        return {str(group).strip().lower() for group in (record or {}).get("groups", []) if str(group).strip()}

    def upsert(self, record: dict) -> dict:
        records = self._read()
        normalized = {
            "external_id": record["external_id"].strip()[:200],
            "email": record["email"].strip().lower()[:320],
            "display_name": record.get("display_name"),
            "groups": sorted({str(group).strip() for group in record.get("groups", []) if str(group).strip()}),
            "roles": sorted({str(role).strip() for role in record.get("roles", []) if str(role).strip()}),
            "active": bool(record.get("active", True)),
            "source": record.get("source", "directory"),
            "updated_at": _now(),
        }
        existing = next((item for item in records if item.get("external_id") == normalized["external_id"]), None)
        if existing:
            existing.update(normalized)
        else:
            records.append({"created_at": _now(), **normalized})
        self._write(records)
        return next(item for item in records if item.get("external_id") == normalized["external_id"])

    def remove(self, external_id: str) -> bool:
        records = self._read()
        kept = [record for record in records if record.get("external_id") != external_id]
        if len(kept) == len(records):
            return False
        self._write(kept)
        return True


directory_store = DirectoryStore()
