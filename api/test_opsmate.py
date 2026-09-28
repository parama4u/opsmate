"""Tests for OrgChai retriever, chat persistence, and API."""

import sys
import asyncio
import uuid
from pathlib import Path

import pytest
import httpx
from httpx import ASGITransport

sys.path.insert(0, str(Path(__file__).resolve().parent))

from opsmate.retriever import TfidfRetriever
from opsmate.models import DocumentChunk
from opsmate.auth import CurrentUser, get_current_user
from opsmate.main import app
from opsmate.retriever import retriever as global_retriever
from opsmate.storage import chat_store

TEST_USER = CurrentUser(uid="test-user", email="test@example.com", is_admin=True)
app.dependency_overrides[get_current_user] = lambda: TEST_USER


SAMPLE_HR = """
ACME Corp Vacation Policy

All full-time employees are entitled to 20 days of paid vacation per calendar year.
Vacation days accrue monthly and do not roll over into the next calendar year.
Employees must request vacation at least 14 days in advance.
"""

SAMPLE_IT = """
Resetting the staging database requires the company VPN.
Run the reset script at /opt/scripts/reset_staging.sh.
Never run this script against production.
"""


@pytest.fixture
def retriever():
    r = TfidfRetriever()
    r.ingest(SAMPLE_HR, "hr_policy.txt")
    r.ingest(SAMPLE_IT, "it_guide.txt")
    return r


def test_chunking_creates_chunks(retriever):
    assert len(retriever.chunks) >= 2
    assert all(isinstance(c, DocumentChunk) for c in retriever.chunks)


def test_search_returns_relevant_source(retriever):
    results = retriever.search("How many vacation days do I get?", top_k=1)
    assert len(results) == 1
    assert results[0].source == "hr_policy.txt"
    assert results[0].score > 0


def test_search_returns_it_doc_for_db_question(retriever):
    results = retriever.search("How do I reset the staging database?", top_k=1)
    assert len(results) == 1
    assert results[0].source == "it_guide.txt"


def test_empty_query_returns_nothing(retriever):
    results = retriever.search("!!!@@@", top_k=3)
    assert results == []


def test_clear_empties_index(retriever):
    assert len(retriever.chunks) > 0
    retriever.clear()
    assert retriever.chunks == []


def test_remove_source_removes_only_matching(retriever):
    assert any(c.source == "hr_policy.txt" for c in retriever.chunks)
    removed = retriever.remove_source("hr_policy.txt")
    assert removed > 0
    assert not any(c.source == "hr_policy.txt" for c in retriever.chunks)
    assert any(c.source == "it_guide.txt" for c in retriever.chunks)
    results = retriever.search("reset staging database", top_k=1)
    assert results and results[0].source == "it_guide.txt"


def _request(method: str, path: str, **kwargs):
    async def _run():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
            return await getattr(ac, method)(path, **kwargs)

    return asyncio.run(_run())


def _data(res):
    body = res.json()
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


@pytest.fixture
def client():
    global_retriever.clear()
    global_retriever.ingest(SAMPLE_HR, "hr_policy.txt")
    global_retriever.ingest(SAMPLE_IT, "it_guide.txt")
    chat_store.delete_all()
    yield
    global_retriever.clear()
    chat_store.delete_all()


def test_health_endpoint(client):
    res = _request("get", "/api/health")
    assert res.status_code == 200
    data = _data(res)
    assert data["status"] == "ok"
    assert data["chunks"] >= 2


def test_ask_endpoint_returns_answer(client):
    res = _request(
        "post",
        "/api/ask",
        json={"question": "How many vacation days?", "top_k": 2, "generate": False},
    )
    assert res.status_code == 200
    data = _data(res)
    assert data["question"] == "How many vacation days?"
    assert data["model"] == "retrieval-only"
    assert len(data["sources"]) >= 1
    assert data["sources"][0]["source"] == "hr_policy.txt"


def test_documents_endpoint(client):
    res = _request("get", "/api/documents")
    assert res.status_code == 200
    data = _data(res)
    assert "hr_policy.txt" in data["documents"]


def test_get_document_content(client):
    res = _request("get", "/api/documents/hr_policy.txt")
    assert res.status_code == 200
    data = _data(res)
    assert data["filename"] == "hr_policy.txt"
    assert "vacation" in data["content"].lower() or "leave" in data["content"].lower() or len(data["content"]) > 0

    res = _request("get", "/api/documents/does_not_exist.txt")
    assert res.status_code == 404


