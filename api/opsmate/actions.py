"""Reviewable action proposals. Proposals never execute external writes."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ActionStore:
    def __init__(self, base_dir: Optional[Path] = None):
        root = base_dir or Path(os.environ.get("ACTIONS_DIR", Path(__file__).resolve().parent / "data" / "actions"))
        root.mkdir(parents=True, exist_ok=True)
        self.path = root / "proposals.json"

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def create(self, record: dict) -> dict:
        proposal = {
            "id": uuid.uuid4().hex[:12],
            "created_at": _now(),
            "updated_at": _now(),
            "status": "pending",
            "execution_status": "not_executed",
            **record,
        }
        records = self._read()
        records.append(proposal)
        self._write(records)
        return proposal

    def find_idempotent(self, requester_id: str, idempotency_key: Optional[str]) -> Optional[dict]:
        if not idempotency_key:
            return None
        return next((item for item in self._read() if item.get("requester_id") == requester_id and item.get("idempotency_key") == idempotency_key), None)

    def delete_requester(self, requester_id: str) -> int:
        records = self._read()
        kept = [item for item in records if item.get("requester_id") != requester_id]
        if len(kept) != len(records):
            self._write(kept)
        return len(records) - len(kept)

    def list(self, requester_id: Optional[str] = None) -> list[dict]:
        records = self._read()
        if requester_id is None:
            return records
        return [record for record in records if record.get("requester_id") == requester_id]

    def get(self, proposal_id: str) -> Optional[dict]:
        return next((record for record in self._read() if record.get("id") == proposal_id), None)

    def analytics(self) -> dict:
        records = self._read()
        total = len(records)
        approved = sum(1 for record in records if record.get("status") == "approved")
        completed = sum(1 for record in records if record.get("execution_status") == "completed")
        errors = sum(1 for record in records if record.get("execution_status") == "error")
        handoffs = sum(1 for record in records if record.get("requires_approval") and record.get("status") == "pending")
        return {
            "proposal_count": total,
            "approval_rate": round(approved / total, 4) if total else 0,
            "completion_rate": round(completed / approved, 4) if approved else 0,
            "error_count": errors,
            "human_handoffs": handoffs,
        }

    def decide(self, proposal_id: str, status: str, approver: str, note: Optional[str] = None) -> Optional[dict]:
        records = self._read()
        for proposal in records:
            if proposal.get("id") != proposal_id:
                continue
            if proposal.get("status") != "pending":
                return proposal
            proposal.update({
                "status": status,
                "decision_note": note,
                "approver": approver,
                "decided_at": _now(),
                "updated_at": _now(),
            })
            self._write(records)
            return proposal
        return None


action_store = ActionStore()
