"""OrgChai FastAPI application."""

import os
import asyncio
import hashlib
import hmac
import json
import logging
import re
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from opsmate.auth import CurrentUser, configured_organization_id, get_current_user, init_firebase, is_admin_email, organization_claim_name, organization_claim_required, require_role, verify_api_key
from opsmate.actions import action_store
from opsmate.answer_blocks import build_answer_blocks
from opsmate.backups import backup_store
from opsmate.connectors import connector_store, download_remote_file, fetch_google_drive, fetch_rest_api, fetch_sharepoint, public_connector
from opsmate.dlp import process_text
from opsmate.discovery import discovery_store
from opsmate.directory import directory_store
from opsmate.evaluation import evaluation_store
from opsmate.ingestion import OCR_EXTENSIONS, SUPPORTED_EXTENSIONS, extract_text, supported_path
from opsmate.llm import generate_answer
from opsmate.knowledge import knowledge_store
from opsmate.metrics import metrics_store
from opsmate.models import (
    AskRequest,
    AdminPolicyRequest,
    ConnectorCreateRequest,
    ConnectorUpdateRequest,
    CollectionRequest,
    ActionDecisionRequest,
    ActionProposalRequest,
    DeleteChatsRequest,
    DeleteUserDataRequest,
    DlpPolicyRequest,
    DirectoryUserRequest,
    DocumentMetadataRequest,
    EvaluationCaseRequest,
    FeedbackRequest,
    GlossaryRequest,
    IngestResponse,
    RenameChatRequest,
    RetentionApplyRequest,
    RetentionPolicyRequest,
    ReviewUpdateRequest,
    SearchRequest,
    SavedSearchRequest,
    SendChatRequest,
    SlackSummaryRequest,
    SlackDigestRequest,
    SourceClickRequest,
    WorkflowProposalRequest,
)
from opsmate.retriever import retriever
from opsmate.recaps import recap_store
from opsmate.storage import chat_store
from opsmate.users import get_user, upsert_user
from opsmate.workflows import WORKFLOW_TEMPLATES, get_workflow

BASE_DIR = Path(__file__).resolve().parent
logger = logging.getLogger("orgchai.api")
_legacy_docs_dir = BASE_DIR / "documents"
_default_docs_dir = BASE_DIR.parent / "data" / "documents"
DOCS_DIR = Path(os.environ.get("DOCS_DIR") or (_legacy_docs_dir if _legacy_docs_dir.exists() else _default_docs_dir)).resolve()
DOCS_DIR.mkdir(parents=True, exist_ok=True)


def ok(data, **extra):
    payload = {"success": True, "data": data}
    payload.update(extra)
    return payload


def audit_fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _load_seed_documents() -> None:
    for path in DOCS_DIR.glob("*.txt"):
        try:
            text = path.read_text(encoding="utf-8")
            retriever.ingest(text, path.name)
            metadata = knowledge_store.get_document(path.name)
            if not metadata.get("history") or not metadata.get("created_at"):
                created_at = metadata.get("created_at") or datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
                knowledge_store.upsert_document(path.name, {"title": path.stem.replace("_", " "), "status": "approved", "created_at": created_at}, actor="system")
        except Exception:
            continue


def _retention_policy() -> dict:
    return knowledge_store.get_retention_policy()


def _dlp_action() -> str:
    return knowledge_store.get_dlp_action()


def _encryption_at_rest() -> str:
    configured = (os.environ.get("DATA_AT_REST_ENCRYPTION") or "platform-managed").strip().lower()
    return configured if configured in {"platform-managed", "application-managed", "disabled"} else "platform-managed"


def _identity_provider() -> dict[str, str | bool]:
    provider_id = (os.environ.get("FIREBASE_SSO_PROVIDER_ID") or "").strip()
    provider_type = (os.environ.get("FIREBASE_SSO_PROVIDER_TYPE") or "oidc").strip().lower()
    if provider_type not in {"oidc", "saml"}:
        provider_type = "oidc"
    return {
        "provider_id": provider_id or "google.com",
        "provider_type": provider_type if provider_id else "google",
        "enterprise_sso_configured": bool(provider_id),
        "scim_configured": bool((os.environ.get("SCIM_BEARER_TOKEN") or "").strip()),
        "scim_endpoint": "/api/scim/v2",
    }


def _document_created_at(source: str, metadata: dict) -> datetime | None:
    stamp = metadata.get("created_at")
    if not stamp:
        history = metadata.get("history") or []
        if history:
            stamp = history[0].get("at")
    if not stamp:
        path = DOCS_DIR / Path(source).name
        try:
            stamp = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        except OSError:
            return None
    try:
        return datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
    except ValueError:
        return None


def _apply_retention_policy() -> dict[str, int]:
    policy = _retention_policy()
    removed = {
        "chats": chat_store.apply_retention(policy["chat_days"]),
        "audit_events": knowledge_store.apply_retention(policy["audit_event_days"], policy["feedback_days"]),
        "metrics": metrics_store.apply_retention(policy["metrics_days"]),
        "source_copies": 0,
        "embeddings": 0,
    }
    now = datetime.now(timezone.utc)
    source_cutoff = now - timedelta(days=policy["source_copy_days"]) if policy["source_copy_days"] > 0 else None
    embedding_cutoff = now - timedelta(days=policy["embedding_days"]) if policy["embedding_days"] > 0 else None
    if source_cutoff is None and embedding_cutoff is None:
        return removed

    for record in knowledge_store.list_documents():
        source = str(record.get("source") or "")
        if not source:
            continue
        created_at = _document_created_at(source, record)
        if created_at is None:
            continue
        remove_source_copy = source_cutoff is not None and created_at < source_cutoff
        remove_embedding = embedding_cutoff is not None and created_at < embedding_cutoff
        if remove_source_copy or remove_embedding:
            removed["embeddings"] += retriever.remove_source(source)
        if remove_source_copy:
            path = DOCS_DIR / Path(source).name
            try:
                path.unlink()
                removed["source_copies"] += 1
            except FileNotFoundError:
                removed["source_copies"] += 1
            except OSError:
                continue
            knowledge_store.remove_document(source)
    return removed


def _record_answer_metric(started_at: float, model: str, source_count: int) -> None:
    try:
        rate = float(os.environ.get("MODEL_COST_PER_1K_TOKENS", "0") or "0")
    except ValueError:
        rate = 0
    estimated_tokens = max(1, source_count * 120)
    metrics_store.record(
        "answer",
        latency_ms=round((time.monotonic() - started_at) * 1000, 1),
        model=model,
        source_count=source_count,
        estimated_cost=round((estimated_tokens / 1000) * rate, 6),
    )


def _source_payload(source, request_base: str | None = None) -> dict:
    metadata = knowledge_store.get_document(source.source)
    preview_url = f"/api/proxy/api/documents/{quote(source.source)}"
    return {
        **source.model_dump(),
        "title": metadata.get("title") or source.source,
        "source_url": metadata.get("source_url"),
        "preview_url": preview_url if request_base is None else f"{request_base}{preview_url}",
        "status": metadata.get("status", "draft"),
        "owner": metadata.get("owner"),
        "subject_matter_expert": metadata.get("subject_matter_expert"),
        "source_system": metadata.get("source_system"),
        "topic": metadata.get("topic"),
        "department": metadata.get("department"),
        "duplicate_of": metadata.get("duplicate_of"),
        "data_classification": metadata.get("data_classification"),
        "dlp_findings": metadata.get("dlp_findings", {}),
        "reviewed_at": metadata.get("last_reviewed_at"),
        "expires_at": metadata.get("expiration_date"),
        "provenance": "indexed document",
        "structured": build_answer_blocks(source.text, metadata),
    }


def _conversation_context(chat: dict, limit: int = 6) -> str:
    messages = chat.get("messages", [])[-limit:]
    return "\n".join(f"{message.get('role', 'user')}: {message.get('content', '')}" for message in messages)


def _eligible_sources(sources: list, user_email: str | None, is_admin: bool = False) -> list:
    today = date.today().isoformat()
    normalized_email = (user_email or "").lower()
    eligible = []
    for source in sources:
        metadata = knowledge_store.get_document(source.source)
        allowed_emails = [str(email).lower() for email in metadata.get("allowed_emails", [])]
        allowed_domains = [str(domain).lower().lstrip("@") for domain in metadata.get("allowed_domains", [])]
        allowed_groups = {str(group).lower() for group in metadata.get("allowed_groups", [])}
        email_domain = normalized_email.split("@", 1)[1] if "@" in normalized_email else ""
        user_groups = directory_store.groups_for(user_email)
        if (allowed_emails or allowed_domains or allowed_groups) and not is_admin and normalized_email not in allowed_emails and email_domain not in allowed_domains and not allowed_groups.intersection(user_groups):
            knowledge_store.add_audit("permission_denied", actor=user_email, detail=source.source)
            continue
        if metadata.get("status") in {"draft", "expired", "archived", "superseded"}:
            continue
        if (metadata.get("expiration_date") or "9999-12-31") < today:
            continue
        boost = 0.0
        for collection in discovery_store.collections():
            if source.source in collection.get("source_ids", []):
                boost = max(boost, float(collection.get("boost", 0)) * 0.02)
                if collection.get("authoritative"):
                    boost = max(boost, 0.1)
        if boost and source.score is not None:
            source.score = min(1.0, source.score + boost)
        eligible.append(source)
    return sorted(eligible, key=lambda source: source.score or 0, reverse=True)


def _source_access_allowed(source: str, user: CurrentUser) -> bool:
    if user.is_admin:
        return True
    metadata = knowledge_store.get_document(source)
    status = metadata.get("status")
    if status in {"expired", "archived", "superseded"}:
        return False
    if status == "draft" and user.role not in {"admin", "knowledge_owner", "reviewer", "auditor", "connector_admin"}:
        return False
    if (metadata.get("expiration_date") or "9999-12-31") < date.today().isoformat():
        return False
    allowed_emails = [str(email).lower() for email in metadata.get("allowed_emails", [])]
    allowed_domains = [str(domain).lower().lstrip("@") for domain in metadata.get("allowed_domains", [])]
    allowed_groups = {str(group).lower() for group in metadata.get("allowed_groups", [])}
    normalized_email = (user.email or "").lower()
    email_domain = normalized_email.split("@", 1)[1] if "@" in normalized_email else ""
    allowed = not (allowed_emails or allowed_domains or allowed_groups) or normalized_email in allowed_emails or email_domain in allowed_domains or bool(allowed_groups.intersection(directory_store.groups_for(user.email)))
    if not allowed:
        knowledge_store.add_audit("permission_denied", actor=user.email, detail=source)
    return allowed


def _retrieval_allowed_sources(user: CurrentUser) -> set[str] | None:
    """Build the ACL-filtered source set before any retrieval work begins."""
    if user.is_admin:
        return None
    indexed_sources = {chunk.source for chunk in retriever.chunks}
    return {source for source in indexed_sources if _source_access_allowed(source, user)}