def test_create_and_list_chat(client):
    res = _request("post", "/api/chats")
    assert res.status_code == 200
    chat = _data(res)
    assert chat["id"]
    assert chat["title"] == "New chat"
    assert chat["messages"] == []

    res = _request("get", "/api/chats")
    assert res.status_code == 200
    chats = _data(res)
    assert len(chats) == 1
    assert chats[0]["id"] == chat["id"]


def test_send_message_persists_conversation(client):
    chat = _data(_request("post", "/api/chats"))

    res = _request(
        "post",
        f"/api/chats/{chat['id']}/messages",
        json={"question": "How many vacation days?", "top_k": 2, "generate": False},
    )
    assert res.status_code == 200
    updated = _data(res)
    assert len(updated["messages"]) == 2
    assert updated["messages"][0]["role"] == "user"
    assert updated["messages"][0]["content"] == "How many vacation days?"
    assert updated["messages"][1]["role"] == "assistant"
    assert updated["messages"][1]["model"] == "retrieval-only"
    assert updated["messages"][1]["sources"]
    assert updated["messages"][1]["sources"][0]["source"] == "hr_policy.txt"
    assert updated["title"] == "How many vacation days?"

    reloaded = _data(_request("get", f"/api/chats/{chat['id']}"))
    assert len(reloaded["messages"]) == 2
    assert reloaded["title"] == "How many vacation days?"


def test_chat_survives_across_sessions(client):
    chat = _data(_request("post", "/api/chats"))
    _request(
        "post",
        f"/api/chats/{chat['id']}/messages",
        json={"question": "reset staging database", "top_k": 1, "generate": False},
    )

    fresh = chat_store.get_chat(chat["id"], user_id=TEST_USER.uid)
    assert fresh is not None
    assert len(fresh["messages"]) == 2
    assert fresh["messages"][1]["sources"][0]["source"] == "it_guide.txt"


def test_rename_chat(client):
    chat = _data(_request("post", "/api/chats"))
    res = _request("patch", f"/api/chats/{chat['id']}", json={"title": "Important notes"})
    assert res.status_code == 200
    assert _data(res)["title"] == "Important notes"


def test_delete_chat(client):
    chat = _data(_request("post", "/api/chats"))
    res = _request("delete", f"/api/chats/{chat['id']}")
    assert res.status_code == 200
    assert _request("get", f"/api/chats/{chat['id']}").status_code == 404


def test_send_message_to_missing_chat_404(client):
    res = _request(
        "post",
        "/api/chats/doesnotexist/messages",
        json={"question": "hi", "generate": False},
    )
    assert res.status_code == 404


def test_delete_document_via_endpoint(client):
    unique = f"temp_test_{uuid.uuid4().hex[:6]}.txt"
    res = _request("post", "/api/documents/ingest", files={"file": (unique, b"Temporary document about onboarding buddies.", "text/plain")})
    assert res.status_code == 200
    assert _data(res)["filename"] == unique

    res = _request("delete", f"/api/documents/{unique}")
    assert res.status_code == 200
    assert _data(res)["chunks_removed"] >= 1
    assert _data(res)["file_deleted"] is True

    assert _request("delete", f"/api/documents/{unique}").status_code == 404


def test_strip_mention_removes_bot_mention():
    from opsmate.slack_bot import _strip_mention

    assert _strip_mention("<@U12345> How many vacation days?") == "How many vacation days?"
    assert _strip_mention("<@U0BOTID>  reset the database ") == "reset the database"
    assert _strip_mention("What is the policy?") == "What is the policy?"


def test_build_slack_answer_includes_sources(client):
    from opsmate.slack_bot import build_slack_answer

    sources = [
        DocumentChunk(text="snippet about vacation", source="hr_policy.txt", score=0.42),
    ]
    result = build_slack_answer("question", "You get 20 days.", sources)
    assert "You get 20 days." in result
    assert "*Sources:*" in result
    assert "hr_policy.txt" in result
    assert "0.42" in result


def test_slack_answer_question_routes_correctly(client):
    from opsmate.slack_bot import answer_question

    answer, sources = answer_question("How do I reset the staging database?")
    assert sources
    assert sources[0].source == "it_guide.txt"


def test_slack_answer_question_no_results(client):
    from opsmate.slack_bot import answer_question

    answer, sources = answer_question("zzznomatch qwerty asdf")
    assert sources == []


def test_slack_status_endpoint(client):
    res = _request("get", "/api/slack/status")
    assert res.status_code == 200
    data = _data(res)
    for key in ("enabled", "socket_mode", "connected", "bot_token_set", "app_token_set", "scopes", "ready"):
        assert key in data, f"missing key: {key}"
