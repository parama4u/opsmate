"""Slack integration for OrgChai.

Connects OrgChai to a Slack workspace so employees can ask questions by
mentioning the bot in a channel or sending a direct message. Answers are
generated from the same internal document index used by the web UI, and
replies are posted in the originating thread.

Two transport modes are supported:

* **Socket Mode** (default, no public URL required): set ``SLACK_APP_TOKEN``
  to the xapp- token from your Slack app's Socket Mode settings.
* **HTTP request URL**: set ``SLACK_BOT_TOKEN`` and expose the server publicly
  so Slack can reach ``/api/slack/events``.

Required environment variables:
    SLACK_BOT_TOKEN  - xoxb- bot OAuth token (always required)
    SLACK_APP_TOKEN  - xapp- token (required only for Socket Mode)
"""

import logging
import hashlib
import os
import re
import time
from datetime import date
from typing import Optional
from urllib.parse import urlparse

from slack_bolt import App as SlackApp
from slack_bolt.adapter.socket_mode import SocketModeHandler

from opsmate.retriever import retriever
from opsmate.llm import generate_answer
from opsmate.knowledge import knowledge_store
from opsmate.auth import is_admin_email
from opsmate.directory import directory_store
from opsmate.metrics import metrics_store
from opsmate.models import DocumentChunk

logger = logging.getLogger("orgchai.slack")
logger.setLevel(logging.DEBUG)
# Ensure logs propagate to root so uvicorn's log config picks them up.
logger.propagate = True

# Matches a leading <@U12345> mention that Slack injects into message text.
_MENTION_RE = re.compile(r"<@U\w+>\s*")


def _strip_mention(text: str) -> str:
    """Remove leading bot mention(s) and surrounding whitespace."""
    return _MENTION_RE.sub("", text).strip()


def build_slack_answer(question: str, answer: str, sources) -> str:
    """Format an answer + cited sources for Slack mrkdwn."""
    parts = [answer]
    if sources:
        parts.append("\n\n*Sources:*")
        for i, s in enumerate(sources, 1):
            score = f" (relevance: {s.score:.2f})" if s.score is not None else ""
            source_record = knowledge_store.get_document(s.source)
            source_url = source_record.get("source_url")
            parsed_url = urlparse(source_url) if source_url else None
            safe_url = source_url if parsed_url and parsed_url.scheme in {"http", "https"} and parsed_url.netloc else None
            link = f" <{safe_url}|open source>" if safe_url else ""
            parts.append(f"* {source_record.get('title') or s.source}{link}{score}")
    return "\n".join(parts)


def _slack_allowed_sources(user_email: Optional[str]) -> set[str] | None:
    if is_admin_email(user_email):
        return None
    normalized_email = (user_email or "").strip().lower()
    email_domain = normalized_email.split("@", 1)[1] if "@" in normalized_email else ""
    user_groups = directory_store.groups_for(user_email)
    allowed_sources: set[str] = set()
    for chunk in retriever.chunks:
        metadata = knowledge_store.get_document(chunk.source)
        allowed_emails = {str(email).lower() for email in metadata.get("allowed_emails", [])}
        allowed_domains = {str(domain).lower().lstrip("@") for domain in metadata.get("allowed_domains", [])}
        allowed_groups = {str(group).lower() for group in metadata.get("allowed_groups", [])}
        if not (allowed_emails or allowed_domains or allowed_groups) or normalized_email in allowed_emails or email_domain in allowed_domains or allowed_groups.intersection(user_groups):
            allowed_sources.add(chunk.source)
    return allowed_sources


