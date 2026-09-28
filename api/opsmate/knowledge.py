"""File-backed metadata, feedback, and review records for the knowledge base."""

import json
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_days(name: str) -> int:
    try:
        return max(0, int(os.environ.get(name, "0") or "0"))
    except ValueError:
        return 0


class KnowledgeStore:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(os.environ.get("KNOWLEDGE_META_DIR", Path(__file__).resolve().parent / "data" / "knowledge"))
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _read(self, name: str, default: Any) -> Any:
        path = self.base_dir / name
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default

    def _write(self, name: str, value: Any) -> None:
        (self.base_dir / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")

    def _documents(self) -> dict[str, dict]:
        return self._read("documents.json", {})

    def get_document(self, source: str) -> dict:
        record = self._documents().get(source)
        if record:
            return record
        return {
            "source": source,
            "title": source,
            "source_url": None,
            "status": "draft",
            "owner": None,
            "subject_matter_expert": None,
            "allowed_emails": [],
            "allowed_domains": [],
            "allowed_groups": [],
            "fingerprint": None,
            "duplicate_of": None,
            "source_system": "upload",
            "connector_id": None,
            "relative_path": None,
            "topic": None,
            "department": None,
            "data_classification": "internal",
            "dlp_findings": {},
            "created_at": None,
            "last_reviewed_at": None,
            "effective_date": None,
            "expiration_date": None,
            "history": [],
        }

    def list_documents(self) -> list[dict]:
        return list(self._documents().values())

    def get_retention_policy(self) -> dict:
        defaults = {
            "chat_days": _env_days("CHAT_RETENTION_DAYS"),
            "source_copy_days": 0,
            "embedding_days": 0,
            "audit_event_days": _env_days("CHAT_RETENTION_DAYS"),
            "metrics_days": _env_days("CHAT_RETENTION_DAYS"),
            "feedback_days": _env_days("CHAT_RETENTION_DAYS"),
        }
        stored = self._read("retention.json", {})
        if isinstance(stored, dict):
            defaults.update({key: max(0, int(value)) for key, value in stored.items() if key in defaults and str(value).isdigit()})
            if stored.get("updated_at"):
                defaults["updated_at"] = stored["updated_at"]
        return defaults

    def set_retention_policy(self, policy: dict, actor: Optional[str] = None) -> dict:
        current = self.get_retention_policy()
        updated = {key: int(policy.get(key, current[key])) for key in (
            "chat_days", "source_copy_days", "embedding_days", "audit_event_days", "metrics_days", "feedback_days"
        )}
        updated["updated_at"] = _now()
        updated["updated_by"] = actor
        self._write("retention.json", updated)
        return updated

    def get_dlp_action(self) -> str:
        stored = self._read("data_policy.json", {})
        action = stored.get("dlp_action") if isinstance(stored, dict) else None
        if action in {"flag", "redact", "block"}:
            return action
        configured = (os.environ.get("DLP_ACTION") or "flag").strip().lower()
        return configured if configured in {"flag", "redact", "block"} else "flag"

    def set_dlp_action(self, action: str, actor: Optional[str] = None) -> dict:
        record = {"dlp_action": action, "updated_at": _now(), "updated_by": actor}
        self._write("data_policy.json", record)
        return record

    def get_admin_policy(self) -> dict:
        connector_default = [item.strip() for item in os.environ.get("APPROVED_CONNECTOR_KINDS", "local_folder,google_drive,sharepoint,rest_api").split(",") if item.strip()]
        action_default = [item.strip() for item in os.environ.get("ACTION_ALLOWLIST", "draft_follow_up,draft_incident_summary,draft_onboarding_plan,draft_it_access_request,draft_policy_acknowledgement,draft_support_reply").split(",") if item.strip()]
        defaults = {
            "approved_connector_kinds": connector_default,
            "approved_models": [],
            "web_access": "disabled",
            "allowed_data_classes": ["internal", "personal", "restricted"],
            "allowed_tools": ["search", "source_preview", "draft_actions"],
            "action_scopes": action_default,
        }
        stored = self._read("admin_policy.json", {})
        if isinstance(stored, dict):
            for key in defaults:
                if key in stored:
                    defaults[key] = stored[key]
            if stored.get("updated_at"):
                defaults["updated_at"] = stored["updated_at"]
                defaults["updated_by"] = stored.get("updated_by")
        return defaults

    def set_admin_policy(self, policy: dict, actor: Optional[str] = None) -> dict:
        current = self.get_admin_policy()
        updated = {key: policy.get(key, current[key]) for key in (
            "approved_connector_kinds", "approved_models", "web_access", "allowed_data_classes", "allowed_tools", "action_scopes"
        )}
        updated["updated_at"] = _now()
        updated["updated_by"] = actor
        self._write("admin_policy.json", updated)
        return updated

    def upsert_document(self, source: str, changes: dict, actor: Optional[str] = None) -> dict:
        documents = self._documents()
        current = self.get_document(source)
        history = list(current.get("history", []))
        change_note = changes.pop("change_note", None)
        changed = {
            key: (value.isoformat() if hasattr(value, "isoformat") else value)
            for key, value in changes.items()
            if value is not None
        }
        current.update(changed)
        current["source"] = source
        current.setdefault("created_at", _now())
        current["history"] = history + [{"at": _now(), "actor": actor, "note": change_note or "Metadata updated"}]
        documents[source] = current
        self._write("documents.json", documents)
        return current

    def remove_document(self, source: str) -> None:
        documents = self._documents()
        if source in documents:
            del documents[source]
            self._write("documents.json", documents)

    def find_by_fingerprint(self, fingerprint: str, exclude: Optional[str] = None) -> Optional[str]:
        for source, record in self._documents().items():
            if source != exclude and record.get("fingerprint") == fingerprint:
                return source
        return None

    def add_feedback(self, record: dict) -> dict:
        feedback = self._read("feedback.json", [])
        entry = {"id": uuid.uuid4().hex[:12], "created_at": _now(), **record}
        feedback.append(entry)
        self._write("feedback.json", feedback)
        return entry

    def list_feedback(self) -> list[dict]:
        return self._read("feedback.json", [])

    def delete_user_records(self, user_id: str) -> dict[str, int]:
        removed = {}
        for filename in ("feedback.json", "reviews.json"):
            records = self._read(filename, [])
            kept = [record for record in records if record.get("user_id") != user_id]
            removed[filename] = len(records) - len(kept)
            if len(kept) != len(records):
                self._write(filename, kept)
        return removed

    def add_review(self, record: dict) -> dict:
        reviews = self._read("reviews.json", [])
        entry = {"id": uuid.uuid4().hex[:12], "created_at": _now(), "status": "open", **record}
        reviews.append(entry)
        self._write("reviews.json", reviews)
        return entry

    def list_reviews(self) -> list[dict]:
        return self._read("reviews.json", [])

    def update_review(self, review_id: str, changes: dict, actor: Optional[str] = None) -> Optional[dict]:
        reviews = self.list_reviews()
        for review in reviews:
            if review.get("id") == review_id:
                review.update(changes)
                review["updated_at"] = _now()
                review["updated_by"] = actor
                self._write("reviews.json", reviews)
                return review
        return None

    def analytics(self) -> dict:
        feedback = self.list_feedback()
        reviews = self.list_reviews()
        audit = self.list_audit(limit=10000)
        event_counts = {
            event: sum(1 for item in audit if item.get("event") == event)
            for event in (
                "sign_in", "search", "slack_search", "source_access", "source_click", "no_result",
                "answer_generated", "answer_fallback", "audit_export", "analytics_export",
            )
        }
        return {
            "feedback_total": len(feedback),
            "feedback_by_kind": {kind: sum(1 for item in feedback if item.get("kind") == kind) for kind in (
                "helpful", "not_helpful", "incorrect", "missing_source", "report_concern"
            )},
            "open_reviews": sum(1 for item in reviews if item.get("status") in ("open", "in_review")),
            "review_total": len(reviews),
            "active_users": len({item.get("actor") for item in audit if item.get("event") == "sign_in" and item.get("actor")}),
            "questions": event_counts["search"] + event_counts["slack_search"],
            "source_accesses": event_counts["source_access"],
            "source_clicks": event_counts["source_click"],
            "no_result_queries": event_counts["no_result"],
            "fallback_answers": event_counts["answer_fallback"],
            "exports": event_counts["audit_export"] + event_counts["analytics_export"],
        }

    def add_audit(self, event: str, actor: Optional[str] = None, detail: Optional[str] = None) -> dict:
        audit = self._read("audit.json", [])
        entry = {
            "id": uuid.uuid4().hex[:12],
            "created_at": _now(),
            "event": event,
            "actor": actor,
            "detail_hash": hashlib.sha256(detail.encode("utf-8")).hexdigest() if detail else None,
        }
        audit.append(entry)
        self._write("audit.json", audit)
        return entry

    def list_audit(self, limit: int = 200) -> list[dict]:
        return self._read("audit.json", [])[-limit:][::-1]

    def apply_retention(self, audit_days: int, feedback_days: Optional[int] = None) -> int:
        """Prune audit, review, and feedback records by their configured windows."""
        if feedback_days is None:
            feedback_days = audit_days
        removed = 0
        for filename, days in (("feedback.json", feedback_days), ("reviews.json", feedback_days), ("audit.json", audit_days)):
            if days <= 0:
                continue
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            records = self._read(filename, [])
            kept = []
            for record in records:
                stamp = record.get("created_at") or record.get("updated_at")
                try:
                    old = stamp and datetime.fromisoformat(stamp.replace("Z", "+00:00")) < cutoff
                except ValueError:
                    old = False
                if old:
                    removed += 1
                else:
                    kept.append(record)
            if len(kept) != len(records):
                self._write(filename, kept)
        return removed


knowledge_store = KnowledgeStore()
