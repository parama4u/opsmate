"""User persistence. Tables are created by Prisma migrations."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("orgchai.users")

_memory: dict[str, dict] = {}


def _db_url() -> Optional[str]:
    return os.environ.get("DATABASE_URL")


def _now():
    return datetime.now(timezone.utc)


def _row_to_user(row) -> dict:
    return {
        "id": row[0],
        "email": row[1],
        "displayName": row[2],
        "isAdmin": bool(row[3]),
        "lastLoginAt": row[4].isoformat() if row[4] else None,
        "createdAt": row[5].isoformat() if row[5] else None,
    }


def get_user(uid: str) -> Optional[dict]:
    url = _db_url()
    if not url:
        return _memory.get(uid)
    try:
        import psycopg2

        with psycopg2.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, email, display_name, is_admin, last_login_at, created_at
                    FROM users WHERE id = %s;
                    """,
                    (uid,),
                )
                row = cur.fetchone()
        return _row_to_user(row) if row else None
    except Exception as exc:
        logger.warning("get_user failed: %s", exc)
        return _memory.get(uid)


def upsert_user(uid: str, email: str, display_name: Optional[str], is_admin: bool) -> tuple[dict, bool]:
    """Insert or update a user. Returns (user, is_new)."""
    url = _db_url()
    if not url:
        existing = _memory.get(uid)
        now = _now().isoformat()
        if existing:
            existing["displayName"] = display_name or existing.get("displayName")
            existing["lastLoginAt"] = now
            existing["isAdmin"] = is_admin or bool(existing.get("isAdmin"))
            return existing, False
        user = {
            "id": uid,
            "email": email,
            "displayName": display_name,
            "isAdmin": is_admin,
            "lastLoginAt": now,
            "createdAt": now,
        }
        _memory[uid] = user
        return user, True

    import psycopg2

    with psycopg2.connect(url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, display_name, is_admin, last_login_at, created_at
                FROM users WHERE id = %s;
                """,
                (uid,),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE users
                    SET last_login_at = now(),
                        display_name = COALESCE(%s, display_name),
                        is_admin = (is_admin OR %s)
                    WHERE id = %s
                    RETURNING id, email, display_name, is_admin, last_login_at, created_at;
                    """,
                    (display_name, is_admin, uid),
                )
                row = cur.fetchone()
                return _row_to_user(row), False

            cur.execute(
                """
                INSERT INTO users (id, email, display_name, is_admin, last_login_at)
                VALUES (%s, %s, %s, %s, now())
                RETURNING id, email, display_name, is_admin, last_login_at, created_at;
                """,
                (uid, email, display_name, is_admin),
            )
            row = cur.fetchone()
            return _row_to_user(row), True
