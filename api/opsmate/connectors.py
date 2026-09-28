"""Connector registry and sync state for source systems."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConnectorStore:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(os.environ.get("CONNECTORS_DIR", Path(__file__).resolve().parent / "data" / "connectors"))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.base_dir / "connectors.json"

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    def list(self) -> list[dict]:
        return self._read()

    def get(self, connector_id: str) -> Optional[dict]:
        return next((record for record in self._read() if record.get("id") == connector_id), None)

    def create(self, name: str, kind: str, config: dict, schedule: Optional[str] = None) -> dict:
        records = self._read()
        record = {
            "id": uuid.uuid4().hex[:12],
            "name": name.strip()[:120],
            "kind": kind,
            "status": "active",
            "config": config,
            "schedule": schedule,
            "created_at": _now(),
            "updated_at": _now(),
            "last_attempt_at": None,
            "last_success_at": None,
            "last_error": None,
            "failure_count": 0,
            "retry_limit": 3,
            "retry_backoff_seconds": 5,
            "retry_count": 0,
            "last_sync_duration_ms": None,
            "stale_count": 0,
            "last_removed_count": 0,
            "quarantined_sources": [],
            "indexed_sources": [],
        }
        records.append(record)
        self._write(records)
        return record

    def update(self, connector_id: str, changes: dict) -> Optional[dict]:
        records = self._read()
        for record in records:
            if record.get("id") == connector_id:
                record.update(changes)
                record["updated_at"] = _now()
                self._write(records)
                return record
        return None


connector_store = ConnectorStore()


def connector_contract(connector: dict) -> dict:
    """Return the stable connector contract without exposing secrets or paths."""
    config = connector.get("config", {})
    kind = str(connector.get("kind") or "")
    token_env = str(config.get("token_env") or "").strip()
    token_configured = bool(token_env and os.environ.get(token_env, "").strip())
    root_configured = bool(str(config.get("root_path") or "").strip())
    scope_configured = bool(str(config.get("scope_id") or "").strip())
    drive_configured = bool(str(config.get("drive_id") or "").strip())
    endpoint_configured = bool(str(config.get("endpoint_url") or "").strip())
    return {
        "version": "1.0",
        "authentication": {
            "mode": "local_path" if kind == "local_folder" else "server_token",
            "server_token_configured": token_configured,
            "oauth_status": "not_applicable" if kind == "local_folder" else ("server_token_ready" if token_configured else "action_required"),
            "admin_consent": "not_applicable" if kind == "local_folder" else ("satisfied_by_server_token" if token_configured else "required"),
        },
        "crawl_scope": {
            "root_path_configured": root_configured,
            "scope_id_configured": scope_configured,
            "drive_id_configured": drive_configured,
            "selection_status": "selected" if (kind == "local_folder" and root_configured) or (kind in {"google_drive", "sharepoint"} and scope_configured and (kind != "sharepoint" or drive_configured)) or (kind == "rest_api" and endpoint_configured) else "action_required",
            "schedule": connector.get("schedule"),
            "integration_category": config.get("integration_category"),
            "endpoint_configured": endpoint_configured,
        },
        "source_metadata": [
            "connector_id",
            "relative_path",
            "source_url",
            "fingerprint",
            "data_classification",
            "dlp_findings",
        ],
        "identities": {
            "directory_mapping": True,
            "source_identity_fields": [
                "owner",
                "subject_matter_expert",
                "allowed_emails",
                "allowed_domains",
                "allowed_groups",
            ],
        },
        "permissions": {
            "query_time_acl": True,
            "enforced_at": ["retrieval", "answer", "citation", "preview"],
        },
        "incremental": {
            "supported": True,
            "strategy": "source-set reconciliation",
        },
        "deletion": {
            "supported": True,
            "strategy": "remove sources missing from the latest crawl",
            "last_removed_count": int(connector.get("last_removed_count") or 0),
            "quarantine_on_error": True,
            "quarantined_count": len(connector.get("quarantined_sources", [])),
            "freshness_target_seconds": 3600 if str(connector.get("schedule") or "").lower() == "hourly" else 86400 if str(connector.get("schedule") or "").lower() == "daily" else None,
        },
        "retries": {
            "limit": int(connector.get("retry_limit") or 0),
            "backoff_seconds": int(connector.get("retry_backoff_seconds") or 0),
            "last_attempt_count": int(connector.get("retry_count") or 0),
        },
        "health": {
            "status": connector.get("status"),
            "last_attempt_at": connector.get("last_attempt_at"),
            "last_success_at": connector.get("last_success_at"),
            "last_error": connector.get("last_error"),
            "failure_count": int(connector.get("failure_count") or 0),
            "stale_count": int(connector.get("stale_count") or 0),
            "last_sync_duration_ms": connector.get("last_sync_duration_ms"),
        },
    }


def public_connector(connector: dict) -> dict:
    public = {key: value for key, value in connector.items() if key != "config"}
    return {**public, "contract": connector_contract(connector)}


def _token_for(connector: dict) -> str:
    token_env = str(connector.get("config", {}).get("token_env") or "").strip()
    if not token_env or not token_env.replace("_", "").isalnum() or not token_env.isupper():
        raise ValueError("Connector token environment variable is invalid")
    token = os.environ.get(token_env, "").strip()
    if not token:
        raise ValueError("Connector token is not configured")
    return token


def _json_request(url: str, token: str, params: Optional[dict] = None) -> dict | list:
    query = f"?{urlencode(params)}" if params else ""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{url}{query}", headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            import json

            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("Connector request failed") from exc


def _download(url: str, token: str) -> bytes:
    request = Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(request, timeout=60) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Connector download failed") from exc


def fetch_google_drive(connector: dict) -> list[dict]:
    token = _token_for(connector)
    scope_id = str(connector.get("config", {}).get("scope_id") or "").strip()
    query = "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
    if scope_id:
        query += f" and '{scope_id}' in parents"
    files: list[dict] = []
    page_token = None
    while True:
        params = {"q": query, "pageSize": "100", "fields": "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size)"}
        if page_token:
            params["pageToken"] = page_token
        payload = _json_request("https://www.googleapis.com/drive/v3/files", token, params)
        for item in payload.get("files", []):
            mime = item.get("mimeType", "")
            extension = Path(item.get("name", "")).suffix.lower()
            download_url = f"https://www.googleapis.com/drive/v3/files/{item['id']}?alt=media"
            if mime == "application/vnd.google-apps.document":
                download_url = f"https://www.googleapis.com/drive/v3/files/{item['id']}/export?mimeType=text/plain"
                extension = ".txt"
            elif mime == "application/vnd.google-apps.spreadsheet":
                download_url = f"https://www.googleapis.com/drive/v3/files/{item['id']}/export?mimeType=text/csv"
                extension = ".csv"
            if extension:
                files.append({"id": item["id"], "name": item["name"], "extension": extension, "download_url": download_url, "source_url": item.get("webViewLink")})
        page_token = payload.get("nextPageToken")
        if not page_token:
            return files


def fetch_sharepoint(connector: dict) -> list[dict]:
    token = _token_for(connector)
    config = connector.get("config", {})
    site_id = str(config.get("scope_id") or "").strip()
    drive_id = str(config.get("drive_id") or "").strip()
    if not site_id or not drive_id:
        raise ValueError("SharePoint site and drive scopes are required")
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root/children"
    files: list[dict] = []
    while url:
        payload = _json_request(url, token)
        for item in payload.get("value", []):
            if "file" not in item:
                continue
            name = item.get("name", "")
            extension = Path(name).suffix.lower()
            download_url = item.get("@microsoft.graph.downloadUrl")
            if extension and download_url:
                files.append({"id": item.get("id"), "name": name, "extension": extension, "download_url": download_url, "source_url": item.get("webUrl")})
        url = payload.get("@odata.nextLink")
    return files


def fetch_rest_api(connector: dict) -> list[dict]:
    """Fetch normalized read-only records from a server-configured JSON endpoint."""
    config = connector.get("config", {})
    endpoint = str(config.get("endpoint_url") or "").strip()
    if not endpoint.startswith("https://"):
        raise ValueError("Read-only API endpoints must use HTTPS")
    token_env = str(config.get("token_env") or "").strip()
    token = os.environ.get(token_env, "").strip() if token_env else ""
    payload = _json_request(endpoint, token)
    if isinstance(payload, list):
        raw_items = payload
    elif isinstance(payload, dict):
        raw_items = next((payload.get(key) for key in ("items", "data", "results", "records", "issues", "events", "users") if isinstance(payload.get(key), list)), [])
    else:
        raw_items = []
    items: list[dict] = []
    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue
        item_id = str(raw.get("id") or raw.get("key") or raw.get("uuid") or index)
        name = str(raw.get("name") or raw.get("title") or raw.get("summary") or raw.get("subject") or item_id)
        content = str(raw.get("content") or raw.get("description") or raw.get("body") or raw.get("text") or "").strip()
        if not content:
            content = json.dumps(raw, ensure_ascii=False, sort_keys=True)
        items.append({"id": item_id, "name": name, "extension": ".txt", "content": content, "source_url": raw.get("url") or raw.get("html_url") or raw.get("web_url")})
    return items


def download_remote_file(item: dict, connector: dict) -> bytes:
    if item.get("content") is not None:
        return str(item["content"]).encode("utf-8")
    token = _token_for(connector)
    return _download(item["download_url"], token)
