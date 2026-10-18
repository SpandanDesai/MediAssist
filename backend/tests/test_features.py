"""Tests for the additive feature set (ledger, stats, export, history tags,
report share links, reminders). Runs against the in-memory store with no network.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.database import database
from app.main import app
from app.services.rate_limit import auth_limiter, consultation_limiter, upload_limiter


@pytest.fixture(autouse=True)
def clean_state():
    database._memory.clear()
    database.database = None
    database.using_memory = True
    for limiter in (auth_limiter, consultation_limiter, upload_limiter):
        limiter._hits.clear()
    yield
    database._memory.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _signup(client: TestClient, email: str) -> dict:
    resp = client.post(
        "/api/auth/signup",
        json={"name": "Feature Tester", "email": email, "password": "SecretPassword123!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    return {"Authorization": f"Bearer {body['access_token']}"}


# --- Medication / allergy ledger + profile-aware review ----------------------


def test_allergy_ledger_conflict_is_flagged(client: TestClient):
    headers = _signup(client, "ledger1@example.com")
    put = client.put("/api/profile", json={"allergy_list": ["Penicillin"]}, headers=headers)
    assert put.status_code == 200
    assert put.json()["allergy_list"] == ["Penicillin"]

    review = client.post("/api/medication/review", json={"text": "Can I take penicillin for my cough?"}, headers=headers)
    assert review.status_code == 200
    result = review.json()
    assert result is not None
    assert result["urgency"] == "high"
    assert "Penicillin" in result["response"]


def test_ledger_review_returns_null_when_unrelated(client: TestClient):
    headers = _signup(client, "ledger2@example.com")
    client.put("/api/profile", json={"allergy_list": ["Penicillin"], "medication_list": ["Metformin"]}, headers=headers)
    review = client.post("/api/medication/review", json={"text": "I have a mild headache"}, headers=headers)
    assert review.status_code == 200
    assert review.json() is None


def test_ledger_deduplicates(client: TestClient):
    headers = _signup(client, "ledger3@example.com")
    put = client.put("/api/profile", json={"medication_list": ["Aspirin", "aspirin", "Aspirin"]}, headers=headers)
    assert put.json()["medication_list"] == ["Aspirin"]


# --- Stats -------------------------------------------------------------------


def test_stats_aggregates_user_data(client: TestClient):
    headers = _signup(client, "stats@example.com")
    client.post("/api/chat", json={"message": "I have a mild headache"}, headers=headers)
    client.post(
        "/api/assessment",
        json={"smoking": "never", "alcohol": "rarely", "exercise": "weekly", "diet": "mixed", "sleep": "7-9", "stress": "low"},
        headers=headers,
    )
    resp = client.get("/api/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["counts"]["conversations"] >= 1
    assert data["counts"]["assessments"] >= 1
    assert data["assessment_trend"][-1]["risk_score"] >= 0


# --- Export ------------------------------------------------------------------


def test_export_includes_profile_and_omits_secrets(client: TestClient):
    headers = _signup(client, "export@example.com")
    client.post("/api/chat", json={"message": "sore throat"}, headers=headers)
    resp = client.get("/api/profile/export", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["email"] == "export@example.com"
    assert "password_hash" not in data["profile"]
    assert len(data["conversations"]) >= 1


# --- Conversation rename/tag/archive ----------------------------------------


def test_update_conversation_metadata_and_ownership(client: TestClient):
    headers_a = _signup(client, "convA@example.com")
    headers_b = _signup(client, "convB@example.com")
    conv_id = client.post("/api/chat", json={"message": "risky rash"}, headers=headers_a).json()["conversation_id"]

    patch = client.patch(
        f"/api/history/{conv_id}",
        json={"title": "Rash thread", "tags": ["derm", "derm", "urgent"], "archived": True},
        headers=headers_a,
    )
    assert patch.status_code == 200
    body = patch.json()
    assert body["title"] == "Rash thread"
    assert body["tags"] == ["derm", "urgent"]
    assert body["archived"] is True

    # Another user cannot modify it.
    forbidden = client.patch(f"/api/history/{conv_id}", json={"archived": True}, headers=headers_b)
    assert forbidden.status_code == 404


# --- Report share links ------------------------------------------------------


def test_share_link_is_public_and_scoped(client: TestClient):
    headers = _signup(client, "share@example.com")
    create = client.post("/api/reports", json={"symptoms": "fever", "title": "Share report"}, headers=headers)
    assert create.status_code == 200
    report_id = create.headers.get("X-Report-Id")
    assert report_id

    share = client.post(f"/api/reports/{report_id}/share", headers=headers)
    assert share.status_code == 200
    token = share.json()["token"]

    # Public, unauthenticated download works.
    public = client.get(f"/api/share/{token}/download")
    assert public.status_code == 200
    assert public.headers["content-type"] == "application/pdf"

    # A tampered token is rejected.
    bad = client.get("/api/share/not-a-real-token/download")
    assert bad.status_code == 401


# --- Reminders ---------------------------------------------------------------


def test_reminder_crud_and_ownership(client: TestClient):
    headers_a = _signup(client, "remA@example.com")
    headers_b = _signup(client, "remB@example.com")

    created = client.post("/api/reminders", json={"title": "Refill metformin", "due_at": "2026-11-01"}, headers=headers_a)
    assert created.status_code == 201
    rid = created.json()["id"]

    listing = client.get("/api/reminders", headers=headers_a)
    assert any(item["id"] == rid for item in listing.json())

    patched = client.patch(f"/api/reminders/{rid}", json={"done": True}, headers=headers_a)
    assert patched.status_code == 200
    assert patched.json()["done"] is True

    # Other user cannot touch it.
    forbidden = client.delete(f"/api/reminders/{rid}", headers=headers_b)
    assert forbidden.status_code == 404

    deleted = client.delete(f"/api/reminders/{rid}", headers=headers_a)
    assert deleted.status_code == 200


# --- httpOnly-cookie session -------------------------------------------------


def test_cookie_session_authenticates_without_header(client: TestClient):
    # Signup sets the session cookie; the shared TestClient stores and replays it.
    resp = client.post(
        "/api/auth/signup",
        json={"name": "Cookie User", "email": "cookie@example.com", "password": "SecretPassword123!"},
    )
    assert resp.status_code == 200
    assert client.cookies.get("access_token")

    profile = client.get("/api/profile")  # no Authorization header
    assert profile.status_code == 200
    assert profile.json()["email"] == "cookie@example.com"


# --- Messages collection + paginated endpoint --------------------------------


def test_messages_endpoint_returns_turns_and_is_owner_scoped(client: TestClient):
    headers_a = _signup(client, "msgsA@example.com")
    headers_b = _signup(client, "msgsB@example.com")
    conv_id = client.post("/api/chat", json={"message": "sharp knee pain"}, headers=headers_a).json()["conversation_id"]

    msgs = client.get(f"/api/history/{conv_id}/messages", headers=headers_a)
    assert msgs.status_code == 200
    turns = msgs.json()
    assert len(turns) == 2
    assert turns[0]["role"] == "user"
    assert turns[1]["role"] == "assistant"

    # History list no longer embeds messages.
    listing = client.get("/api/history", headers=headers_a)
    assert listing.json()[0].get("messages") is None

    forbidden = client.get(f"/api/history/{conv_id}/messages", headers=headers_b)
    assert forbidden.status_code == 404

    # Deleting the conversation also removes its stored turns.
    client.delete(f"/api/history/{conv_id}", headers=headers_a)
    remaining = client.get(f"/api/history/{conv_id}/messages", headers=headers_a)
    assert remaining.status_code == 404
