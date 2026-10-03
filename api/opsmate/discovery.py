"""File-backed discovery settings for collections, saved searches, and glossary terms."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


_BUILTIN_QUERY_ALIASES = {
    "休暇": ("vacation", "leave", "paid time off"),
    "有給": ("vacation", "paid leave", "paid time off"),
    "従業員": ("employee", "employees", "staff"),
    "社員": ("employee", "employees", "staff"),
    "ポリシー": ("policy", "policies"),
    "手順": ("procedure", "procedures", "guide", "guidance"),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DiscoveryStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("DISCOVERY_DIR", Path(__file__).resolve().parent / "data" / "discovery"))
        root.mkdir(parents=True, exist_ok=True)
        self.root = root

    def _read(self, name: str, default):
        try:
            value = json.loads((self.root / name).read_text(encoding="utf-8"))
            if isinstance(default, list):
                return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else default
            return value if isinstance(value, type(default)) else default
        except (OSError, json.JSONDecodeError):
            return default

    def _write(self, name: str, value) -> None:
        path = self.root / name
        temp_path = path.with_suffix(path.suffix + ".tmp")
        temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def collections(self) -> list[dict]:
        return self._read("collections.json", [])

    def get_collection(self, collection_id: str) -> Optional[dict]:
        return next((item for item in self.collections() if item.get("id") == collection_id), None)

    def save_collection(self, record: dict, collection_id: Optional[str] = None) -> dict:
        records = self.collections()
        if collection_id:
            for item in records:
                if item.get("id") == collection_id:
                    item.update(record)
                    item["updated_at"] = _now()
                    self._write("collections.json", records)
                    return item
            return {}
        item = {"id": uuid.uuid4().hex[:12], "created_at": _now(), "updated_at": _now(), **record}
        records.append(item)
        self._write("collections.json", records)
        return item

    def saved_searches(self, user_id: str) -> list[dict]:
        return [item for item in self._read("saved_searches.json", []) if item.get("user_id") == user_id]

    def save_search(self, record: dict) -> dict:
        records = self._read("saved_searches.json", [])
        item = {"id": uuid.uuid4().hex[:12], "created_at": _now(), **record}
        records.append(item)
        self._write("saved_searches.json", records)
        return item

    def delete_search(self, search_id: str, user_id: str) -> bool:
        records = self._read("saved_searches.json", [])
        kept = [item for item in records if not (item.get("id") == search_id and item.get("user_id") == user_id)]
        if len(kept) == len(records):
            return False
        self._write("saved_searches.json", kept)
        return True

    def delete_user_searches(self, user_id: str) -> int:
        records = self._read("saved_searches.json", [])
        kept = [item for item in records if item.get("user_id") != user_id]
        if len(kept) != len(records):
            self._write("saved_searches.json", kept)
        return len(records) - len(kept)

    def glossary(self) -> list[dict]:
        return self._read("glossary.json", [])

    def save_term(self, record: dict) -> dict:
        records = self.glossary()
        existing = next((item for item in records if item.get("term") == record["term"]), None)
        if existing:
            existing.update(record)
            existing["updated_at"] = _now()
            result = existing
        else:
            result = {"created_at": _now(), "updated_at": _now(), **record}
            records.append(result)
        self._write("glossary.json", records)
        return result

    def delete_term(self, term: str) -> bool:
        records = self.glossary()
        kept = [item for item in records if item.get("term") != term]
        if len(kept) == len(records):
            return False
        self._write("glossary.json", kept)
        return True

    def expand_query(self, query: str) -> str:
        terms = []
        lowered = query.lower()
        for term, aliases in _BUILTIN_QUERY_ALIASES.items():
            if term in query:
                terms.extend(aliases)
        for item in self.glossary():
            if item.get("term", "").lower() in lowered:
                terms.extend(str(value) for value in item.get("synonyms", []))
        return " ".join([query, *terms]) if terms else query


discovery_store = DiscoveryStore()
