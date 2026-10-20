"""Tests for the personal vitals tracker: auth, ownership isolation, validation,
recorded_at normalisation, and account-erasure coverage. Runs on the in-memory
store with no external services.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import database
from app.main import app


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
            "token_version": 1,
        },
    )
    token = create_access_token(str(user["_id"]), token_version=1)
    return user, token


# --------------------------------------------------------------------------- #
# Auth + happy path
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_vitals_endpoints_require_auth(client: TestClient):
    assert client.get("/api/vitals").status_code == 401
    assert client.post("/api/vitals", json={"kind": "weight_kg", "value": 70}).status_code == 401
    assert client.delete("/api/vitals/does-not-exist").status_code == 401


@pytest.mark.anyio
async def test_create_and_list_vitals(client: TestClient):
    user, token = await _create_user("v1@example.com", "Vita")
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/vitals",
        json={"kind": "weight_kg", "value": 72.5, "recorded_at": "2026-01-05", "note": "morning"},
        headers=headers,
    )
    assert create.status_code == 201
    body = create.json()
    assert body["kind"] == "weight_kg"
    assert body["unit"] == "kg"
    assert body["value"] == pytest.approx(72.5)
    assert body["note"] == "morning"
    # ISO date normalised to an aware ISO datetime string.
    assert body["recorded_at"].startswith("2026-01-05")

    listing = client.get("/api/vitals", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1


@pytest.mark.anyio
async def test_list_sorted_newest_first_and_filterable(client: TestClient):
    user, token = await _create_user("v2@example.com", "Sorter")
    headers = {"Authorization": f"Bearer {token}"}

    for kind, value, day in [
        ("weight_kg", 70.0, "2026-01-01"),
        ("weight_kg", 69.0, "2026-01-10"),
        ("resting_hr", 61.0, "2026-01-03"),
    ]:
        client.post("/api/vitals", json={"kind": kind, "value": value, "recorded_at": day}, headers=headers)

    everything = client.get("/api/vitals", headers=headers).json()
    # Newest first across all kinds.
    assert everything[0]["recorded_at"].startswith("2026-01-10")
    assert len(everything) == 3

    weights = client.get("/api/vitals", params={"kind": "weight_kg"}, headers=headers).json()
    assert {row["kind"] for row in weights} == {"weight_kg"}
    assert len(weights) == 2


@pytest.mark.anyio
async def test_recorded_at_defaults_to_now_when_absent(client: TestClient):
    user, token = await _create_user("v3@example.com", "Now")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/vitals", json={"kind": "bmi", "value": 24.1}, headers=headers)
    assert created.status_code == 201
    assert created.json()["recorded_at"] != ""
    assert created.json()["unit"] == "kg/m\u00b2"


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_rejects_unknown_kind(client: TestClient):
    user, token = await _create_user("v4@example.com", "BadKind")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/vitals", json={"kind": "mood", "value": 5}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_rejects_non_positive_value(client: TestClient):
    user, token = await _create_user("v5@example.com", "Zero")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/vitals", json={"kind": "weight_kg", "value": 0}, headers=headers)
    assert resp.status_code == 422


# --------------------------------------------------------------------------- #
# Ownership isolation + deletion
# --------------------------------------------------------------------------- #

@pytest.mark.anyio
async def test_vitals_ownership_isolation(client: TestClient):
    user_a, token_a = await _create_user("va@example.com", "User A")
    _user_b, token_b = await _create_user("vb@example.com", "User B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    created = client.post("/api/vitals", json={"kind": "glucose_mgdl", "value": 95}, headers=headers_a)
    vital_id = created.json()["id"]

    # User B cannot see User A's reading.
    assert client.get("/api/vitals", headers=headers_b).json() == []

    # User B cannot delete User A's reading; the record survives.
    assert client.delete(f"/api/vitals/{vital_id}", headers=headers_b).status_code == 404
    assert await database.find_one("vitals", {"_id": vital_id}) is not None

    # User A can delete their own.
    assert client.delete(f"/api/vitals/{vital_id}", headers=headers_a).status_code == 200
    assert await database.find_one("vitals", {"_id": vital_id}) is None


@pytest.mark.anyio
async def test_account_deletion_removes_vitals(client: TestClient):
    user, token = await _create_user("vd@example.com", "Deleter")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/vitals", json={"kind": "weight_kg", "value": 71}, headers=headers)

    assert client.delete("/api/profile", headers=headers).status_code == 200
    remaining = await database.find_many("vitals", {"user_id": str(user["_id"])})
    assert remaining == []
