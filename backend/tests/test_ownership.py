"""Route-level tests verifying authentication and strict user ownership isolation.

Ensures User A cannot access, delete, download, or tamper with User B's conversations,
reports, images, or profile.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import database
from app.main import app


@pytest.fixture(autouse=True)
def clean_database():
    """Reset the database in-memory store before each test."""
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
            "hashed_password": hash_password("SecretPassword123!"),
            "allergies": "Peanuts",
            "medical_history": "Mild asthma",
        },
    )
    token = create_access_token(str(user["_id"]))
    return user, token


@pytest.mark.anyio
async def test_unauthenticated_request_rejected(client: TestClient):
    response = client.get("/api/profile")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_conversation_ownership_isolation(client: TestClient):
    user_a, token_a = await _create_user("user_a@example.com", "User A")
    user_b, token_b = await _create_user("user_b@example.com", "User B")

    # Create a conversation belonging to User A
    conv_a = await database.insert_one(
        "conversations",
        {
            "user_id": str(user_a["_id"]),
            "title": "Confidential consultation A",
            "preview": "Personal health discussion",
            "messages": [
                {"id": "msg-1", "role": "user", "content": "My private symptoms"},
                {"id": "msg-2", "role": "assistant", "content": "Medical guidance for User A"},
            ],
        },
    )

    # 1. User B lists history -> should NOT see User A's conversation
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_b = client.get("/api/history", headers=headers_b)
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0

    # 2. User A lists history -> should see their conversation
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_a = client.get("/api/history", headers=headers_a)
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_a.json()[0]["id"] == str(conv_a["_id"])

    # 3. User B tries to delete User A's conversation -> 404 Not Found
    del_res = client.delete(f"/api/history/{conv_a['_id']}", headers=headers_b)
    assert del_res.status_code == 404

    # Verify conversation still exists in database
    existing = await database.find_one("conversations", {"_id": str(conv_a["_id"])})
    assert existing is not None


@pytest.mark.anyio
async def test_report_ownership_isolation(client: TestClient):
    user_a, token_a = await _create_user("user_a@example.com", "User A")
    user_b, token_b = await _create_user("user_b@example.com", "User B")

    # User A creates a report
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_res = client.post(
        "/api/reports",
        json={"symptoms": "High fever and persistent cough", "title": "User A Report"},
        headers=headers_a,
    )
    assert create_res.status_code == 200
    report_id = create_res.headers.get("X-Report-Id")
    assert report_id is not None

    # User B lists reports -> should be empty
    headers_b = {"Authorization": f"Bearer {token_b}"}
    list_b = client.get("/api/reports", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # User B tries to download User A's report -> 404 Not Found
    download_b = client.get(f"/api/reports/{report_id}/download", headers=headers_b)
    assert download_b.status_code == 404

    # User A can download their own report
    download_a = client.get(f"/api/reports/{report_id}/download", headers=headers_a)
    assert download_a.status_code == 200
    assert download_a.headers["content-type"] == "application/pdf"


@pytest.mark.anyio
async def test_profile_update_and_clearing(client: TestClient):
    user_a, token_a = await _create_user("user_a@example.com", "User A")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Verify initial profile
    res = client.get("/api/profile", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["allergies"] == "Peanuts"

    # Clear allergies by explicitly sending empty/null
    update_res = client.put("/api/profile", json={"allergies": ""}, headers=headers_a)
    assert update_res.status_code == 200
    assert update_res.json()["allergies"] is None


@pytest.mark.anyio
async def test_token_revocation_on_logout(client: TestClient):
    user, token = await _create_user("logout_user@example.com", "Logout User")
    headers = {"Authorization": f"Bearer {token}"}

    # Profile check works before logout
    res_before = client.get("/api/profile", headers=headers)
    assert res_before.status_code == 200

    # User calls logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # Token is now revoked because token_version was incremented
    res_after = client.get("/api/profile", headers=headers)
    assert res_after.status_code == 401
    assert "revoked" in res_after.json()["detail"].lower()


@pytest.mark.anyio
async def test_account_deletion_cleans_all_records(client: TestClient):
    user, token = await _create_user("delete_me@example.com", "Delete Me")
    user_id = str(user["_id"])
    headers = {"Authorization": f"Bearer {token}"}

    # Add a conversation and a report
    await database.insert_one("conversations", {"user_id": user_id, "title": "My chat"})
    await database.insert_one("reports", {"user_id": user_id, "title": "My report"})
    await database.insert_one("images", {"user_id": user_id, "filename": "skin.jpg"})

    # Permanently delete account
    del_res = client.delete("/api/profile", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # User record is gone
    user_in_db = await database.find_one("users", {"_id": user["_id"]})
    assert user_in_db is None

    # All related records are gone
    convs = await database.find_many("conversations", {"user_id": user_id})
    reports = await database.find_many("reports", {"user_id": user_id})
    images = await database.find_many("images", {"user_id": user_id})
    assert len(convs) == 0
    assert len(reports) == 0
    assert len(images) == 0