def _matches_search_filters(source: str, request: SearchRequest) -> bool:
    metadata = knowledge_store.get_document(source)
    for key in ("source_system", "status", "owner", "topic", "department"):
        expected = getattr(request, key)
        if expected and expected.lower() not in str(metadata.get(key) or "").lower():
            return False
    effective_date = metadata.get("effective_date")
    if request.effective_from and (not effective_date or effective_date < request.effective_from.isoformat()):
        return False
    if request.effective_to and (not effective_date or effective_date > request.effective_to.isoformat()):
        return False
    if request.collection_id:
        collection = discovery_store.get_collection(request.collection_id)
        if not collection or source not in collection.get("source_ids", []):
            return False
    return True


def _reconcile_connector_sources(connector: dict, previous: set[str], current: set[str], errors: list[str]) -> tuple[int, int, list[str]]:
    """Remove confirmed deletions and quarantine sources missing from an incomplete crawl."""
    missing = previous - current
    quarantined = missing if errors else set()
    for stale_source in missing:
        retriever.remove_source(stale_source)
        knowledge_store.remove_document(stale_source)
    removed = len(missing) if not errors else 0
    updated_quarantine = sorted(quarantined)
    connector_store.update(connector["id"], {
        "last_removed_count": removed,
        "quarantined_sources": updated_quarantine,
    })
    return removed, len(updated_quarantine), updated_quarantine


def _sync_local_folder(connector: dict) -> dict:
    started_at = time.monotonic()
    root = Path(connector.get("config", {}).get("root_path", "")).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=400, detail="Connector folder is unavailable")
    connector_id = connector["id"]
    previous = set(connector.get("indexed_sources", []))
    current: set[str] = set()
    errors: list[str] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            continue
        if not supported_path(path) or any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        source = f"{connector_id}__{path.relative_to(root).as_posix().replace('/', '__')}"
        try:
            text = extract_text(path.read_bytes(), path.suffix)
            processed_text, dlp_report = process_text(text, _dlp_action())
            if dlp_report["blocked"]:
                raise ValueError("DLP policy blocked this source")
            retriever.ingest(processed_text, source)
            fingerprint = hashlib.sha256(processed_text.strip().encode("utf-8")).hexdigest()
            knowledge_store.upsert_document(
                source,
                {
                    "title": path.name,
                    "status": "draft",
                    "source_system": "local_folder",
                    "connector_id": connector_id,
                    "relative_path": path.relative_to(root).as_posix(),
                    "fingerprint": fingerprint,
                    "duplicate_of": knowledge_store.find_by_fingerprint(fingerprint, exclude=source),
                    "data_classification": dlp_report["classification"],
                    "dlp_findings": dlp_report["findings"],
                },
                actor="connector",
            )
            current.add(source)
        except Exception as exc:
            logger.warning("Connector source indexing failed")
            errors.append("Source could not be indexed")
    removed, quarantined, quarantined_sources = _reconcile_connector_sources(connector, previous, current, errors)
    updated = connector_store.update(connector_id, {
        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
        "last_success_at": datetime.now(timezone.utc).isoformat() if not errors else connector.get("last_success_at"),
        "last_error": "; ".join(errors[:5]) if errors else None,
        "failure_count": int(connector.get("failure_count", 0)) + (1 if errors else 0),
        "last_sync_duration_ms": round((time.monotonic() - started_at) * 1000),
        "stale_count": len(previous - current),
        "indexed_sources": sorted(current),
        "quarantined_sources": quarantined_sources,
    })
    return {"connector": updated, "indexed": len(current), "removed": removed, "quarantined": quarantined, "errors": errors}


def _sync_remote_connector(connector: dict) -> dict:
    started_at = time.monotonic()
    connector_id = connector["id"]
    items = fetch_google_drive(connector) if connector.get("kind") == "google_drive" else fetch_sharepoint(connector) if connector.get("kind") == "sharepoint" else fetch_rest_api(connector)
    previous = set(connector.get("indexed_sources", []))
    current: set[str] = set()
    errors: list[str] = []
    for item in items:
        source = f"{connector_id}__remote__{item['id']}"
        try:
            content = download_remote_file(item, connector)
            text = extract_text(content, item["extension"])
            processed_text, dlp_report = process_text(text, _dlp_action())
            if dlp_report["blocked"]:
                raise ValueError("DLP policy blocked this source")
            retriever.ingest(processed_text, source)
            fingerprint = hashlib.sha256(processed_text.strip().encode("utf-8")).hexdigest()
            knowledge_store.upsert_document(
                source,
                {
                    "title": item["name"],
                    "source_url": item.get("source_url"),
                    "status": "draft",
                    "source_system": connector.get("kind"),
                    "connector_id": connector_id,
                    "relative_path": item["name"],
                    "fingerprint": fingerprint,
                    "duplicate_of": knowledge_store.find_by_fingerprint(fingerprint, exclude=source),
                    "data_classification": dlp_report["classification"],
                    "dlp_findings": dlp_report["findings"],
                },
                actor="connector",
            )
            current.add(source)
        except Exception:
            logger.warning("Remote connector source indexing failed")
            errors.append("Source could not be indexed")
    removed, quarantined, quarantined_sources = _reconcile_connector_sources(connector, previous, current, errors)
    updated = connector_store.update(connector_id, {
        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
        "last_success_at": datetime.now(timezone.utc).isoformat() if not errors else connector.get("last_success_at"),
        "last_error": "; ".join(errors[:5]) if errors else None,
        "failure_count": int(connector.get("failure_count", 0)) + (1 if errors else 0),
        "last_sync_duration_ms": round((time.monotonic() - started_at) * 1000),
        "stale_count": len(previous - current),
        "indexed_sources": sorted(current),
        "quarantined_sources": quarantined_sources,
    })
    return {"connector": updated, "indexed": len(current), "removed": removed, "quarantined": quarantined, "errors": errors}


def _sync_connector_record(connector: dict) -> dict:
    if connector.get("status") == "paused":
        raise RuntimeError("Connector is paused")
    if connector.get("kind") == "local_folder":
        return _sync_local_folder(connector)
    if connector.get("kind") in {"google_drive", "sharepoint", "rest_api"}:
        return _sync_remote_connector(connector)
    raise RuntimeError("Connector kind is not supported")


def _sync_connector_with_retries(connector: dict) -> dict:
    max_retries = max(0, min(int(connector.get("retry_limit", 3)), 5))
    backoff_seconds = max(0, min(int(connector.get("retry_backoff_seconds", 5)), 3600))
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            result = _sync_connector_record(connector)
            updated = connector_store.update(connector["id"], {"retry_count": attempt})
            if updated is not None:
                result["connector"] = updated
            result["attempts"] = attempt + 1
            return result
        except Exception as exc:
            last_error = exc
            if attempt < max_retries and backoff_seconds:
                time.sleep(backoff_seconds * (2 ** attempt))
    current = connector_store.get(connector["id"])
    if current is not None:
        connector_store.update(connector["id"], {
            "last_attempt_at": datetime.now(timezone.utc).isoformat(),
            "last_error": "Connector sync failed after retry policy",
            "failure_count": int(current.get("failure_count", 0)) + 1,
            "retry_count": max_retries,
        })
    raise last_error or RuntimeError("Connector sync failed")


def _connector_sync_due(connector: dict) -> bool:
    schedule = str(connector.get("schedule") or "").strip().lower()
    if connector.get("status") != "active" or schedule not in {"hourly", "daily"}:
        return False
    last_run = connector.get("last_success_at") or connector.get("last_attempt_at")
    if not last_run:
        return True
    try:
        previous = datetime.fromisoformat(str(last_run).replace("Z", "+00:00"))
    except ValueError:
        return True
    interval = timedelta(hours=1) if schedule == "hourly" else timedelta(days=1)
    return datetime.now(timezone.utc) - previous >= interval


_ANSWER_STOP_WORDS = {
    "about", "after", "again", "also", "and", "are", "can", "could", "does", "for", "from",
    "how", "into", "is", "it", "our", "please", "tell", "that", "the", "their", "this", "what",
    "when", "where", "which", "who", "why", "with", "would", "you", "your",
}
_CLAIM_UNITS = {"day", "days", "week", "weeks", "hour", "hours", "minute", "minutes", "month", "months", "year", "years"}


def _has_meaningful_evidence(question: str, source: object) -> bool:
    """Reject lexical false positives when retrieval found no query concept in a source."""
    question_tokens = {
        token
        for token in re.findall(r"[^\W_]+", discovery_store.expand_query(question).lower(), flags=re.UNICODE)
        if len(token) >= 3 and token not in _ANSWER_STOP_WORDS
    }
    if not question_tokens:
        return True

    evidence = " ".join(
        str(value or "")
        for value in (getattr(source, "text", ""), getattr(source, "source", ""))
    ).lower()
    evidence_tokens = set(re.findall(r"[^\W_]+", evidence, flags=re.UNICODE))
    return bool(question_tokens & evidence_tokens)


def _numeric_claims(text: str) -> list[tuple[float, str, set[str]]]:
    claims = []
    for match in re.finditer(r"\b(\d+(?:\.\d+)?)\s+(day|days|week|weeks|hour|hours|minute|minutes|month|months|year|years)\b", text.lower()):
        start = max(0, match.start() - 120)
        end = min(len(text), match.end() + 120)
        context = text[start:end]
        terms = set(re.findall(r"[^\W_]+", context.lower(), flags=re.UNICODE))
        terms -= _ANSWER_STOP_WORDS
        terms -= _CLAIM_UNITS
        terms.discard(match.group(1))
        claims.append((float(match.group(1)), match.group(2).rstrip("s"), terms))
    return claims


def _conflicting_claims(question: str, sources: list) -> list[dict]:
    question_terms = set(re.findall(r"[^\W_]+", question.lower(), flags=re.UNICODE))
    question_terms -= _ANSWER_STOP_WORDS
    question_terms -= _CLAIM_UNITS
    claims = []
    for source in sources:
        for value, unit, terms in _numeric_claims(str(getattr(source, "text", ""))):
            claims.append({"source": source.source, "value": value, "unit": unit, "terms": terms})
    conflicts = []
    for index, first in enumerate(claims):
        for second in claims[index + 1:]:
            if first["source"] == second["source"] or first["unit"] != second["unit"] or first["value"] == second["value"]:
                continue
            shared_terms = (first["terms"] & second["terms"]) & question_terms
            if not shared_terms:
                continue
            conflicts.append({
                "sources": sorted({first["source"], second["source"]}),
                "claim": " / ".join(f"{int(item['value']) if item['value'].is_integer() else item['value']} {item['unit']}" for item in (first, second)),
                "terms": sorted(shared_terms),
            })
    return conflicts