def answer_question(question: str, top_k: int = 3, user_email: Optional[str] = None) -> tuple[str, list]:
    """Retrieve + generate an answer for a Slack question.

    Returns (answer_text, sources) so callers can format for Slack.
    """
    started_at = time.monotonic()
    sources = retriever.search(question, top_k=top_k, allowed_sources=_slack_allowed_sources(user_email))
    normalized_email = (user_email or "").lower()
    admin = is_admin_email(user_email)
    threshold = float(os.environ.get("MIN_RETRIEVAL_SCORE", "0.08"))
    eligible = []
    for source in sources:
        metadata = knowledge_store.get_document(source.source)
        if metadata.get("status") in {"draft", "expired", "archived", "superseded"}:
            continue
        if (metadata.get("expiration_date") or "9999-12-31") < date.today().isoformat():
            continue
        allowed_emails = {str(email).lower() for email in metadata.get("allowed_emails", [])}
        allowed_domains = {str(domain).lower().lstrip("@") for domain in metadata.get("allowed_domains", [])}
        allowed_groups = {str(group).lower() for group in metadata.get("allowed_groups", [])}
        email_domain = normalized_email.split("@", 1)[1] if "@" in normalized_email else ""
        if (allowed_emails or allowed_domains or allowed_groups) and not admin and normalized_email not in allowed_emails and email_domain not in allowed_domains and not allowed_groups.intersection(directory_store.groups_for(user_email)):
            continue
        if (source.score or 0) < threshold:
            continue
        eligible.append(source)
    sources = eligible
    knowledge_store.add_audit("slack_search", actor=user_email, detail=hashlib.sha256(question.encode("utf-8")).hexdigest()[:16])
    answer, model = generate_answer(question, sources)
    knowledge_store.add_audit("no_result" if not sources else "answer_generated", actor=user_email, detail=model)
    if model == "fallback":
        knowledge_store.add_audit("answer_fallback", actor=user_email)
    metrics_store.record("answer", latency_ms=round((time.monotonic() - started_at) * 1000, 1), model=model, source_count=len(sources), estimated_cost=0)
    return answer, sources


def _allowed_slack_channels() -> set[str]:
    return {
        item.strip()
        for item in os.environ.get("SLACK_ALLOWED_CHANNELS", "").split(",")
        if item.strip()
    }


def is_slack_channel_allowed(channel_id: str) -> bool:
    return channel_id in _allowed_slack_channels()


def _slack_client():
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        raise RuntimeError("Slack integration is not configured")
    from slack_sdk import WebClient

    return WebClient(token=token)


def _message_text(message: dict) -> str:
    text = re.sub(r"<@[^>]+>", "", str(message.get("text") or "")).strip()
    if not text:
        return ""
    user = message.get("user") or message.get("username") or "unknown user"
    timestamp = message.get("ts") or ""
    return f"{user} ({timestamp}): {text}"


def summarize_slack_channel(
    channel_id: str,
    thread_ts: Optional[str] = None,
    limit: int = 50,
    language: str = "default",
    user_email: Optional[str] = None,
) -> dict:
    """Summarize explicitly allowlisted Slack content without posting or writing."""
    allowed_channels = _allowed_slack_channels()
    if channel_id not in allowed_channels and not is_admin_email(user_email):
        raise PermissionError("Slack channel is not allowlisted")

    client = _slack_client()
    if thread_ts:
        response = client.conversations_replies(channel=channel_id, ts=thread_ts, limit=limit)
    else:
        response = client.conversations_history(channel=channel_id, limit=limit)
    messages = [line for line in (_message_text(item) for item in response.get("messages", [])) if line]
    if not messages:
        knowledge_store.add_audit("slack_recap_empty", actor=user_email, detail=channel_id)
        return {"channel_id": channel_id, "thread_ts": thread_ts, "message_count": 0, "summary": "No permitted messages were found.", "source_url": None}

    source_id = f"slack:{channel_id}:{thread_ts or 'channel'}"
    chunk = DocumentChunk(text="\n".join(reversed(messages)), source=source_id, score=1.0)
    question = "Summarize the permitted Slack conversation. List decisions, open questions, owners, and dates when present."
    summary, model = generate_answer(question, [chunk], mode="summarize", language=language)
    knowledge_store.add_audit("slack_recap", actor=user_email, detail=source_id)
    return {
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "message_count": len(messages),
        "summary": summary,
        "model": model,
        "source_url": f"https://app.slack.com/client/{channel_id}/{thread_ts or ''}".rstrip("/"),
    }


def post_slack_digest(channel_id: str, summaries: list[dict]) -> dict:
    """Post a scheduled digest only to an explicitly allowlisted destination."""
    if not is_slack_channel_allowed(channel_id):
        raise PermissionError("Slack destination is not allowlisted")
    text_parts = ["*OrgChai recap*"]
    for item in summaries:
        text_parts.append(f"\n*Channel {item['channel_id']}*\n{item['summary']}")
    response = _slack_client().chat_postMessage(channel=channel_id, text="\n".join(text_parts))
    return {"channel_id": channel_id, "ts": response.get("ts")}


