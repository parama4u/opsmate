"""Managed PostgreSQL backups stored on the persistent application volume."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BackupStore:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(os.environ.get("BACKUP_DIR", Path(__file__).resolve().parent / "data" / "backups"))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_path = self.base_dir / "backups.json"

    def _read(self) -> list[dict]:
        try:
            value = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            return value if isinstance(value, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.metadata_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def list(self) -> list[dict]:
        records = []
        for record in self._read():
            filename = str(record.get("filename") or "")
            path = self.base_dir / Path(filename).name
            if filename and path.exists() and path.is_file():
                records.append({**record, "size_bytes": path.stat().st_size})
        return sorted(records, key=lambda item: str(item.get("created_at") or ""), reverse=True)

    def _validate_archive(self, path: Path) -> None:
        pg_restore = shutil.which("pg_restore")
        if not pg_restore:
            raise RuntimeError("PostgreSQL archive verification is unavailable")
        result = subprocess.run(
            [pg_restore, "--list", str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0 or not result.stdout.strip():
            raise RuntimeError("PostgreSQL backup archive verification failed")

    def create(self) -> dict:
        pg_dump = shutil.which("pg_dump")
        database_url = (os.environ.get("DATABASE_URL") or "").strip()
        if not pg_dump or not database_url:
            raise RuntimeError("PostgreSQL backup tooling is not configured")

        created_at = _now()
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        filename = f"orgchai-{stamp}.dump"
        path = self.base_dir / filename
        result = subprocess.run(
            [pg_dump, "--format=custom", "--no-owner", "--file", str(path), database_url],
            check=False,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0 or not path.exists() or path.stat().st_size == 0:
            path.unlink(missing_ok=True)
            raise RuntimeError("PostgreSQL backup failed")

        self._validate_archive(path)
        records = self._read()
        record = {
            "filename": filename,
            "created_at": created_at,
            "verified_at": _now(),
            "format": "postgresql_custom",
            "size_bytes": path.stat().st_size,
        }
        records = [item for item in records if item.get("filename") != filename]
        records.append(record)
        try:
            retention_count = max(1, min(int(os.environ.get("BACKUP_RETENTION_COUNT", "7")), 30))
        except ValueError:
            retention_count = 7
        for stale in sorted(records, key=lambda item: str(item.get("created_at") or ""), reverse=True)[retention_count:]:
            stale_filename = str(stale.get("filename") or "")
            stale_path = self.base_dir / Path(stale_filename).name
            if stale_filename and stale_path != path:
                stale_path.unlink(missing_ok=True)
        records = [item for item in records if (self.base_dir / Path(str(item.get("filename") or "")).name).exists()]
        self._write(records)
        return record

    def verify_latest(self) -> Optional[dict]:
        records = self.list()
        if not records:
            return None
        latest = records[0]
        self._validate_archive(self.base_dir / Path(str(latest["filename"])).name)
        return latest


backup_store = BackupStore()