def _review_kind(question: str, sources: list, abstained: bool) -> tuple[str | None, list[dict]]:
    conflicts = _conflicting_claims(question, sources)
    if conflicts:
        return "conflicting", conflicts
    if abstained:
        return "unanswered", []
    low_confidence_score = float(os.environ.get("LOW_CONFIDENCE_REVIEW_SCORE", "0.5"))
    if sources and max((source.score or 0) for source in sources) < low_confidence_score:
        return "low_confidence", []
    return None, []


def _answer(question: str, sources: list, *, mode: str = "answer", language: str = "default", context: str = "") -> tuple[str, str, bool]:
    threshold = float(os.environ.get("MIN_RETRIEVAL_SCORE", "0.08"))
    strong_sources = [source for source in sources if (source.score or 0) >= threshold]
    if strong_sources and not any(_has_meaningful_evidence(question, source) for source in strong_sources):
        strong_sources = []
    if not strong_sources:
        return (
            "I could not find an approved, current source that answers this question. "
            "Try rephrasing it or ask an administrator to review the knowledge base.",
            "abstention",
            True,
        )
    conflicts = _conflicting_claims(question, strong_sources)
    if conflicts:
        return (
            "I found conflicting approved sources for this question, so I did not choose one value. "
            "Review the cited sources or ask an administrator to resolve the policy conflict.",
            "conflict-abstention",
            True,
        )
    answer, model = generate_answer(question, strong_sources, conversation_context=context, mode=mode, language=language)
    return answer, model, False


_slack_app = None
_slack_req_handler = None


def _start_slack() -> None:
    global _slack_app, _slack_req_handler
    import logging

    log = logging.getLogger("orgchai.main")
    try:
        from opsmate.slack_bot import create_slack_app, slack_status, start_socket_mode

        status_before = slack_status()
        log.info(
            "Slack config: enabled=%s, socket_mode=%s, ready=%s",
            status_before["enabled"],
            status_before["socket_mode"],
            status_before.get("ready"),
        )

        _slack_app = create_slack_app()
        if _slack_app is not None:
            from slack_bolt.adapter.fastapi import SlackRequestHandler

            _slack_req_handler = SlackRequestHandler(_slack_app)
            if slack_status()["socket_mode"]:
                log.info("Starting Slack Socket Mode...")
                start_socket_mode(_slack_app)
            else:
                log.warning("Socket Mode not configured (SLACK_APP_TOKEN not set)")
        else:
            log.warning("Slack app not created (SLACK_BOT_TOKEN not set)")
    except Exception as exc:
        log.exception("Slack integration failed to start: %s", exc)


def _run_digest(digest: dict) -> dict:
    from opsmate.slack_bot import post_slack_digest, summarize_slack_channel

    summaries = [
        summarize_slack_channel(
            channel_id=channel_id,
            limit=int(digest.get("limit", 50)),
            language=digest.get("language", "default"),
            user_email=digest.get("owner_email"),
        )
        for channel_id in digest.get("channel_ids", [])
    ]
    delivery = None
    destination = digest.get("destination_channel")
    if destination:
        delivery = post_slack_digest(destination, summaries)
    recap_store.mark_run(digest["id"])
    knowledge_store.add_audit("slack_digest_run", actor=digest.get("owner_email"), detail=digest["id"])
    return {"digest": digest, "summaries": summaries, "delivery": delivery}


async def _digest_scheduler() -> None:
    while True:
        await asyncio.sleep(60)
        if os.environ.get("SLACK_DIGESTS_ENABLED", "false").lower() not in {"1", "true", "yes"}:
            continue
        for digest in recap_store.due():
            try:
                _run_digest(digest)
            except Exception:
                logger.exception("Scheduled Slack digest failed")


async def _connector_scheduler() -> None:
    while True:
        await asyncio.sleep(60)
        for connector in connector_store.list():
            if not _connector_sync_due(connector):
                continue
            try:
                await asyncio.to_thread(_sync_connector_with_retries, connector)
                knowledge_store.add_audit("connector_sync", actor="scheduler", detail=connector.get("id"))
            except Exception:
                logger.exception("Scheduled connector sync failed for %s", connector.get("id"))
                current = connector_store.get(str(connector.get("id")))
                if current is not None:
                    connector_store.update(str(connector.get("id")), {
                        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                        "last_error": "Scheduled sync failed",
                        "failure_count": int(current.get("failure_count", 0)) + 1,
                    })