def create_slack_app() -> Optional[SlackApp]:
    """Create and configure the Slack Bolt app.

    Returns None if Slack credentials are not configured, so the server can
    start without Slack enabled.
    """
    import os

    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not bot_token:
        logger.info("SLACK_BOT_TOKEN not set; Slack integration disabled.")
        return None

    signing_secret = os.environ.get("SLACK_SIGNING_SECRET", "")
    app = SlackApp(token=bot_token, signing_secret=signing_secret)

    @app.event("app_mention")
    def handle_app_mention(event, say, client):
        """Respond when the bot is mentioned in a channel."""
        logger.info(">>> app_mention event received: user=%s channel=%s", event.get("user"), event.get("channel"))
        text = _strip_mention(event.get("text", ""))
        if not text:
            say("I didn't catch a question. Try: @OrgChai How many vacation days do I get?")
            return
        thread_ts = event.get("thread_ts") or event.get("ts")
        channel = event.get("channel")
        user = event.get("user", "someone")

        profile = client.users_info(user=user).get("user", {}).get("profile", {})
        user_email = profile.get("email", "")
        if not is_slack_channel_allowed(channel) and not is_admin_email(user_email):
            say(text="OrgChai is not enabled in this channel.", thread_ts=thread_ts, channel=channel)
            return

        # Acknowledge quickly while we process.
        logger.info(">>> Acknowledging mention from %s", user)
        say(text=f"Looking that up for you, <@{user}>...", thread_ts=thread_ts, channel=channel)

        try:
            answer, sources = answer_question(text, user_email=user_email)
            logger.info(">>> Answer generated (%d sources), posting reply", len(sources))
            say(text=build_slack_answer(text, answer, sources), thread_ts=thread_ts, channel=channel)
        except Exception as exc:
            logger.exception("Error answering Slack mention")
            say(text="Sorry, I could not complete that lookup. Please try again later.", thread_ts=thread_ts, channel=channel)

    @app.event("message")
    def handle_message(message, say, client):
        """Respond to direct messages to the bot."""
        logger.info(">>> message event received: channel_type=%s subtype=%s bot_id=%s",
                     message.get("channel_type"), message.get("subtype"), message.get("bot_id"))
        # Only react to DMs (im channels), not every message in every channel.
        channel_type = message.get("channel_type")
        if channel_type != "im":
            return
        # Ignore bot messages and message edits/deletes.
        if message.get("subtype") or message.get("bot_id"):
            return
        text = message.get("text", "").strip()
        if not text:
            return
        thread_ts = message.get("thread_ts") or message.get("ts")

        logger.info(">>> Processing DM question")
        say(text="Looking that up...", thread_ts=thread_ts)
        try:
            profile = client.users_info(user=message.get("user", "")).get("user", {}).get("profile", {})
            answer, sources = answer_question(text, user_email=profile.get("email", ""))
            logger.info(">>> Answer generated (%d sources), posting DM reply", len(sources))
            say(text=build_slack_answer(text, answer, sources), thread_ts=thread_ts)
        except Exception as exc:
            logger.exception("Error answering Slack DM")
            say(text="Sorry, I could not complete that lookup. Please try again later.", thread_ts=thread_ts)

    @app.command("/orgchai")
    def handle_slash_command(ack, command, respond, client):
        """Handle the /orgchai slash command."""
        ack()
        text = (command.get("text") or "").strip()
        if not text:
            respond("Usage: `/orgchai <your question>`")
            return
        try:
            profile = client.users_info(user=command.get("user_id", "")).get("user", {}).get("profile", {})
            answer, sources = answer_question(text, user_email=profile.get("email", ""))
            respond(build_slack_answer(text, answer, sources), response_type="ephemeral")
        except Exception as exc:
            logger.exception("Error answering slash command")
            respond("Sorry, I could not complete that lookup. Please try again later.", response_type="ephemeral")

    logger.info("Slack app configured.")
    return app


_socket_handler: Optional[SocketModeHandler] = None

# Scopes required for the bot to receive events and respond.
REQUIRED_SCOPES = {
    "chat:write": "Post messages and replies",
    "app_mentions:read": "Receive @mention events in channels",
    "channels:history": "Read explicitly permitted public channel content",
    "im:history": "Receive direct message events",
    "im:read": "List and open DM conversations",
    "groups:history": "Read explicitly permitted private channel content",
    "channels:read": "List public channels (to join them)",
    "channels:join": "Join channels so it can be mentioned",
    "users:read": "List users (to open DMs)",
}

# Optional scopes (e.g. for slash commands).
OPTIONAL_SCOPES = {
    "commands": "Slash command support",
}


