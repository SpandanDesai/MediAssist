"""Regression tests for the improvement pass.

Covers the shared condition parser, rate-limiter hardening, the in-memory
query fallback, the message-retention cap, and a basic chat route flow. All
tests run without network access (Gemini is unconfigured, so the deterministic
rules engine is used).
"""

from __future__ import annotations

import time
from collections import deque

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.database import _matches, _sort_key, database
from app.services.rate_limit import RateLimiter, client_key
from app.utils.conditions import parse_condition_items


@pytest.fixture(autouse=True)
def clean_database():
    database._memory.clear()
    database.database = None
    database.using_memory = True
    yield
    database._memory.clear()


@pytest.fixture
def client():
    return TestClient(app_module.app)


# --- Shared condition parser -------------------------------------------------


def test_parse_condition_items_scales_fraction_confidence():
    items = parse_condition_items([{"name": "Migraine", "confidence": 0.6}])
    assert items == [{"name": "Migraine", "confidence": 60.0, "description": None}]


def test_parse_condition_items_accepts_strings_and_probability():
    items = parse_condition_items(["Cold", {"condition": "Flu", "probability": 72}])
    assert items[0] == {"name": "Cold", "confidence": None, "description": None}
    assert items[1]["name"] == "Flu"
    assert items[1]["confidence"] == 72.0


def test_parse_condition_items_tolerates_bad_input():
    assert parse_condition_items(None) == []
    assert parse_condition_items("not a list") == []
    # Non-numeric confidence and junk elements are dropped safely.
    items = parse_condition_items([{"name": "X", "confidence": "abc"}, 5, ["y"]])
    assert items == [{"name": "X", "confidence": None, "description": None}]


# --- Rate limiter ------------------------------------------------------------


def test_rate_limiter_blocks_over_limit():
    limiter = RateLimiter(limit=1, window_seconds=60)
    limiter.check("k")
    with pytest.raises(HTTPException):
        limiter.check("k")


def test_rate_limiter_garbage_collects_stale_keys():
    limiter = RateLimiter(limit=2, window_seconds=60)
    limiter._last_gc = 0.0  # force a sweep on the next check
    now = time.time()
    limiter._hits["stale"] = deque([now - 120, now - 110])
    limiter._hits["fresh"] = deque([now - 1])
    limiter.check("other")
    assert "stale" not in limiter._hits
    assert "fresh" in limiter._hits


def _fake_request(forwarded: str | None, host: str):
    class _Client:
        def __init__(self, value):
            self.host = value

    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return type("Req", (), {"headers": headers, "client": _Client(host)})()


def test_client_key_ignores_forwarded_header_by_default(monkeypatch):
    monkeypatch.setattr(get_settings(), "trust_proxy", False)
    req = _fake_request("1.2.3.4", "10.0.0.9")
    assert client_key(req) == "ip:10.0.0.9"


def test_client_key_uses_forwarded_header_when_trusted(monkeypatch):
    monkeypatch.setattr(get_settings(), "trust_proxy", True)
    req = _fake_request("1.2.3.4", "10.0.0.9")
    assert client_key(req) == "ip:1.2.3.4"


# --- In-memory query fallback ------------------------------------------------


def test_matches_supports_regex_in_and_or():
    doc = {"title": "Fever chat", "tag": "a"}
    assert _matches(doc, {"title": {"$regex": "fever", "$options": "i"}})
    assert not _matches(doc, {"title": {"$regex": "cough"}})
    assert _matches(doc, {"tag": {"$in": ["a", "b"]}})
    assert not _matches(doc, {"tag": {"$in": ["c"]}})
    assert _matches(doc, {"$or": [{"tag": "z"}, {"title": {"$regex": "chat"}}]})


def test_sort_key_orders_none_before_values():
    assert _sort_key(None) < _sort_key("a")


def test_sort_key_orders_numbers_numerically():
    # Integer fields (like message seq) must not sort lexicographically (10 before 2).
    assert sorted([10, 2, 1, 20, 3], key=_sort_key) == [1, 2, 3, 10, 20]


@pytest.mark.anyio
async def test_find_many_sorts_seq_numerically_across_double_digits():
    conv = "conv-order"
    for i in (1, 2, 9, 10, 11, 20):
        await database.insert_one(
            "messages", {"conversation_id": conv, "user_id": "u", "seq": i, "content": f"m{i}"}
        )
    rows = await database.find_many(
        "messages", {"conversation_id": conv}, sort=[("seq", 1)], limit=50
    )
    assert [row["seq"] for row in rows] == [1, 2, 9, 10, 11, 20]


# --- Chat route: persistence + retention cap ---------------------------------


import app.main as app_module  # noqa: E402


async def _make_user(token_version: int = 0) -> tuple[dict, str]:
    from app.core.security import create_access_token

    user = await database.insert_one("users", {"name": "Tester", "email": "t@example.com", "token_version": token_version})
    return user, create_access_token(str(user["_id"]), token_version=token_version)


@pytest.mark.anyio
async def test_chat_creates_and_appends_conversation(client: TestClient):
    user, token = await _make_user()
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/api/chat", json={"message": "I have a mild headache since this morning"}, headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["response"]
    conv_id = body["conversation_id"]
    assert conv_id

    second = client.post("/api/chat", json={"message": "It is still mild", "conversation_id": conv_id}, headers=headers)
    assert second.status_code == 200
    stored = await database.find_many(
        "messages", {"conversation_id": conv_id}, sort=[("seq", 1)], limit=50
    )
    assert len(stored) == 4  # two user + two assistant turns


@pytest.mark.anyio
async def test_chat_caps_stored_messages(client: TestClient, monkeypatch):
    from app.core.security import create_access_token

    monkeypatch.setattr(get_settings(), "max_conversation_messages", 4)
    user = await database.insert_one("users", {"name": "Cap", "email": "cap@example.com", "token_version": 0})
    token = create_access_token(str(user["_id"]), token_version=0)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = client.post("/api/chat", json={"message": "one"}, headers=headers)
    conv_id = r1.json()["conversation_id"]
    for msg in ("two", "three", "four"):
        client.post("/api/chat", json={"message": msg, "conversation_id": conv_id}, headers=headers)

    stored = await database.find_many(
        "messages", {"conversation_id": conv_id}, sort=[("seq", 1)], limit=50
    )
    # Exactly the cap is retained (proves we trim only the true overflow each turn).
    assert len(stored) == 4
    # Most recent exchange is always retained.
    assert stored[-2]["content"] == "four"