async def _retention_scheduler() -> None:
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(_apply_retention_policy)
        except Exception:
            logger.exception("Scheduled retention cleanup failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    _load_seed_documents()
    _apply_retention_policy()
    _start_slack()
    scheduler = asyncio.create_task(_digest_scheduler())
    connector_scheduler = asyncio.create_task(_connector_scheduler())
    retention_scheduler = asyncio.create_task(_retention_scheduler())
    try:
        yield
    finally:
        scheduler.cancel()
        connector_scheduler.cancel()
        retention_scheduler.cancel()
        await asyncio.gather(scheduler, connector_scheduler, retention_scheduler, return_exceptions=True)


limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(
    title="OrgChai",
    description="Privacy-focused chat for organization knowledge",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_cors_origins = [
    origin.strip().rstrip("/")
    for origin in (os.environ.get("CORS_ORIGIN") or "*").split(",")
    if origin.strip()
]
_allow_all_cors = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all_cors else _cors_origins,
    allow_credentials=not _allow_all_cors,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content={"success": False, "error": message})


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_request: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
        message = str(error.get("msg") or "Invalid value")
        messages.append(f"{location}: {message}" if location else message)
    return JSONResponse(
        status_code=422,
        content={"success": False, "error": "; ".join(messages)[:500] or "Invalid request"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled request error", exc_info=exc)
    return JSONResponse(status_code=500, content={"success": False, "error": "Internal server error"})


@app.get("/", dependencies=[Depends(verify_api_key)])
async def root():
    return {
        "name": "orgchai-api",
        "version": "0.1.0",
        "status": "running",
        "docs": "/api/health",
    }


@app.get("/api/health", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def health(request: Request):
    db_ok = False
    try:
        url = os.environ.get("DATABASE_URL")
        if url:
            import psycopg2

            with psycopg2.connect(url) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
            db_ok = True
    except Exception:
        db_ok = False
    return ok({"status": "ok", "chunks": len(retriever.chunks), "db": db_ok})


@app.get("/api/admin/backups", dependencies=[Depends(verify_api_key)])
async def list_backups(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "auditor")
    return ok({
        "configured": bool(os.environ.get("DATABASE_URL")) and shutil.which("pg_dump") is not None,
        "retention_count": os.environ.get("BACKUP_RETENTION_COUNT", "7"),
        "records": backup_store.list(),
    })


@app.post("/api/admin/backups", dependencies=[Depends(verify_api_key)])
async def create_backup(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor", "analyst")
    try:
        record = await asyncio.to_thread(backup_store.create)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    knowledge_store.add_audit("database_backup_created", actor=user.email, detail=record["filename"])
    return ok(record)


@app.post("/api/users", dependencies=[Depends(verify_api_key)])
async def create_or_update_user(request: Request, token_user: CurrentUser = Depends(get_current_user)):
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Request body must be an object")
    uid = body.get("uid")
    email = token_user.email
    display_name = token_user.display_name
    if not uid or not isinstance(uid, str):
        raise HTTPException(status_code=400, detail="uid is required")

    if token_user.uid != uid:
        raise HTTPException(status_code=403, detail="Token does not match uid")
    if not email:
        raise HTTPException(status_code=400, detail="email is required for new users")

    admin = is_admin_email(email)
    user, is_new = upsert_user(uid, email, display_name, admin)
    user["role"] = token_user.role
    user["organizationId"] = token_user.organization_id
    knowledge_store.add_audit("sign_in", actor=email)
    return ok(user, isNew=is_new, message="User already exists" if not is_new else "User created")


@app.get("/api/users/me", dependencies=[Depends(verify_api_key)])
async def me(user: CurrentUser = Depends(get_current_user)):
    stored = get_user(user.uid) or {
        "id": user.uid,
        "email": user.email,
        "displayName": user.display_name,
        "isAdmin": user.is_admin,
    }
    stored["isAdmin"] = bool(stored.get("isAdmin") or user.is_admin)
    stored["role"] = user.role
    stored["organizationId"] = user.organization_id
    return ok(stored)


@app.get("/api/admin/directory/users", dependencies=[Depends(verify_api_key)])
async def list_directory_users(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin", "auditor")
    return ok(directory_store.list())


@app.post("/api/admin/directory/users", dependencies=[Depends(verify_api_key)])
async def upsert_directory_user(body: DirectoryUserRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin")
    allowed_roles = {"member", "admin", "connector_admin", "knowledge_owner", "reviewer", "analyst", "auditor"}
    if any(role not in allowed_roles for role in body.roles):
        raise HTTPException(status_code=422, detail="Directory role is not supported")
    record = directory_store.upsert(body.model_dump())
    knowledge_store.add_audit("directory_user_upsert", actor=user.email, detail=body.external_id)
    return ok(record)


@app.delete("/api/admin/directory/users/{external_id}", dependencies=[Depends(verify_api_key)])
async def delete_directory_user(external_id: str, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin")
    if not directory_store.remove(external_id):
        raise HTTPException(status_code=404, detail="Directory user not found")
    knowledge_store.add_audit("directory_user_delete", actor=user.email, detail=external_id)
    return ok({"external_id": external_id})


def _verify_scim_token(request: Request) -> None:
    expected = os.environ.get("SCIM_BEARER_TOKEN", "").strip()
    incoming = (request.headers.get("authorization") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Directory provisioning is not configured")
    if not hmac.compare_digest(incoming, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="Invalid directory token")


def _scim_resource(record: dict) -> dict:
    email = str(record.get("email") or "")
    display_name = record.get("display_name") or email
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": record.get("external_id"),
        "externalId": record.get("external_id"),
        "userName": email,
        "displayName": display_name,
        "name": {"formatted": display_name},
        "emails": [{"value": email, "type": "work", "primary": True}] if email else [],
        "active": bool(record.get("active", True)),
        "groups": [{"value": group, "display": group} for group in record.get("groups", [])],
        "roles": [{"value": role, "display": role} for role in record.get("roles", [])],
        "meta": {"resourceType": "User"},
    }


@app.get("/api/scim/v2/ServiceProviderConfig")
async def scim_service_provider_config(request: Request):
    _verify_scim_token(request)
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 1000},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [{"type": "oauthbearertoken", "name": "Bearer token", "description": "Server-configured SCIM bearer token"}],
    }


@app.get("/api/scim/v2/ResourceTypes")
async def scim_resource_types(request: Request):
    _verify_scim_token(request)
    return [{
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        "id": "User",
        "name": "User",
        "endpoint": "/Users",
        "schema": "urn:ietf:params:scim:schemas:core:2.0:User",
    }]


@app.get("/api/scim/v2/Schemas")
async def scim_schemas(request: Request):
    _verify_scim_token(request)
    return [{
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
        "id": "urn:ietf:params:scim:schemas:core:2.0:User",
        "name": "User",
        "description": "OrgChai directory user",
        "attributes": [],
    }]


@app.get("/api/scim/v2/Users")
async def scim_list_users(request: Request, startIndex: int = 1, count: int = 100, filter: str | None = None):
    _verify_scim_token(request)
    records = directory_store.list()
    if filter:
        match = re.fullmatch(r'\s*(userName|externalId)\s+eq\s+"([^"]+)"\s*', filter, flags=re.IGNORECASE)
        if match:
            field = "email" if match.group(1).lower() == "username" else "external_id"
            expected = match.group(2).strip().lower()
            records = [record for record in records if str(record.get(field) or "").strip().lower() == expected]
    start = max(0, startIndex - 1)
    resources = records[start:start + max(1, min(count, 1000))]
    return {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": len(records),
        "startIndex": start + 1,
        "itemsPerPage": len(resources),
        "Resources": [_scim_resource(record) for record in resources],
    }


@app.get("/api/scim/v2/Users/{external_id}")
async def scim_get_user(external_id: str, request: Request):
    _verify_scim_token(request)
    record = directory_store.get(external_id)
    if record is None:
        raise HTTPException(status_code=404, detail="SCIM user not found")
    return _scim_resource(record)


@app.post("/api/scim/v2/Users")
async def scim_create_user(request: Request):
    _verify_scim_token(request)
    payload = await request.json()
    emails = payload.get("emails") or []
    email = next((item.get("value") for item in emails if isinstance(item, dict) and item.get("value")), payload.get("userName"))
    external_id = payload.get("externalId") or payload.get("id") or email
    if not isinstance(email, str) or not isinstance(external_id, str) or not email.strip() or not external_id.strip():
        raise HTTPException(status_code=422, detail="SCIM userName and externalId are required")
    record = directory_store.upsert({
        "external_id": external_id,
        "email": email,
        "display_name": payload.get("displayName") or ((payload.get("name") or {}).get("formatted")),
        "groups": [item.get("display") or item.get("value") for item in payload.get("groups", []) if isinstance(item, dict)],
        "roles": [item.get("value") or item.get("display") for item in payload.get("roles", []) if isinstance(item, dict)] if isinstance(payload.get("roles", []), list) else [],
        "active": payload.get("active", True),
        "source": "scim",
    })
    knowledge_store.add_audit("scim_user_upsert", actor="scim", detail=external_id)
    return JSONResponse(status_code=201, content=_scim_resource(record))


@app.put("/api/scim/v2/Users/{external_id}")
async def scim_replace_user(external_id: str, request: Request):
    _verify_scim_token(request)
    payload = await request.json()
    emails = payload.get("emails") or []
    email = next((item.get("value") for item in emails if isinstance(item, dict) and item.get("value")), payload.get("userName"))
    if not isinstance(email, str) or not email.strip():
        raise HTTPException(status_code=422, detail="SCIM userName is required")
    record = directory_store.upsert({
        "external_id": external_id,
        "email": email,
        "display_name": payload.get("displayName") or ((payload.get("name") or {}).get("formatted")),
        "groups": [item.get("display") or item.get("value") for item in payload.get("groups", []) if isinstance(item, dict)],
        "roles": [item.get("value") or item.get("display") for item in payload.get("roles", []) if isinstance(item, dict)] if isinstance(payload.get("roles", []), list) else [],
        "active": payload.get("active", True),
        "source": "scim",
    })
    knowledge_store.add_audit("scim_user_replace", actor="scim", detail=external_id)
    return JSONResponse(content=_scim_resource(record))


@app.patch("/api/scim/v2/Users/{external_id}")
async def scim_patch_user(external_id: str, request: Request):
    _verify_scim_token(request)
    existing = directory_store.get(external_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SCIM user not found")
    payload = await request.json()
    updated = dict(existing)
    for operation in payload.get("Operations", []):
        if str(operation.get("op", "")).lower() not in {"replace", "add"}:
            continue
        path = str(operation.get("path", "")).lower().strip()
        value = operation.get("value")
        if not path and isinstance(value, dict):
            if "active" in value:
                updated["active"] = bool(value["active"])
            if isinstance(value.get("groups"), list):
                updated["groups"] = [item.get("value") or item.get("display") for item in value["groups"] if isinstance(item, dict)]
            if isinstance(value.get("roles"), list):
                updated["roles"] = [item.get("value") or item.get("display") for item in value["roles"] if isinstance(item, dict)]
        elif path.endswith("active"):
            updated["active"] = bool(value)
        elif path.endswith("groups") and isinstance(value, list):
            updated["groups"] = [item.get("value") or item.get("display") for item in value if isinstance(item, dict)]
        elif path.endswith("roles") and isinstance(value, list):
            updated["roles"] = [item.get("value") or item.get("display") for item in value if isinstance(item, dict)]
    record = directory_store.upsert(updated)
    knowledge_store.add_audit("scim_user_patch", actor="scim", detail=external_id)
    return JSONResponse(content=_scim_resource(record))


@app.delete("/api/scim/v2/Users/{external_id}")
async def scim_delete_user(external_id: str, request: Request):
    _verify_scim_token(request)
    if not directory_store.remove(external_id):
        raise HTTPException(status_code=404, detail="SCIM user not found")
    knowledge_store.add_audit("scim_user_delete", actor="scim", detail=external_id)
    return Response(status_code=204)


@app.get("/api/users/me/export", dependencies=[Depends(verify_api_key)])
async def export_user_data(user: CurrentUser = Depends(get_current_user)):
    chats = [chat_store.get_chat(summary["id"], user_id=user.uid) for summary in chat_store.list_chats(user_id=user.uid)]
    feedback = [item for item in knowledge_store.list_feedback() if item.get("user_id") == user.uid]
    reviews = [item for item in knowledge_store.list_reviews() if item.get("user_id") == user.uid]
    saved_searches = discovery_store.saved_searches(user.uid)
    proposals = action_store.list(requester_id=user.uid)
    digests = recap_store.list(owner_id=user.uid)
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {"id": user.uid, "email": user.email, "display_name": user.display_name},
        "chats": [chat for chat in chats if chat is not None],
        "feedback": feedback,
        "reviews": reviews,
        "saved_searches": saved_searches,
        "action_proposals": proposals,
        "slack_digests": digests,
    }
    knowledge_store.add_audit("user_export", actor=user.email)
    return Response(
        content=json.dumps(payload, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="orgchai-my-data.json"'},
    )


@app.delete("/api/users/me/data", dependencies=[Depends(verify_api_key)])
async def delete_user_data(body: DeleteUserDataRequest, user: CurrentUser = Depends(get_current_user)):
    knowledge_store.add_audit("user_delete_requested", actor=user.email)
    deleted_chats = chat_store.delete_all(user_id=user.uid)
    deleted_records = knowledge_store.delete_user_records(user.uid)
    deleted_searches = discovery_store.delete_user_searches(user.uid)
    deleted_proposals = action_store.delete_requester(user.uid)
    deleted_digests = recap_store.delete_owner(user.uid)
    return ok({
        "deleted_chats": deleted_chats,
        "deleted_feedback": deleted_records.get("feedback.json", 0),
        "deleted_reviews": deleted_records.get("reviews.json", 0),
        "deleted_saved_searches": deleted_searches,
        "deleted_action_proposals": deleted_proposals,
        "deleted_slack_digests": deleted_digests,
    })


@app.get("/api/slack/status", dependencies=[Depends(verify_api_key)])
async def get_slack_status(_user: CurrentUser = Depends(get_current_user)):
    from opsmate.slack_bot import slack_status

    return ok(slack_status())


@app.post("/api/slack/summary", dependencies=[Depends(verify_api_key)])
async def summarize_slack(body: SlackSummaryRequest, user: CurrentUser = Depends(get_current_user)):
    from opsmate.slack_bot import slack_status, summarize_slack_channel

    if not slack_status().get("ready"):
        raise HTTPException(status_code=503, detail="Slack integration is not ready")

    try:
        result = summarize_slack_channel(
            channel_id=body.channel_id,
            thread_ts=body.thread_ts,
            limit=body.limit,
            language=body.language,
            user_email=user.email,
        )
    except PermissionError:
        knowledge_store.add_audit("permission_denied", actor=user.email, detail=f"slack:{body.channel_id}")
        raise HTTPException(status_code=403, detail="Slack channel is not available")
    except Exception:
        logger.exception("Slack recap failed")
        raise HTTPException(status_code=503, detail="Slack recap unavailable")
    return ok(result)


@app.post("/api/slack/digests", dependencies=[Depends(verify_api_key)])
async def create_slack_digest(body: SlackDigestRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin")
    from opsmate.slack_bot import is_slack_channel_allowed, slack_status

    if not slack_status().get("ready"):
        raise HTTPException(status_code=503, detail="Slack integration is not ready")

    channel_ids = [channel.strip() for channel in body.channel_ids if channel.strip()]
    if not channel_ids or any(not is_slack_channel_allowed(channel) for channel in channel_ids):
        raise HTTPException(status_code=403, detail="Slack source channel is not allowlisted")
    if body.destination_channel and not is_slack_channel_allowed(body.destination_channel):
        raise HTTPException(status_code=403, detail="Slack destination is not allowlisted")
    digest = recap_store.create({
        "owner_id": user.uid,
        "owner_email": user.email,
        "channel_ids": channel_ids,
        "destination_channel": body.destination_channel,
        "schedule": body.schedule,
        "limit": body.limit,
        "language": body.language,
    })
    knowledge_store.add_audit("slack_digest_create", actor=user.email, detail=digest["id"])
    return ok(digest)


@app.get("/api/slack/digests", dependencies=[Depends(verify_api_key)])
async def list_slack_digests(user: CurrentUser = Depends(get_current_user)):
    records = recap_store.list() if user.is_admin or user.role == "connector_admin" else recap_store.list(owner_id=user.uid)
    return ok(records)


@app.post("/api/slack/digests/{digest_id}/run", dependencies=[Depends(verify_api_key)])
async def run_slack_digest(digest_id: str, user: CurrentUser = Depends(get_current_user)):
    from opsmate.slack_bot import slack_status

    if not slack_status().get("ready"):
        raise HTTPException(status_code=503, detail="Slack integration is not ready")

    digest = recap_store.get(digest_id)
    if digest is None or (digest.get("owner_id") != user.uid and not user.is_admin and user.role != "connector_admin"):
        raise HTTPException(status_code=404, detail="Digest not found")
    try:
        result = _run_digest(digest)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Slack channel is not allowlisted")
    except Exception:
        logger.exception("Slack digest failed")
        raise HTTPException(status_code=503, detail="Slack digest unavailable")
    return ok(result)


@app.post("/api/slack/events")
async def slack_events(req: Request):
    import json as _json

    body = await req.body()
    try:
        payload = _json.loads(body)
    except Exception:
        return JSONResponse({"success": False, "error": "Invalid JSON"}, status_code=400)

    if not isinstance(payload, dict):
        return JSONResponse({"success": False, "error": "Invalid event payload"}, status_code=400)

    if payload.get("type") == "url_verification":
        return JSONResponse({"challenge": payload.get("challenge", "")})

    if _slack_req_handler is None:
        return JSONResponse(
            {"success": False, "error": "Slack integration not configured. Set SLACK_BOT_TOKEN."},
            status_code=503,
        )
    return await _slack_req_handler.handle(req)


def _mcp_jsonrpc_response(request_id, result: dict) -> JSONResponse:
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "result": result})


def _mcp_jsonrpc_error(request_id, code: int, message: str) -> JSONResponse:
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


def _mcp_tools() -> list[dict]:
    return [
        {
            "name": "search",
            "description": "Search approved organization sources visible to the authenticated user.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "minLength": 1},
                    "top_k": {"type": "integer", "minimum": 1, "maximum": 50},
                    "source_system": {"type": "string"},
                    "department": {"type": "string"},
                    "topic": {"type": "string"},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
            "annotations": {"readOnlyHint": True, "openWorldHint": False},
        },
        {
            "name": "source_preview",
            "description": "Preview an approved source visible to the authenticated user.",
            "inputSchema": {
                "type": "object",
                "properties": {"source": {"type": "string", "minLength": 1}},
                "required": ["source"],
                "additionalProperties": False,
            },
            "annotations": {"readOnlyHint": True, "openWorldHint": False},
        },
    ]


@app.get("/api/mcp", dependencies=[Depends(verify_api_key)])
async def mcp_capabilities(user: CurrentUser = Depends(get_current_user)):
    knowledge_store.add_audit("mcp_discovery", actor=user.email)
    return ok({
        "protocol_version": "2025-06-18",
        "transport": "HTTP JSON-RPC",
        "authentication": "Firebase ID token plus server API key",
        "tools": _mcp_tools(),
        "read_only": True,
        "audit_events": ["mcp_discovery", "mcp_tool_call", "permission_denied"],
    })


@app.post("/api/mcp", dependencies=[Depends(verify_api_key)])
async def mcp_rpc(request: Request, user: CurrentUser = Depends(get_current_user)):
    try:
        payload = await request.json()
    except Exception:
        return _mcp_jsonrpc_error(None, -32700, "Invalid JSON")
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0" or not isinstance(payload.get("method"), str):
        return _mcp_jsonrpc_error(payload.get("id") if isinstance(payload, dict) else None, -32600, "Invalid JSON-RPC request")

    request_id = payload.get("id")
    method = payload["method"]
    if method == "notifications/initialized":
        return Response(status_code=204)
    if method == "initialize":
        knowledge_store.add_audit("mcp_discovery", actor=user.email)
        return _mcp_jsonrpc_response(request_id, {
            "protocolVersion": "2025-06-18",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "OrgChai", "version": "1.0"},
            "instructions": "Only read-only, permission-filtered organization knowledge tools are exposed.",
        })
    if method == "tools/list":
        knowledge_store.add_audit("mcp_discovery", actor=user.email)
        return _mcp_jsonrpc_response(request_id, {"tools": _mcp_tools()})
    if method != "tools/call":
        return _mcp_jsonrpc_error(request_id, -32601, "Method not found")

    params = payload.get("params")
    if not isinstance(params, dict) or not isinstance(params.get("name"), str):
        return _mcp_jsonrpc_error(request_id, -32602, "Tool name is required")
    tool_name = params["name"]
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        return _mcp_jsonrpc_error(request_id, -32602, "Tool arguments must be an object")
    knowledge_store.add_audit("mcp_tool_call", actor=user.email, detail=tool_name)
    try:
        if tool_name == "search":
            result = await search_sources(SearchRequest.model_validate(arguments), user)
        elif tool_name == "source_preview":
            source = str(arguments.get("source") or "")
            if not source:
                return _mcp_jsonrpc_error(request_id, -32602, "source is required")
            result = await get_document(source, user)
        else:
            return _mcp_jsonrpc_error(request_id, -32602, "Unknown tool")
    except HTTPException as exc:
        if exc.status_code in {401, 403, 404}:
            knowledge_store.add_audit("permission_denied", actor=user.email, detail=f"mcp:{tool_name}")
            return _mcp_jsonrpc_error(request_id, -32001, "Tool access denied")
        return _mcp_jsonrpc_error(request_id, -32000, "Tool execution failed")
    except Exception:
        logger.exception("MCP tool failed: %s", tool_name)
        return _mcp_jsonrpc_error(request_id, -32000, "Tool execution failed")

    data = result.get("data") if isinstance(result, dict) and "data" in result else result
    return _mcp_jsonrpc_response(request_id, {
        "content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False)}],
        "structuredContent": data,
        "isError": False,
    })


@app.get("/api/documents", dependencies=[Depends(verify_api_key)])
async def list_documents(user: CurrentUser = Depends(get_current_user)):
    sources: dict = {}
    for chunk in retriever.chunks:
        sources[chunk.source] = sources.get(chunk.source, 0) + 1
    visible_sources = {name: chunks for name, chunks in sources.items() if _source_access_allowed(name, user)}
    documents = []
    for name, chunks in visible_sources.items():
        record = knowledge_store.get_document(name)
        if not user.is_admin:
            record = {key: value for key, value in record.items() if key not in {"allowed_emails", "allowed_domains", "allowed_groups"}}
        documents.append({"chunks": chunks, **record})
    return ok({"total_chunks": sum(visible_sources.values()), "documents": visible_sources, "records": documents})


@app.get("/api/documents/{filename}", dependencies=[Depends(verify_api_key)])
async def get_document(filename: str, _user: CurrentUser = Depends(get_current_user)):
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not _source_access_allowed(safe_name, _user):
        raise HTTPException(status_code=404, detail="Document not found")
    knowledge_store.add_audit("source_access", actor=_user.email, detail=safe_name)
    path = DOCS_DIR / safe_name
    if path.exists() and path.is_file():
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            content = "\n\n".join(chunk.text for chunk in retriever.chunks if chunk.source == safe_name)
            if not content:
                raise HTTPException(status_code=404, detail="Document preview is unavailable")
        return ok({"filename": safe_name, "content": content, "metadata": knowledge_store.get_document(safe_name)})

    chunks = [c.text for c in retriever.chunks if c.source == safe_name]
    if not chunks:
        raise HTTPException(status_code=404, detail="Document not found")
    return ok({"filename": safe_name, "content": "\n\n".join(chunks), "metadata": knowledge_store.get_document(safe_name)})


@app.post("/api/sources/click", dependencies=[Depends(verify_api_key)])
async def record_source_click(body: SourceClickRequest, user: CurrentUser = Depends(get_current_user)):
    if not _source_access_allowed(body.source, user):
        raise HTTPException(status_code=404, detail="Source not found")
    knowledge_store.add_audit("source_click", actor=user.email, detail=body.source)
    return ok({"source": body.source})


@app.post("/api/search", dependencies=[Depends(verify_api_key)])
async def search_sources(body: SearchRequest, user: CurrentUser = Depends(get_current_user)):
    allowed_sources = _retrieval_allowed_sources(user)
    candidates = retriever.search(discovery_store.expand_query(body.query), top_k=body.top_k * 2, allowed_sources=allowed_sources)
    normalized_query = body.query.strip().lower()
    known_item_chunks = []
    for chunk in retriever.chunks:
        metadata = knowledge_store.get_document(chunk.source)
        searchable = f"{chunk.source} {metadata.get('title') or ''}".lower()
        if normalized_query and normalized_query in searchable and (allowed_sources is None or chunk.source in allowed_sources):
            known_item_chunks.append(chunk.model_copy(update={"score": 0.95}))
    candidates = known_item_chunks + candidates
    candidates = [source for source in candidates if _matches_search_filters(source.source, body)]
    candidates = _eligible_sources(candidates, user.email, user.is_admin)
    unique_candidates = []
    seen_sources = set()
    for source in candidates:
        if source.source not in seen_sources:
            seen_sources.add(source.source)
            unique_candidates.append(source)
    candidates = unique_candidates[:body.top_k]
    knowledge_store.add_audit("search", actor=user.email, detail=audit_fingerprint(body.query))
    return ok({
        "query": body.query,
        "results": [_source_payload(source) for source in candidates],
        "facets": {
            "owners": sorted({knowledge_store.get_document(source.source).get("owner") for source in candidates if knowledge_store.get_document(source.source).get("owner")}),
            "source_systems": sorted({knowledge_store.get_document(source.source).get("source_system") for source in candidates if knowledge_store.get_document(source.source).get("source_system")}),
            "topics": sorted({knowledge_store.get_document(source.source).get("topic") for source in candidates if knowledge_store.get_document(source.source).get("topic")}),
        },
    })


@app.get("/api/people", dependencies=[Depends(verify_api_key)])
async def search_people(user: CurrentUser = Depends(get_current_user), q: str = ""):
    query = q.strip().lower()[:100]
    indexed_sources = {chunk.source for chunk in retriever.chunks}
    people: dict[str, dict] = {}
    for source in indexed_sources:
        if not _source_access_allowed(source, user):
            continue
        metadata = knowledge_store.get_document(source)
        for field in ("owner", "subject_matter_expert"):
            person = str(metadata.get(field) or "").strip()
            if not person or (query and query not in person.lower()):
                continue
            key = person.lower()
            entry = people.setdefault(key, {
                "name": person,
                "role": field,
                "department": metadata.get("department"),
                "sources": [],
            })
            if source not in entry["sources"]:
                entry["sources"].append(source)
    knowledge_store.add_audit("people_search", actor=user.email, detail=audit_fingerprint(query))
    return ok(sorted(people.values(), key=lambda person: person["name"].lower()))


@app.get("/api/collections", dependencies=[Depends(verify_api_key)])
async def list_collections(user: CurrentUser = Depends(get_current_user)):
    visible = []
    for collection in discovery_store.collections():
        sources = [source for source in collection.get("source_ids", []) if _source_access_allowed(source, user)]
        if sources or user.is_admin:
            visible.append({**collection, "source_ids": sources})
    return ok(visible)


@app.post("/api/admin/collections", dependencies=[Depends(verify_api_key)])
async def create_collection(body: CollectionRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner", "reviewer")
    collection = discovery_store.save_collection(body.model_dump())
    knowledge_store.add_audit("collection_create", actor=user.email, detail=collection.get("id"))
    return ok(collection)


@app.patch("/api/admin/collections/{collection_id}", dependencies=[Depends(verify_api_key)])
async def update_collection(collection_id: str, body: CollectionRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner", "reviewer")
    collection = discovery_store.save_collection(body.model_dump(), collection_id=collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    knowledge_store.add_audit("collection_update", actor=user.email, detail=collection_id)
    return ok(collection)


@app.get("/api/saved-searches", dependencies=[Depends(verify_api_key)])
async def list_saved_searches(user: CurrentUser = Depends(get_current_user)):
    return ok(discovery_store.saved_searches(user.uid))


@app.post("/api/saved-searches", dependencies=[Depends(verify_api_key)])
async def save_search(body: SavedSearchRequest, user: CurrentUser = Depends(get_current_user)):
    saved = discovery_store.save_search({**body.model_dump(), "user_id": user.uid})
    knowledge_store.add_audit("saved_search_create", actor=user.email, detail=saved["id"])
    return ok(saved)


@app.delete("/api/saved-searches/{search_id}", dependencies=[Depends(verify_api_key)])
async def delete_saved_search(search_id: str, user: CurrentUser = Depends(get_current_user)):
    if not discovery_store.delete_search(search_id, user.uid):
        raise HTTPException(status_code=404, detail="Saved search not found")
    knowledge_store.add_audit("saved_search_delete", actor=user.email, detail=search_id)
    return ok({"deleted": search_id})


@app.get("/api/glossary", dependencies=[Depends(verify_api_key)])
async def list_glossary(user: CurrentUser = Depends(get_current_user)):
    _ = user
    return ok(discovery_store.glossary())


@app.post("/api/admin/glossary", dependencies=[Depends(verify_api_key)])
async def save_glossary_term(body: GlossaryRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner", "reviewer")
    term = discovery_store.save_term(body.model_dump())
    knowledge_store.add_audit("glossary_update", actor=user.email, detail=body.term)
    return ok(term)


@app.delete("/api/admin/glossary/{term}", dependencies=[Depends(verify_api_key)])
async def delete_glossary_term(term: str, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner", "reviewer")
    if not discovery_store.delete_term(term):
        raise HTTPException(status_code=404, detail="Glossary term not found")
    knowledge_store.add_audit("glossary_delete", actor=user.email, detail=term)
    return ok({"deleted": term})


@app.get("/api/admin/evaluations", dependencies=[Depends(verify_api_key)])
async def get_evaluations(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "reviewer")
    return ok({"cases": evaluation_store.cases(), "runs": evaluation_store.runs()[-20:][::-1]})


@app.post("/api/admin/evaluations", dependencies=[Depends(verify_api_key)])
async def create_evaluation_case(body: EvaluationCaseRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "reviewer")
    case = evaluation_store.create_case(body.model_dump())
    knowledge_store.add_audit("evaluation_case_create", actor=user.email, detail=case["id"])
    return ok(case)


@app.post("/api/admin/evaluations/run", dependencies=[Depends(verify_api_key)])
async def run_evaluation(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "reviewer")
    results = []
    hits = 0
    reciprocal_ranks = []
    language_metrics: dict[str, dict[str, float | int]] = {}
    allowed_sources = _retrieval_allowed_sources(user)
    for case in evaluation_store.cases():
        language = case.get("language", "default")
        sources = _eligible_sources(
            retriever.search(discovery_store.expand_query(case["question"]), top_k=10, allowed_sources=allowed_sources),
            user.email,
            user.is_admin,
        )
        retrieved = [source.source for source in sources]
        expected = set(case.get("expected_sources", []))
        rank = next((index + 1 for index, source in enumerate(retrieved) if source in expected), None)
        if rank:
            hits += 1
            reciprocal_ranks.append(1 / rank)
        metrics = language_metrics.setdefault(language, {"case_count": 0, "hits": 0, "reciprocal_rank_total": 0.0})
        metrics["case_count"] += 1
        if rank:
            metrics["hits"] += 1
            metrics["reciprocal_rank_total"] += 1 / rank
        results.append({"case_id": case["id"], "language": language, "retrieved_sources": retrieved, "rank": rank, "hit": bool(rank)})
    total = len(results)
    by_language = {
        language: {
            "case_count": int(metrics["case_count"]),
            "hit_rate": int(metrics["hits"]) / int(metrics["case_count"]) if metrics["case_count"] else 0,
            "mean_reciprocal_rank": float(metrics["reciprocal_rank_total"]) / int(metrics["case_count"]) if metrics["case_count"] else 0,
        }
        for language, metrics in language_metrics.items()
    }
    run = evaluation_store.add_run({
        "actor": user.email,
        "model": os.environ.get("MODEL_NAME") or os.environ.get("MODAL_NAME") or "fallback",
        "prompt_version": os.environ.get("PROMPT_VERSION", "orgchai-v1"),
        "case_count": total,
        "hit_rate": hits / total if total else 0,
        "mean_reciprocal_rank": sum(reciprocal_ranks) / total if total else 0,
        "by_language": by_language,
        "results": results,
    })
    knowledge_store.add_audit("evaluation_run", actor=user.email, detail=run["id"])
    return ok(run)


@app.post("/api/documents/ingest", dependencies=[Depends(verify_api_key)])
async def ingest_file(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    safe_filename = Path(file.filename).name
    if len(safe_filename) > 255:
        raise HTTPException(status_code=400, detail="Filename is too long")
    extension = Path(safe_filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Supported formats: TXT, Markdown, HTML, CSV, TSV, RTF, DOCX, XLSX, PPTX, PDF, and common raster images")

    max_upload_bytes = 25 * 1024 * 1024
    chunks: list[bytes] = []
    total_bytes = 0
    while True:
        chunk = await file.read(min(1024 * 1024, max_upload_bytes - total_bytes + 1))
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_upload_bytes:
            raise HTTPException(status_code=413, detail="Uploaded file is too large")
        chunks.append(chunk)
    content = b"".join(chunks)
    text = extract_text(content, extension)
    processed_text, dlp_report = process_text(text, _dlp_action())
    if dlp_report["blocked"]:
        raise HTTPException(status_code=400, detail="Source blocked by the configured data-loss prevention policy")

    dest = DOCS_DIR / safe_filename
    text_extensions = {".txt", ".md", ".markdown", ".html", ".htm", ".csv", ".tsv", ".rtf"}
    if extension in OCR_EXTENSIONS:
        if dlp_report["action"] != "redact":
            dest.write_bytes(content)
        dest.with_name(f"{dest.name}.ocr.txt").write_text(processed_text, encoding="utf-8")
    else:
        dest.write_bytes(processed_text.encode("utf-8") if dlp_report["action"] == "redact" and extension in text_extensions else content)
    added = retriever.ingest(processed_text, dest.name)
    fingerprint = hashlib.sha256(processed_text.strip().encode("utf-8")).hexdigest()
    duplicate_of = knowledge_store.find_by_fingerprint(fingerprint, exclude=dest.name)
    knowledge_store.upsert_document(
        dest.name,
        {"title": dest.stem.replace("_", " "), "owner": user.email, "status": "draft", "fingerprint": fingerprint, "duplicate_of": duplicate_of, "data_classification": dlp_report["classification"], "dlp_findings": dlp_report["findings"]},
        actor=user.email,
    )
    knowledge_store.add_audit("source_ingest", actor=user.email, detail=dest.name)
    payload = IngestResponse(filename=dest.name, chunks_added=added, total_chunks=len(retriever.chunks))
    return ok(payload.model_dump())


@app.delete("/api/documents/{filename}", dependencies=[Depends(verify_api_key)])
async def delete_document(filename: str, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner")
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = DOCS_DIR / safe_name
    removed = retriever.remove_source(safe_name)
    knowledge_store.remove_document(safe_name)
    knowledge_store.add_audit("source_delete", actor=user.email, detail=safe_name)
    file_deleted = False
    paths = [path]
    if path.suffix.lower() in OCR_EXTENSIONS:
        paths.append(path.with_name(f"{path.name}.ocr.txt"))
    for candidate in paths:
        if candidate.exists():
            try:
                candidate.unlink()
                file_deleted = True
            except OSError:
                pass
    if removed == 0 and not file_deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return ok({
        "filename": safe_name,
        "chunks_removed": removed,
        "file_deleted": file_deleted,
        "total_chunks": len(retriever.chunks),
    })


@app.patch("/api/documents/{filename}/metadata", dependencies=[Depends(verify_api_key)])
async def update_document_metadata(
    filename: str,
    body: DocumentMetadataRequest,
    user: CurrentUser = Depends(get_current_user),
):
    require_role(user, "knowledge_owner")
    safe_name = Path(filename).name
    if safe_name != filename or safe_name not in {chunk.source for chunk in retriever.chunks}:
        raise HTTPException(status_code=404, detail="Document not found")
    metadata = knowledge_store.upsert_document(safe_name, body.model_dump(exclude_none=True), actor=user.email)
    knowledge_store.add_audit("source_metadata_update", actor=user.email, detail=safe_name)
    return ok(metadata)


@app.delete("/api/documents", dependencies=[Depends(verify_api_key)])
async def clear_documents(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "knowledge_owner")
    count = len(retriever.chunks)
    retriever.clear()
    for document in knowledge_store.list_documents():
        knowledge_store.remove_document(document.get("source", ""))
    return ok({"cleared": count})


@app.post("/api/chats/{chat_id}/feedback", dependencies=[Depends(verify_api_key)])
async def add_feedback(
    chat_id: str,
    body: FeedbackRequest,
    user: CurrentUser = Depends(get_current_user),
):
    chat = chat_store.get_chat(chat_id, user_id=user.uid)
    if chat is None or not any(message.get("id") == body.message_id and message.get("role") == "assistant" for message in chat.get("messages", [])):
        raise HTTPException(status_code=404, detail="Assistant message not found")
    assistant = next(message for message in chat["messages"] if message.get("id") == body.message_id)
    entry = knowledge_store.add_feedback({
        "chat_id": chat_id,
        "message_id": body.message_id,
        "user_id": user.uid,
        "kind": body.kind,
        "note": body.note,
        "answer": assistant.get("content"),
        "sources": assistant.get("sources", []),
    })
    knowledge_store.add_audit("answer_feedback", actor=user.email, detail=body.kind)
    if body.kind != "helpful":
        knowledge_store.add_review({
            "kind": body.kind,
            "question": next((m.get("content") for m in reversed(chat["messages"]) if m.get("role") == "user"), ""),
            "answer": assistant.get("content"),
            "chat_id": chat_id,
            "message_id": body.message_id,
            "user_id": user.uid,
        })
    return ok(entry)


@app.get("/api/admin/reviews", dependencies=[Depends(verify_api_key)])
async def list_reviews(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "reviewer", "analyst", "auditor")
    return ok(knowledge_store.list_reviews())


@app.patch("/api/admin/reviews/{review_id}", dependencies=[Depends(verify_api_key)])
async def update_review(
    review_id: str,
    body: ReviewUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
):
    require_role(user, "reviewer")
    review = knowledge_store.update_review(review_id, body.model_dump(exclude_none=True), actor=user.email)
    if review is None:
        raise HTTPException(status_code=404, detail="Review item not found")
    knowledge_store.add_audit("review_update", actor=user.email, detail=review_id)
    return ok(review)


@app.get("/api/admin/analytics", dependencies=[Depends(verify_api_key)])
async def get_analytics(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "auditor")
    base = knowledge_store.analytics()
    metric_data = metrics_store.analytics()
    action_data = action_store.analytics()
    answer_count = metric_data.get("answer_count", 0)
    feedback_total = base.get("feedback_total", 0)
    return ok({
        **base,
        **metric_data,
        **action_data,
        "feedback_rate": round(feedback_total / answer_count, 4) if answer_count else 0,
    })


@app.get("/api/admin/source-health", dependencies=[Depends(verify_api_key)])
async def get_source_health(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "auditor", "connector_admin")
    today = date.today()
    soon = today + timedelta(days=30)
    counts = {"total": 0, "draft": 0, "expired": 0, "expiring_soon": 0, "ownerless": 0, "duplicate": 0}
    indexed_sources = {chunk.source for chunk in retriever.chunks}
    for record in knowledge_store.list_documents():
        if record.get("source") not in indexed_sources:
            continue
        counts["total"] += 1
        status = record.get("status") or "draft"
        if status == "draft":
            counts["draft"] += 1
        if status == "expired" or (record.get("expiration_date") and record["expiration_date"] < today.isoformat()):
            counts["expired"] += 1
        elif record.get("expiration_date") and record["expiration_date"] <= soon.isoformat():
            counts["expiring_soon"] += 1
        if not record.get("owner"):
            counts["ownerless"] += 1
        if record.get("duplicate_of"):
            counts["duplicate"] += 1
    connector_records = connector_store.list()
    return ok({**counts, "connector_failures": sum(1 for item in connector_records if item.get("last_error")), "paused_connectors": sum(1 for item in connector_records if item.get("status") == "paused")})


@app.get("/api/admin/audit", dependencies=[Depends(verify_api_key)])
async def get_audit(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor")
    return ok(knowledge_store.list_audit())


@app.get("/api/admin/audit/export", dependencies=[Depends(verify_api_key)])
async def export_audit(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor")
    records = knowledge_store.list_audit(limit=5000)
    knowledge_store.add_audit("audit_export", actor=user.email)
    return Response(
        content=json.dumps({"exported_at": datetime.now(timezone.utc).isoformat(), "records": records}),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="orgchai-audit.json"'},
    )


@app.get("/api/admin/analytics/export", dependencies=[Depends(verify_api_key)])
async def export_analytics(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "auditor")
    payload = {**knowledge_store.analytics(), **metrics_store.analytics(), **action_store.analytics()}
    payload["exported_at"] = datetime.now(timezone.utc).isoformat()
    knowledge_store.add_audit("analytics_export", actor=user.email)
    return Response(
        content=json.dumps(payload),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="orgchai-analytics.json"'},
    )


@app.get("/api/admin/policies", dependencies=[Depends(verify_api_key)])
async def get_policies(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "analyst", "auditor")
    retention = _retention_policy()
    admin_policy = knowledge_store.get_admin_policy()
    identity_provider = _identity_provider()
    return ok({
        "model_provider": "configured" if os.environ.get("AIAND_API_KEY") and os.environ.get("AIAND_BASE_URL") else "extractive fallback",
        "no_training": os.environ.get("MODEL_NO_TRAINING", "not specified"),
        "provider_retention": os.environ.get("MODEL_DATA_RETENTION", "provider-default"),
        "retention": retention,
        "chat_retention_days": retention["chat_days"],
        "source_permissions": "query-time email allowlists",
        "dlp_action": _dlp_action(),
        "data_residency": os.environ.get("DATA_RESIDENCY", "not specified"),
        "regional_processing": os.environ.get("MODEL_REGION", "provider-default"),
        "secrets_rotation_days": os.environ.get("SECRETS_ROTATION_DAYS", "not specified"),
        "encryption_at_rest": _encryption_at_rest(),
        "data_export": "user and administrator JSON exports",
        "deletion_confirmation": "required phrase",
        "identity_provider": identity_provider,
        "organization_id": user.organization_id,
        "organization_boundary": {
            "mode": "firebase custom claim with deployment fallback" if not organization_claim_required() else "required firebase custom claim",
            "claim": organization_claim_name(),
            "configured_organization_id": configured_organization_id(),
            "enforced": True,
        },
        "approved_connector_kinds": ",".join(admin_policy["approved_connector_kinds"]),
        "action_allowlist": ",".join(admin_policy["action_scopes"]),
        "approved_models": ",".join(admin_policy["approved_models"]),
        "web_access": admin_policy["web_access"],
        "allowed_data_classes": ",".join(admin_policy["allowed_data_classes"]),
        "allowed_tools": ",".join(admin_policy["allowed_tools"]),
        "updated_at": admin_policy.get("updated_at"),
    })


@app.patch("/api/admin/policies/access", dependencies=[Depends(verify_api_key)])
async def update_admin_policy(body: AdminPolicyRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor", "analyst")
    allowed_connectors = {"local_folder", "google_drive", "sharepoint"}
    allowed_tools = {"search", "source_preview", "draft_actions", "slack_summary", "web_search"}
    allowed_actions = {"draft_follow_up", "draft_incident_summary", "draft_onboarding_plan", "draft_it_access_request", "draft_policy_acknowledgement", "draft_support_reply"}
    if any(item not in allowed_connectors for item in body.approved_connector_kinds):
        raise HTTPException(status_code=422, detail="Unsupported connector kind")
    if any(item not in allowed_tools for item in body.allowed_tools):
        raise HTTPException(status_code=422, detail="Unsupported tool")
    if any(item not in allowed_actions for item in body.action_scopes):
        raise HTTPException(status_code=422, detail="Unsupported action scope")
    policy = knowledge_store.set_admin_policy(body.model_dump(), actor=user.email)
    knowledge_store.add_audit("admin_policy_updated", actor=user.email)
    return ok(policy)


@app.patch("/api/admin/policies/retention", dependencies=[Depends(verify_api_key)])
async def update_retention_policy(body: RetentionPolicyRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor", "analyst")
    policy = knowledge_store.set_retention_policy(body.model_dump(), actor=user.email)
    knowledge_store.add_audit("retention_policy_updated", actor=user.email)
    return ok(policy)


@app.patch("/api/admin/policies/dlp", dependencies=[Depends(verify_api_key)])
async def update_dlp_policy(body: DlpPolicyRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor", "analyst")
    policy = knowledge_store.set_dlp_action(body.action, actor=user.email)
    knowledge_store.add_audit("dlp_policy_updated", actor=user.email, detail=body.action)
    return ok(policy)


@app.post("/api/admin/policies/retention/apply", dependencies=[Depends(verify_api_key)])
async def apply_retention_policy(body: RetentionApplyRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "auditor", "analyst")
    removed = await asyncio.to_thread(_apply_retention_policy)
    knowledge_store.add_audit("retention_applied", actor=user.email, detail=json.dumps(removed, sort_keys=True))
    return ok({"removed": removed, "policy": _retention_policy()})


@app.get("/api/admin/connectors", dependencies=[Depends(verify_api_key)])
async def list_connectors(user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin", "analyst", "auditor")
    return ok([public_connector(connector) for connector in connector_store.list()])


@app.post("/api/actions/proposals", dependencies=[Depends(verify_api_key)])
async def create_action_proposal(body: ActionProposalRequest, user: CurrentUser = Depends(get_current_user)):
    allowed_actions = set(knowledge_store.get_admin_policy()["action_scopes"])
    if body.action_type not in allowed_actions:
        raise HTTPException(status_code=403, detail="Action type is not allowed")
    existing = action_store.find_idempotent(user.uid, body.idempotency_key)
    if existing is not None:
        return ok(existing)
    for source in body.source_ids:
        if not _source_access_allowed(source, user):
            raise HTTPException(status_code=404, detail="Source not found")
    proposal = action_store.create({
        **body.model_dump(),
        "requester_id": user.uid,
        "requester": user.email,
        "requires_approval": True,
        "execution_status": "not_executed",
    })
    knowledge_store.add_audit("action_proposed", actor=user.email, detail=proposal["id"])
    return ok(proposal)


@app.get("/api/actions/proposals", dependencies=[Depends(verify_api_key)])
async def list_action_proposals(user: CurrentUser = Depends(get_current_user)):
    if user.is_admin or user.role in {"reviewer", "auditor"}:
        return ok(action_store.list())
    return ok(action_store.list(requester_id=user.uid))


@app.get("/api/workflows", dependencies=[Depends(verify_api_key)])
async def list_workflows(_user: CurrentUser = Depends(get_current_user)):
    return ok(WORKFLOW_TEMPLATES)


@app.post("/api/workflows/{workflow_id}/proposals", dependencies=[Depends(verify_api_key)])
async def create_workflow_proposal(
    workflow_id: str,
    body: WorkflowProposalRequest,
    user: CurrentUser = Depends(get_current_user),
):
    workflow = get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    allowed_actions = set(knowledge_store.get_admin_policy()["action_scopes"])
    if workflow["action_type"] not in allowed_actions:
        raise HTTPException(status_code=403, detail="Workflow action is not allowed")
    missing = [name for name in workflow["required_inputs"] if not body.inputs.get(name, "").strip()]
    if missing:
        raise HTTPException(status_code=422, detail="Required workflow inputs are missing")
    existing = action_store.find_idempotent(user.uid, body.idempotency_key)
    if existing is not None:
        return ok(existing)
    for source in body.source_ids:
        if not _source_access_allowed(source, user):
            raise HTTPException(status_code=404, detail="Source not found")
    proposal = action_store.create({
        "action_type": workflow["action_type"],
        "idempotency_key": body.idempotency_key,
        "title": workflow["title"],
        "target": None,
        "inputs": body.inputs,
        "source_ids": body.source_ids,
        "permission_scope": "requester only until approved",
        "expected_side_effects": ["No external write is performed by this proposal"],
        "requester_id": user.uid,
        "requester": user.email,
        "requires_approval": True,
        "execution_status": "not_executed",
    })
    knowledge_store.add_audit("workflow_proposed", actor=user.email, detail=proposal["id"])
    return ok(proposal)


@app.patch("/api/admin/actions/proposals/{proposal_id}", dependencies=[Depends(verify_api_key)])
async def decide_action_proposal(
    proposal_id: str,
    body: ActionDecisionRequest,
    user: CurrentUser = Depends(get_current_user),
):
    require_role(user, "reviewer")
    existing = action_store.get(proposal_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Action proposal not found")
    if existing.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Action proposal was already decided")
    proposal = action_store.decide(proposal_id, body.status, user.email or user.uid, body.note)
    knowledge_store.add_audit("action_decision", actor=user.email, detail=proposal_id)
    return ok(proposal)


@app.post("/api/admin/connectors", dependencies=[Depends(verify_api_key)])
async def create_connector(body: ConnectorCreateRequest, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin")
    approved_kinds = set(knowledge_store.get_admin_policy()["approved_connector_kinds"])
    if body.kind not in approved_kinds:
        raise HTTPException(status_code=403, detail="Connector kind is not approved")
    if body.kind == "local_folder" and not body.root_path.strip():
        raise HTTPException(status_code=422, detail="A local folder path is required")
    if body.kind not in {"local_folder", "rest_api"} and not body.token_env:
        raise HTTPException(status_code=422, detail="A server-side token environment variable is required")
    if body.kind == "sharepoint" and (not body.scope_id or not body.drive_id):
        raise HTTPException(status_code=422, detail="SharePoint site and drive scopes are required")
    if body.kind == "rest_api" and (not body.endpoint_url or not body.integration_category):
        raise HTTPException(status_code=422, detail="A secure endpoint and integration category are required")
    connector = connector_store.create(body.name, body.kind, {
        "root_path": body.root_path,
        "token_env": body.token_env,
        "scope_id": body.scope_id,
        "drive_id": body.drive_id,
        "endpoint_url": body.endpoint_url,
        "integration_category": body.integration_category,
        "webhook_secret_env": body.webhook_secret_env,
    }, body.schedule)
    connector = connector_store.update(connector["id"], {
        "retry_limit": body.retry_limit,
        "retry_backoff_seconds": body.retry_backoff_seconds,
    }) or connector
    knowledge_store.add_audit("connector_create", actor=user.email, detail=connector["id"])
    return ok(public_connector(connector))


@app.patch("/api/admin/connectors/{connector_id}", dependencies=[Depends(verify_api_key)])
async def update_connector(
    connector_id: str,
    body: ConnectorUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
):
    require_role(user, "connector_admin")
    connector = connector_store.get(connector_id)
    if connector is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    changes = body.model_dump(exclude_none=True)
    if "root_path" in changes:
        config = dict(connector.get("config", {}))
        config["root_path"] = changes.pop("root_path")
        changes["config"] = config
    connector_fields = {"token_env", "scope_id", "drive_id", "endpoint_url", "integration_category", "webhook_secret_env"}
    if connector_fields.intersection(changes):
        config = dict(connector.get("config", {}))
        for field in connector_fields.intersection(changes):
            config[field] = changes.pop(field)
        changes["config"] = config
    updated = connector_store.update(connector_id, changes)
    knowledge_store.add_audit("connector_update", actor=user.email, detail=connector_id)
    return ok(public_connector(updated)) if updated else ok(updated)


@app.get("/api/admin/connectors/{connector_id}/contract", dependencies=[Depends(verify_api_key)])
async def get_connector_contract(connector_id: str, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin", "analyst", "auditor")
    connector = connector_store.get(connector_id)
    if connector is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    return ok(public_connector(connector)["contract"])


@app.post("/api/admin/connectors/{connector_id}/sync", dependencies=[Depends(verify_api_key)])
async def sync_connector(connector_id: str, user: CurrentUser = Depends(get_current_user)):
    require_role(user, "connector_admin")
    connector = connector_store.get(connector_id)
    if connector is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    if connector.get("status") == "paused":
        raise HTTPException(status_code=409, detail="Connector is paused")
    try:
        result = await asyncio.to_thread(_sync_connector_with_retries, connector)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    knowledge_store.add_audit("connector_sync", actor=user.email, detail=connector_id)
    if result.get("connector"):
        result["connector"] = public_connector(result["connector"])
    return ok(result)


@app.post("/api/connectors/{connector_id}/webhook", dependencies=[Depends(verify_api_key)])
async def connector_webhook(connector_id: str, request: Request):
    connector = connector_store.get(connector_id)
    if connector is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    secret_env = str(connector.get("config", {}).get("webhook_secret_env") or "").strip()
    expected = os.environ.get(secret_env, "").strip() if secret_env else ""
    supplied = request.headers.get("X-Connector-Webhook-Secret", "").strip()
    if not expected or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Webhook authentication failed")
    if connector.get("status") == "paused":
        raise HTTPException(status_code=409, detail="Connector is paused")
    result = await asyncio.to_thread(_sync_connector_with_retries, connector)
    knowledge_store.add_audit("connector_webhook_sync", actor="connector_webhook", detail=connector_id)
    if result.get("connector"):
        result["connector"] = public_connector(result["connector"])
    return ok(result)


@app.get("/api/chats", dependencies=[Depends(verify_api_key)])
async def list_chats(user: CurrentUser = Depends(get_current_user)):
    return ok(chat_store.list_chats(user_id=user.uid))


@app.post("/api/chats", dependencies=[Depends(verify_api_key)])
async def create_chat(user: CurrentUser = Depends(get_current_user)):
    chat = chat_store.create_chat("New chat", user_id=user.uid)
    return ok(chat)


@app.get("/api/chats/{chat_id}", dependencies=[Depends(verify_api_key)])
async def get_chat(chat_id: str, user: CurrentUser = Depends(get_current_user)):
    chat = chat_store.get_chat(chat_id, user_id=user.uid)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ok(chat)


@app.post("/api/chats/{chat_id}/messages", dependencies=[Depends(verify_api_key)])
async def send_chat_message(
    chat_id: str,
    body: SendChatRequest,
    user: CurrentUser = Depends(get_current_user),
):
    started_at = time.monotonic()
    chat = chat_store.get_chat(chat_id, user_id=user.uid)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    context = _conversation_context(chat)
    chat_store.add_message(chat_id, "user", body.question, user_id=user.uid)
    knowledge_store.add_audit("search", actor=user.email, detail=audit_fingerprint(body.question))

    context_sources = [source for source in body.context_sources if _source_access_allowed(source, user)]
    contextual_query = discovery_store.expand_query(body.question)
    if context_sources:
        contextual_query = f"{contextual_query}\nContext sources: {' '.join(context_sources)}"
    previous_questions = [m.get("content", "") for m in chat.get("messages", []) if m.get("role") == "user"][-2:]
    if previous_questions:
        contextual_query = discovery_store.expand_query(" ".join(previous_questions + [body.question]))
        if context_sources:
            contextual_query = f"{contextual_query}\nContext sources: {' '.join(context_sources)}"
    allowed_sources = _retrieval_allowed_sources(user)
    retrieved_sources = retriever.search(contextual_query, top_k=body.top_k, allowed_sources=allowed_sources)
    for source_name in reversed(context_sources):
        context_chunk = next((chunk for chunk in retriever.chunks if chunk.source == source_name), None)
        if context_chunk is not None:
            retrieved_sources.insert(0, context_chunk.model_copy(update={"score": 1.0}))
    sources = _eligible_sources(retrieved_sources, user.email, user.is_admin)
    unique_sources = []
    seen_source_names = set()
    for source in sources:
        if source.source not in seen_source_names:
            seen_source_names.add(source.source)
            unique_sources.append(source)
    sources = unique_sources[:body.top_k]
    if body.generate:
        answer, model, abstained = _answer(body.question, sources, mode=body.mode, language=body.language, context=context)
    else:
        answer = "Retrieval-only mode. Top relevant snippets:\n\n" + "\n\n".join(s.text for s in sources)
        model = "retrieval-only"
        abstained = False

    knowledge_store.add_audit("no_result" if abstained or not sources else "answer_generated", actor=user.email, detail=model)
    if model == "fallback":
        knowledge_store.add_audit("answer_fallback", actor=user.email)
    _record_answer_metric(started_at, model, len(sources))

    sources_payload = [_source_payload(s) for s in sources]
    chat_store.add_message(chat_id, "assistant", answer, sources=sources_payload, model=model, user_id=user.uid)
    review_kind, conflicts = _review_kind(body.question, sources, abstained)
    if review_kind:
        knowledge_store.add_review({
            "kind": review_kind,
            "question": body.question,
            "answer": answer,
            "chat_id": chat_id,
            "user_id": user.uid,
            "conflicts": conflicts,
        })

    updated = chat_store.get_chat(chat_id, user_id=user.uid)
    return ok(updated)


@app.patch("/api/chats/{chat_id}", dependencies=[Depends(verify_api_key)])
async def rename_chat(chat_id: str, body: RenameChatRequest, user: CurrentUser = Depends(get_current_user)):
    chat = chat_store.rename_chat(chat_id, body.title, user_id=user.uid)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ok(chat)


@app.delete("/api/chats/{chat_id}", dependencies=[Depends(verify_api_key)])
async def delete_chat(chat_id: str, user: CurrentUser = Depends(get_current_user)):
    deleted = chat_store.delete_chat(chat_id, user_id=user.uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ok({"deleted": chat_id})


@app.delete("/api/chats", dependencies=[Depends(verify_api_key)])
async def delete_all_chats(body: DeleteChatsRequest, user: CurrentUser = Depends(get_current_user)):
    deleted = chat_store.delete_all(user_id=user.uid)
    knowledge_store.add_audit("chat_delete_all", actor=user.email)
    return ok({"deleted": deleted})


@app.post("/api/ask", dependencies=[Depends(verify_api_key)])
async def ask(body: AskRequest, _user: CurrentUser = Depends(get_current_user)):
    started_at = time.monotonic()
    knowledge_store.add_audit("search", actor=_user.email, detail=audit_fingerprint(body.question))
    allowed_sources = _retrieval_allowed_sources(_user)
    sources = _eligible_sources(retriever.search(discovery_store.expand_query(body.question), top_k=body.top_k, allowed_sources=allowed_sources), _user.email, _user.is_admin)
    if body.generate:
        answer, model, abstained = _answer(body.question, sources, mode=body.mode, language=body.language)
    else:
        answer = "Retrieval-only mode. Top relevant snippets:\n\n" + "\n\n".join(s.text for s in sources)
        model = "retrieval-only"
        abstained = False
    knowledge_store.add_audit("no_result" if abstained or not sources else "answer_generated", actor=_user.email, detail=model)
    if model == "fallback":
        knowledge_store.add_audit("answer_fallback", actor=_user.email)
    _record_answer_metric(started_at, model, len(sources))
    review_kind, conflicts = _review_kind(body.question, sources, abstained)
    if review_kind:
        knowledge_store.add_review({
            "kind": review_kind,
            "question": body.question,
            "answer": answer,
            "user_id": _user.uid,
            "conflicts": conflicts,
        })
    return ok({
        "question": body.question,
        "answer": answer,
        "sources": [_source_payload(s) for s in sources],
        "model": model,
        "abstained": abstained,
    })