def check_bot_scopes() -> dict:
    """Call auth.test to fetch the bot's OAuth scopes and report missing ones.

    Returns a dict with: granted (list), required_missing (list), optional_missing (list).
    """
    import os

    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not bot_token:
        return {"granted": [], "required_missing": list(REQUIRED_SCOPES.keys()), "optional_missing": list(OPTIONAL_SCOPES.keys())}

    try:
        from slack_sdk import WebClient
        client = WebClient(token=bot_token)
        resp = client.api_call("auth.test")
        if not resp.get("ok"):
            return {"granted": [], "required_missing": list(REQUIRED_SCOPES.keys()), "optional_missing": list(OPTIONAL_SCOPES.keys()), "error": resp.get("error", "auth.test failed")}

        scopes_header = resp.headers.get("x-oauth-scopes", "")
        granted = [s.strip() for s in scopes_header.split(",") if s.strip()]
        return {
            "granted": granted,
            "required_missing": [s for s in REQUIRED_SCOPES if s not in granted],
            "optional_missing": [s for s in OPTIONAL_SCOPES if s not in granted],
        }
    except Exception as exc:
        logger.exception("Slack scope check failed")
        return {"granted": [], "required_missing": list(REQUIRED_SCOPES.keys()), "optional_missing": list(OPTIONAL_SCOPES.keys()), "error": "Slack status unavailable"}


def check_socket_mode_enabled() -> dict:
    """Check whether Socket Mode is actually enabled in the Slack app settings.

    Calls apps.connections.open and inspects the response for the
    "[WARN] Socket Mode is not turned on." message that Slack returns when the
    app token is valid but Socket Mode is toggled off in the app config.
    """
    import os

    app_token = os.environ.get("SLACK_APP_TOKEN")
    if not app_token:
        return {"enabled": False, "error": "SLACK_APP_TOKEN not set"}

    try:
        from slack_sdk import WebClient
        client = WebClient(token=app_token)
        resp = client.api_call("apps.connections.open")
        if not resp.get("ok"):
            return {"enabled": False, "error": resp.get("error", "apps.connections.open failed")}

        warnings = (resp.get("response_metadata") or {}).get("messages", [])
        socket_off = any("Socket Mode is not turned on" in w for w in warnings)
        return {
            "enabled": not socket_off,
            "warnings": warnings,
        }
    except Exception as exc:
        logger.exception("Slack Socket Mode check failed")
        return {"enabled": False, "error": "Slack status unavailable"}


def start_socket_mode(slack_app: SlackApp) -> None:
    """Start Slack Socket Mode in a background daemon thread.

    Socket Mode uses a WebSocket so no public URL is needed. Safe to call
    once at server startup.
    """
    import os

    global _socket_handler
    app_token = os.environ.get("SLACK_APP_TOKEN")
    if not app_token:
        logger.warning("SLACK_APP_TOKEN not set; cannot start Socket Mode.")
        return

    # Pre-check: is Socket Mode actually toggled on in the Slack app?
    sm = check_socket_mode_enabled()
    if not sm.get("enabled"):
        logger.error(
            "Socket Mode is NOT enabled in your Slack app settings! "
            "Go to api.slack.com/apps > your app > Socket Mode > toggle ON. "
            "Details: %s",
            sm.get("error") or sm.get("warnings"),
        )

    _socket_handler = SocketModeHandler(app=slack_app, app_token=app_token)
    _socket_handler.connect()  # non-blocking; runs in a daemon thread
    logger.info("Slack Socket Mode connected and listening.")

    # Validate scopes after connecting so missing ones are surfaced in logs.
    scope_info = check_bot_scopes()
    if scope_info.get("required_missing"):
        missing = scope_info["required_missing"]
        logger.warning(
            "Missing required OAuth scopes: %s. Without these, Slack will NOT deliver "
            "mention/DM events. Go to your app > OAuth & Permissions > add scopes > reinstall.",
            ", ".join(missing),
        )
    else:
        logger.info("All required OAuth scopes present: %s", ", ".join(scope_info.get("granted", [])))


def slack_status() -> dict:
    """Return the current Slack configuration status for GET /api/slack/status."""
    import os

    scope_info = check_bot_scopes()
    socket_info = check_socket_mode_enabled()
    return {
        "enabled": bool(os.environ.get("SLACK_BOT_TOKEN")),
        "socket_mode": bool(os.environ.get("SLACK_APP_TOKEN")),
        "socket_mode_enabled": socket_info.get("enabled"),
        "socket_mode_warnings": socket_info.get("warnings", []),
        "connected": _socket_handler is not None,
        "bot_token_set": bool(os.environ.get("SLACK_BOT_TOKEN")),
        "app_token_set": bool(os.environ.get("SLACK_APP_TOKEN")),
        "scopes": scope_info,
        "ready": (
            bool(os.environ.get("SLACK_BOT_TOKEN"))
            and socket_info.get("enabled") is True
            and not scope_info.get("required_missing")
        ),
    }
