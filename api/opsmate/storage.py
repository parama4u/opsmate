"""PostgreSQL-backed persistence for chat sessions.

Tables are created by Prisma migrations. Falls back to JSON files if
DATABASE_URL is unset or the database is unavailable.
"""

import json
import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("orgchai.storage")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(length: int = 12) -> str:
    return uuid.uuid4().hex[:length]


class ChatStore:
    """Persists chat sessions and messages in PostgreSQL."""

    def __init__(self, db_url: Optional[str] = None, base_dir: Optional[Path] = None):
        self.db_url = db_url or os.environ.get("DATABASE_URL")
        self._conn = None
        self._available = False

        self.base_dir = Path(base_dir) if base_dir else Path(__file__).resolve().parent / "data" / "chats"
        self.base_dir.mkdir(parents=True, exist_ok=True)

        if self.db_url:
            self._init_db()
        else:
            logger.info("DATABASE_URL not set; using file-based chat storage.")

    def _init_db(self) -> None:
        try:
            import psycopg2

            self._conn = psycopg2.connect(self.db_url)
            self._conn.autocommit = True
            self._available = True
            logger.info("ChatStore connected to PostgreSQL")
        except Exception as exc:
            logger.warning("ChatStore DB init failed, falling back to files: %s", exc)
            self._available = False

    @staticmethod
    def _row_to_chat_summary(row) -> dict:
        return {
            "id": row[0],
            "title": row[1],
            "created_at": row[2].isoformat() if row[2] else None,
            "updated_at": row[3].isoformat() if row[3] else None,
            "message_count": row[4],
        }

    @staticmethod
    def _row_to_chat_with_messages(chat_row, message_rows) -> dict:
        messages = []
        for m in message_rows:
            msg = {
                "id": m[0],
                "role": m[1],
                "content": m[2],
                "created_at": m[3].isoformat() if m[3] else None,
            }
            if m[4] is not None:
                msg["sources"] = m[4] if isinstance(m[4], list) else json.loads(m[4])
            if m[5] is not None:
                msg["model"] = m[5]
            messages.append(msg)
        return {
            "id": chat_row[0],
            "title": chat_row[1],
            "created_at": chat_row[2].isoformat() if chat_row[2] else None,
            "updated_at": chat_row[3].isoformat() if chat_row[3] else None,
            "messages": messages,
        }

    def _path(self, chat_id: str) -> Path:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", chat_id):
            digest = hashlib.sha256(chat_id.encode("utf-8")).hexdigest()
            return self.base_dir / "__invalid__" / f"{digest}.json"
        return self.base_dir / f"{chat_id}.json"

    def _file_load(self, chat_id: str) -> Optional[dict]:
        path = self._path(chat_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def _file_save(self, chat: dict) -> None:
        path = self._path(chat["id"])
        temp_path = path.with_suffix(".json.tmp")
        temp_path.write_text(json.dumps(chat, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def _owned(self, chat: Optional[dict], user_id: Optional[str]) -> Optional[dict]:
        if chat is None:
            return None
        if user_id and chat.get("user_id") and chat.get("user_id") != user_id:
            return None
        return chat

    def list_chats(self, user_id: Optional[str] = None) -> List[dict]:
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute(
                        """
                        SELECT c.id, c.title, c.created_at, c.updated_at,
                               COUNT(m.id) AS message_count
                        FROM chats c
                        LEFT JOIN chat_messages m ON m.chat_id = c.id
                        WHERE c.user_id = %s
                        GROUP BY c.id, c.title, c.created_at, c.updated_at
                        ORDER BY c.updated_at DESC;
                        """,
                        (user_id,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT c.id, c.title, c.created_at, c.updated_at,
                               COUNT(m.id) AS message_count
                        FROM chats c
                        LEFT JOIN chat_messages m ON m.chat_id = c.id
                        GROUP BY c.id, c.title, c.created_at, c.updated_at
                        ORDER BY c.updated_at DESC;
                        """
                    )
                rows = cur.fetchall()
            return [self._row_to_chat_summary(r) for r in rows]

        summaries = []
        for path in self.base_dir.glob("*.json"):
            try:
                chat = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if user_id and chat.get("user_id") and chat.get("user_id") != user_id:
                continue
            chat_id = chat.get("id")
            if not isinstance(chat_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", chat_id):
                continue
            summaries.append({
                "id": chat_id,
                "title": chat.get("title", "New chat"),
                "created_at": chat.get("created_at"),
                "updated_at": chat.get("updated_at"),
                "message_count": len(chat.get("messages", [])),
            })
        summaries.sort(key=lambda c: c.get("updated_at") or "", reverse=True)
        return summaries

    def create_chat(self, title: str = "New chat", user_id: Optional[str] = None) -> dict:
        chat_id = _new_id()
        now = _now_iso()

        if self._available:
            if not user_id:
                raise ValueError("user_id is required when using PostgreSQL")
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chats (id, user_id, title, created_at, updated_at)
                    VALUES (%s, %s, %s, now(), now())
                    RETURNING created_at, updated_at;
                    """,
                    (chat_id, user_id, title),
                )
                row = cur.fetchone()
            return {
                "id": chat_id,
                "title": title,
                "created_at": row[0].isoformat() if row else now,
                "updated_at": row[1].isoformat() if row else now,
                "messages": [],
            }

        chat = {
            "id": chat_id,
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }
        self._file_save(chat)
        return chat

    def get_chat(self, chat_id: str, user_id: Optional[str] = None) -> Optional[dict]:
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute(
                        "SELECT id, title, created_at, updated_at FROM chats WHERE id = %s AND user_id = %s;",
                        (chat_id, user_id),
                    )
                else:
                    cur.execute(
                        "SELECT id, title, created_at, updated_at FROM chats WHERE id = %s;",
                        (chat_id,),
                    )
                chat_row = cur.fetchone()
                if not chat_row:
                    return None
                cur.execute(
                    """
                    SELECT id, role, content, created_at, sources, model
                    FROM chat_messages
                    WHERE chat_id = %s
                    ORDER BY created_at ASC;
                    """,
                    (chat_id,),
                )
                message_rows = cur.fetchall()
            return self._row_to_chat_with_messages(chat_row, message_rows)

        return self._owned(self._file_load(chat_id), user_id)

    def add_message(
        self,
        chat_id: str,
        role: str,
        content: str,
        sources: Optional[list] = None,
        model: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[dict]:
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute("SELECT id, title FROM chats WHERE id = %s AND user_id = %s;", (chat_id, user_id))
                else:
                    cur.execute("SELECT id, title FROM chats WHERE id = %s;", (chat_id,))
                chat_row = cur.fetchone()
                if not chat_row:
                    return None

                msg_id = _new_id(8)
                sources_json = json.dumps(sources) if sources is not None else None
                cur.execute(
                    """
                    INSERT INTO chat_messages (id, chat_id, role, content, sources, model)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    (msg_id, chat_id, role, content, sources_json, model),
                )
                cur.execute("UPDATE chats SET updated_at = now() WHERE id = %s;", (chat_id,))

                if role == "user" and (chat_row[1] in (None, "", "New chat")):
                    title = content.strip().split("\n")[0][:48] or "New chat"
                    cur.execute("UPDATE chats SET title = %s WHERE id = %s;", (title, chat_id))

            return self.get_chat(chat_id, user_id=user_id)

        chat = self._owned(self._file_load(chat_id), user_id)
        if chat is None:
            return None
        message = {
            "id": _new_id(8),
            "role": role,
            "content": content,
            "created_at": _now_iso(),
        }
        if sources is not None:
            message["sources"] = sources
        if model is not None:
            message["model"] = model
        chat["messages"].append(message)
        chat["updated_at"] = message["created_at"]
        if role == "user" and (chat.get("title") in (None, "", "New chat")):
            title = content.strip().split("\n")[0][:48]
            chat["title"] = title or "New chat"
        self._file_save(chat)
        return chat

    def rename_chat(self, chat_id: str, title: str, user_id: Optional[str] = None) -> Optional[dict]:
        title = title.strip()[:120] or "New chat"
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute(
                        "UPDATE chats SET title = %s, updated_at = now() WHERE id = %s AND user_id = %s RETURNING id;",
                        (title, chat_id, user_id),
                    )
                else:
                    cur.execute(
                        "UPDATE chats SET title = %s, updated_at = now() WHERE id = %s RETURNING id;",
                        (title, chat_id),
                    )
                if not cur.fetchone():
                    return None
            return self.get_chat(chat_id, user_id=user_id)

        chat = self._owned(self._file_load(chat_id), user_id)
        if chat is None:
            return None
        chat["title"] = title
        chat["updated_at"] = _now_iso()
        self._file_save(chat)
        return chat

    def delete_chat(self, chat_id: str, user_id: Optional[str] = None) -> bool:
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute("DELETE FROM chats WHERE id = %s AND user_id = %s;", (chat_id, user_id))
                else:
                    cur.execute("DELETE FROM chats WHERE id = %s;", (chat_id,))
                return cur.rowcount > 0

        chat = self._owned(self._file_load(chat_id), user_id)
        if chat is None:
            return False
        try:
            self._path(chat_id).unlink()
            return True
        except OSError:
            return False

    def delete_all(self, user_id: Optional[str] = None) -> int:
        if self._available:
            with self._conn.cursor() as cur:
                if user_id:
                    cur.execute("DELETE FROM chats WHERE user_id = %s;", (user_id,))
                else:
                    cur.execute("DELETE FROM chat_messages;")
                    cur.execute("DELETE FROM chats;")
                return cur.rowcount

        count = 0
        for path in self.base_dir.glob("*.json"):
            try:
                if user_id:
                    chat = json.loads(path.read_text(encoding="utf-8"))
                    if chat.get("user_id") and chat.get("user_id") != user_id:
                        continue
                path.unlink()
                count += 1
            except OSError:
                continue
        return count

    def apply_retention(self, days: int) -> int:
        """Delete chats older than the configured retention window."""
        if days <= 0:
            return 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        if self._available:
            with self._conn.cursor() as cur:
                cur.execute("DELETE FROM chats WHERE updated_at < %s;", (cutoff,))
                return cur.rowcount

        removed = 0
        for path in self.base_dir.glob("*.json"):
            chat = self._file_load(path.stem)
            if not chat:
                continue
            updated = chat.get("updated_at") or chat.get("created_at")
            try:
                if updated and datetime.fromisoformat(updated.replace("Z", "+00:00")) < cutoff:
                    path.unlink()
                    removed += 1
            except (ValueError, OSError):
                continue
        return removed


CHAT_DIR = Path(__file__).resolve().parent / "data" / "chats"
chat_store = ChatStore()
