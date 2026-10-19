"""Tests for ML Assessment endpoints (/api/ml/predict and /api/ml/predict-all).

Covers:
- Unauthenticated rejection (401)
- Validation failure (422) on invalid ranges or extra/missing fields
- Successful inference and response contract (predicted_category, label, disclaimer, probabilities)
- Graceful degradation when model artifact is missing (503)
"""

from __future__ import annotations

from unittest.mock import patch
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


async def _create_user(email: str = "test@example.com") -> tuple[dict, str]:
    user = await database.insert_one(
        "users",
        {
            "name": "Test User",
            "email": email,
            "password_hash": hash_password("SecretPassword123!"),
        },
    )
    token = create_access_token(str(user["_id"]))
    return user, token


def _valid_lifestyle_payload() -> dict:
    return {
        "Gender": "Female",
        "Age": 22.0,
        "family_history_with_overweight": "yes",
        "FAVC": "no",
        "FCVC": 2.0,
        "NCP": 3.0,
        "CAEC": "Sometimes",
        "SMOKE": "no",
        "CH2O": 2.0,
        "SCC": "no",
        "FAF": 1.0,
        "TUE": 1.0,
        "CALC": "no",
        "MTRANS": "Public_Transportation",
    }


def _valid_all_features_payload() -> dict:
    payload = _valid_lifestyle_payload()
    payload["Height"] = 1.65
    payload["Weight"] = 62.0
    return payload


@pytest.mark.anyio
async def test_ml_unauthenticated_rejected(client: TestClient):
    response = client.post("/api/ml/predict", json=_valid_lifestyle_payload())
    assert response.status_code == 401


@pytest.mark.anyio
async def test_ml_lifestyle_predict_success(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/ml/predict", json=_valid_lifestyle_payload(), headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert "predicted_category" in data
    assert "category_label" in data
    assert data["model"] == "obesity_lifestyle_only"
    assert "Experimental" in data["disclaimer"]
    assert isinstance(data["class_probabilities"], dict)
    assert len(data["class_probabilities"]) == 7
    assert isinstance(data["recommendations"], list)


@pytest.mark.anyio
async def test_ml_all_features_predict_success(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/ml/predict-all", json=_valid_all_features_payload(), headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["model"] == "obesity_all_features"
    assert data["predicted_category"] in [
        "Insufficient_Weight",
        "Normal_Weight",
        "Overweight_Level_I",
        "Overweight_Level_II",
        "Obesity_Type_I",
        "Obesity_Type_II",
        "Obesity_Type_III",
    ]


@pytest.mark.anyio
async def test_ml_validation_rejects_extra_fields(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    payload = _valid_lifestyle_payload()
    payload["arbitrary_injected_field"] = "malicious_payload"

    response = client.post("/api/ml/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_ml_validation_rejects_out_of_range(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    # Age must be between 10 and 120
    payload = _valid_lifestyle_payload()
    payload["Age"] = 4.0

    response = client.post("/api/ml/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_ml_validation_rejects_invalid_categorical(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    payload = _valid_lifestyle_payload()
    payload["MTRANS"] = "Spaceship"

    response = client.post("/api/ml/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_ml_graceful_503_when_model_missing(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.services.lifestyle_model.get_lifestyle_model", side_effect=FileNotFoundError("Missing")):
        response = client.post("/api/ml/predict", json=_valid_lifestyle_payload(), headers=headers)
        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()
