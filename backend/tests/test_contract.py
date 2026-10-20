"""Contract and hardening tests for the operational surface added in this pass.

Two goals:

1. OpenAPI contract â€” every (verb, path) the frontend calls in
   ``frontend/src/lib/api.ts`` must be present in the generated schema, so a
   backend rename/removal fails loudly here rather than silently in the browser.
2. Behaviour hardening â€” the new endpoints and resilience primitives actually
   work: message pagination headers, ``/reminders/upcoming`` date filtering,
   share-link revocation, the PHI-free ``/metrics`` snapshot, CORS preflight for
   PATCH, and the memory store's range operators.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import database
from app.main import app
from app.services import metrics as metrics_service


@pytest.fixture(autouse=True)
def clean_database():
    database._memory.clear()
    database.database = None
    database.using_memory = True
    yield
    database._memory.clear()


@pytest.fixture
def client():
    return TestClient(app)


async def _create_user(email: str, name: str) -> tuple[dict, str]:
    user = await database.insert_one(
        "users",
        {
            "name": name,
            "email": email,
            "password_hash": hash_password("SecretPassword123!"),
        },
    )
    return user, create_access_token(str(user["_id"]))


# --------------------------------------------------------------------------- #
# OpenAPI contract                                                            #
# --------------------------------------------------------------------------- #

# (method, path) pairs the browser client relies on. Path parameters use the
# FastAPI template names so they match the OpenAPI ``paths`` keys exactly.
FRONTEND_CONTRACT: list[tuple[str, str]] = [
    ("post", "/api/auth/login"),
    ("post", "/api/auth/signup"),
    ("post", "/api/auth/logout"),
    ("get", "/api/profile"),
    ("put", "/api/profile"),
    ("delete", "/api/profile"),
    ("get", "/api/profile/export"),
    ("post", "/api/chat"),
    ("post", "/api/medication/check"),
    ("post", "/api/medication/review"),
    ("get", "/api/history"),
    ("delete", "/api/history/{conversation_id}"),
    ("patch", "/api/history/{conversation_id}"),
    ("get", "/api/history/{conversation_id}/messages"),
    ("post", "/api/image"),
    ("post", "/api/voice"),
    ("get", "/api/hospitals"),
    ("post", "/api/reports"),
    ("get", "/api/reports"),
    ("get", "/api/reports/{report_id}/download"),
    ("post", "/api/reports/{report_id}/share"),
    ("get", "/api/reports/{report_id}/shares"),
    ("delete", "/api/reports/{report_id}/share/{jti}"),
    ("get", "/api/share/{token}/download"),
    ("post", "/api/assessment"),
    ("get", "/api/assessment/history"),
    ("get", "/api/stats"),
    ("get", "/api/reminders"),
    ("get", "/api/reminders/upcoming"),
    ("post", "/api/reminders"),
    ("patch", "/api/reminders/{reminder_id}"),
    ("delete", "/api/reminders/{reminder_id}"),
    ("get", "/api/metrics"),
    ("get", "/api/vitals"),
    ("post", "/api/vitals"),
    ("delete", "/api/vitals/{vital_id}"),
    ("post", "/api/ml/predict"),
    ("post", "/api/ml/predict-all"),
    ("post", "/api/ml/diabetes/predict"),
]


def test_openapi_exposes_every_frontend_operation():
    schema = app.openapi()
    paths = schema.get("paths", {})
    missing = [
        f"{method.upper()} {path}"
        for method, path in FRONTEND_CONTRACT
        if path not in paths or method not in paths[path]
    ]
    assert not missing, "Frontend calls operations missing from OpenAPI: " + ", ".join(missing)


# --------------------------------------------------------------------------- #
# CORS                                                                        #
# --------------------------------------------------------------------------- #

def test_cors_preflight_allows_patch_and_request_id(client: TestClient):
    response = client.options(
        "/api/reminders/does-not-matter",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "X-Request-ID",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-credentials") == "true"
    allow_methods = response.headers.get("access-control-allow-methods", "")
    assert "PATCH" in allow_methods
    allow_headers = response.headers.get("access-control-allow-headers", "").lower()
    assert "x-request-id" in allow_headers


def test_request_id_echoed_on_response(client: TestClient):
    response = client.get("/api/health", headers={"X-Request-ID": "trace-abc-123"})
    assert response.headers.get("X-Request-ID") == "trace-abc-123"


def test_security_headers_present(client: TestClient):
    """Defense-in-depth headers attach to every response (dev mode: no HSTS)."""
    response = client.get("/api/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert "camera=()" in response.headers.get("Permissions-Policy", "")
    # HSTS is only emitted when running in production (TLS-terminating).
    assert "Strict-Transport-Security" not in response.headers


# --------------------------------------------------------------------------- #
# Metrics                                                                     #
# --------------------------------------------------------------------------- #

def test_metrics_snapshot_is_phi_free(client: TestClient):
    metrics_service.reset()
    metrics_service.increment("http_requests_total", 3)
    response = client.get("/api/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["storage"] == "memory"
    # Only aggregate counters â€” never names/emails/health content.
    assert "http_requests_total" in body["counters"]
    dumped = str(body).lower()
    for leak in ("email", "password", "symptom", "authorization"):
        assert leak not in dumped


# --------------------------------------------------------------------------- #
# Messages pagination                                                         #
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_messages_pagination_headers(client: TestClient):
    user, token = await _create_user("pager@example.com", "Pager")
    user_id = str(user["_id"])
    headers = {"Authorization": f"Bearer {token}"}
    conv = await database.insert_one(
        "conversations", {"user_id": user_id, "title": "Thread", "message_count": 5}
    )
    conv_id = str(conv["_id"])
    for seq in range(1, 6):
        await database.insert_one(
            "messages",
            {
                "conversation_id": conv_id,
                "user_id": user_id,
                "id": f"m{seq}",
                "role": "user",
                "content": f"turn {seq}",
                "seq": seq,
            },
        )

    first = client.get(
        f"/api/history/{conv_id}/messages", params={"limit": 2}, headers=headers
    )
    assert first.status_code == 200
    body = first.json()
    # Newest two, returned chronologically.
    assert [m["content"] for m in body] == ["turn 4", "turn 5"]
    assert first.headers["X-Has-More"] == "true"
    assert first.headers["X-Oldest-Seq"] == "4"

    second = client.get(
        f"/api/history/{conv_id}/messages",
        params={"limit": 2, "before_seq": 4},
        headers=headers,
    )
    assert [m["content"] for m in second.json()] == ["turn 2", "turn 3"]
    assert second.headers["X-Oldest-Seq"] == "2"

    third = client.get(
        f"/api/history/{conv_id}/messages",
        params={"limit": 2, "before_seq": 2},
        headers=headers,
    )
    assert [m["content"] for m in third.json()] == ["turn 1"]
    assert third.headers["X-Has-More"] == "false"


# --------------------------------------------------------------------------- #
# Reminders upcoming                                                          #
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_reminders_upcoming_filters_and_normalises(client: TestClient):
    user, token = await _create_user("reminders@example.com", "Reminder")
    headers = {"Authorization": f"Bearer {token}"}

    def _due_in(days: int) -> str:
        from datetime import UTC, datetime, timedelta

        return (datetime.now(UTC) + timedelta(days=days)).isoformat()

    # Due tomorrow, overdue, next month, done, and unparseable due date.
    client.post("/api/reminders", json={"title": "Soon", "due_at": _due_in(1)}, headers=headers)
    client.post("/api/reminders", json={"title": "Overdue", "due_at": _due_in(-2)}, headers=headers)
    client.post("/api/reminders", json={"title": "Far", "due_at": _due_in(40)}, headers=headers)
    done = client.post("/api/reminders", json={"title": "Done", "due_at": _due_in(1)}, headers=headers).json()
    client.post("/api/reminders", json={"title": "No date"}, headers=headers)
    client.post("/api/reminders", json={"title": "Bad date", "due_at": "not-a-date"}, headers=headers)
    client.patch(f"/api/reminders/{done['id']}", json={"done": True}, headers=headers)

    upcoming = client.get("/api/reminders/upcoming", params={"days": 7}, headers=headers).json()
    titles = {item["title"] for item in upcoming}
    assert titles == {"Soon", "Overdue"}  # far/done/undated/malformed excluded


# --------------------------------------------------------------------------- #
# Share-link revocation                                                       #
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_share_link_issue_list_revoke(client: TestClient):
    user, token = await _create_user("share@example.com", "Sharer")
    headers = {"Authorization": f"Bearer {token}"}

    report_res = client.post(
        "/api/reports",
        json={"symptoms": "Persistent headache", "title": "Shareable"},
        headers=headers,
    )
    assert report_res.status_code == 200
    report_id = report_res.headers["X-Report-Id"]

    share = client.post(f"/api/reports/{report_id}/share", headers=headers)
    assert share.status_code == 200
    payload = share.json()
    raw_token = payload["token"]
    jti = payload["jti"]
    assert jti

    # The listing never leaks the raw token.
    listing = client.get(f"/api/reports/{report_id}/shares", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["jti"] == jti
    assert raw_token not in str(listing)

    download_url = f"/api/share/{raw_token}/download"
    assert client.get(download_url).status_code == 200

    revoke = client.delete(f"/api/reports/{report_id}/share/{jti}", headers=headers)
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "revoked"

    # After revocation the same link is refused.
    assert client.get(download_url).status_code == 403

    # A second listing reflects the revoked flag.
    after = client.get(f"/api/reports/{report_id}/shares", headers=headers).json()
    assert after[0]["revoked"] is True


# --------------------------------------------------------------------------- #
# Memory store range operators                                                #
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_memory_store_supports_range_operators():
    for value in (1, 5, 10, 15):
        await database.insert_one("range_test", {"n": value})
    lower = await database.find_many("range_test", {"n": {"$gte": 10}})
    assert sorted(row["n"] for row in lower) == [10, 15]
    window = await database.find_many("range_test", {"n": {"$gt": 1, "$lt": 15}})
    assert sorted(row["n"] for row in window) == [5, 10]
