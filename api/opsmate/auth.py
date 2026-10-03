"""Firebase token and API-key auth for the FastAPI app."""

import hmac
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException, Request

_firebase_app = None


def _environment() -> str:
    return (os.environ.get("ENVIRONMENT") or os.environ.get("NODE_ENV") or "development").lower()


def _is_production() -> bool:
    return _environment() in ("production", "prod")


def init_firebase() -> None:
    """Initialize Firebase Admin once, if credentials are present."""
    global _firebase_app
    if _firebase_app is not None:
        return
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
    if not (project_id and client_email and private_key):
        return
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return
    cred = credentials.Certificate(
        {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )
    _firebase_app = firebase_admin.initialize_app(cred)


def firebase_ready() -> bool:
    init_firebase()
    try:
        import firebase_admin
        return bool(firebase_admin._apps)
    except Exception:
        return False


def admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS") or ""
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_email(email: Optional[str]) -> bool:
    if not email:
        return False
    return email.strip().lower() in admin_emails()


def _configured_emails(name: str) -> set[str]:
    raw = os.environ.get(name) or ""
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


def configured_organization_id() -> str:
    value = (os.environ.get("ORGANIZATION_ID") or "default").strip().lower()
    if not value or len(value) > 128 or not all(character.isalnum() or character in "._:-" for character in value):
        return "default"
    return value


def organization_claim_name() -> str:
    value = (os.environ.get("ORG_ID_CLAIM") or "org_id").strip()
    return value if value and len(value) <= 64 else "org_id"


def organization_claim_required() -> bool:
    return (os.environ.get("REQUIRE_ORG_CLAIM") or "false").strip().lower() in {"1", "true", "yes", "on"}


def _organization_id_from_token(decoded: dict) -> str:
    claim_name = organization_claim_name()
    claim_value = decoded.get(claim_name)
    if claim_value is None:
        claim_value = decoded.get("organization_id")
    if claim_value is None or str(claim_value).strip() == "":
        if organization_claim_required():
            raise HTTPException(status_code=403, detail="Organization claim required")
        return configured_organization_id()
    token_organization_id = str(claim_value).strip().lower()
    if token_organization_id != configured_organization_id():
        raise HTTPException(status_code=403, detail="Organization access denied")
    return token_organization_id


def user_role(email: Optional[str]) -> str:
    normalized = (email or "").strip().lower()
    if normalized in admin_emails():
        return "admin"
    try:
        from opsmate.directory import directory_store

        provisioned = directory_store.get_by_email(normalized)
        provisioned_roles = provisioned.get("roles", []) if provisioned and provisioned.get("active", True) else []
        for role in ("connector_admin", "knowledge_owner", "reviewer", "analyst", "auditor"):
            if role in provisioned_roles:
                return role
    except Exception:
        pass
    for role, env_name in (
        ("connector_admin", "CONNECTOR_ADMIN_EMAILS"),
        ("knowledge_owner", "KNOWLEDGE_OWNER_EMAILS"),
        ("reviewer", "REVIEWER_EMAILS"),
        ("analyst", "ANALYST_EMAILS"),
        ("auditor", "AUDITOR_EMAILS"),
    ):
        if normalized in _configured_emails(env_name):
            return role
    return "member"


@dataclass
class CurrentUser:
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    is_admin: bool = False
    role: str = "member"
    organization_id: str = "default"


def verify_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> None:
    expected = (os.environ.get("APP_API_KEY") or "").strip()
    if not expected:
        if _is_production():
            raise HTTPException(status_code=500, detail="API key not configured")
        return
    incoming = (x_api_key or "").strip()
    if not hmac.compare_digest(incoming, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _token_from_request(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def get_current_user(request: Request) -> CurrentUser:
    """Require a valid Firebase ID token."""
    token = _token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")
    if not firebase_ready():
        raise HTTPException(status_code=503, detail="Firebase admin not configured")
    try:
        from firebase_admin import auth as fb_auth

        decoded = fb_auth.verify_id_token(token, check_revoked=True)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = decoded.get("email")
    display_name = decoded.get("name")
    organization_id = _organization_id_from_token(decoded)
    from opsmate.users import get_user

    stored = get_user(uid)
    admin = bool(stored and stored.get("is_admin")) or is_admin_email(email)
    return CurrentUser(
        uid=uid,
        email=email,
        display_name=display_name,
        is_admin=admin,
        role="admin" if admin else user_role(email),
        organization_id=organization_id,
    )


def optional_auth(request: Request) -> Optional[CurrentUser]:
    token = _token_from_request(request)
    if not token or not firebase_ready():
        return None
    try:
        return get_current_user(request)
    except HTTPException:
        return None


def require_admin(user: CurrentUser) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_role(user: CurrentUser, *roles: str) -> CurrentUser:
    if user.is_admin or user.role in roles:
        return user
    raise HTTPException(status_code=403, detail="Insufficient access")
