"""Tests for the experimental CDC diabetes route (/api/ml/diabetes/predict).

Covers:
- Unauthenticated rejection (401)
- Validation failure (422) on missing, extra, or out-of-range encoded fields
- Graceful degradation when the model artifact is missing (503)
- Successful inference and response contract, using a stub estimator so the
  suite stays deterministic and does not require the large joblib artifact or a
  specific scikit-learn build in CI.
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


async def _create_user(email: str = "dia@example.com") -> tuple[dict, str]:
    user = await database.insert_one(
        "users",
        {
            "name": "Dia User",
            "email": email,
            "password_hash": hash_password("SecretPassword123!"),
        },
    )
    token = create_access_token(str(user["_id"]))
    return user, token


def _valid_payload() -> dict:
    return {
        "HighBP": 1,
        "HighChol": 1,
        "CholCheck": 1,
        "BMI": 29,
        "Smoker": 0,
        "Stroke": 0,
        "HeartDiseaseorAttack": 0,
        "PhysActivity": 1,
        "Fruits": 1,
        "Veggies": 1,
        "HvyAlcoholConsump": 0,
        "AnyHealthcare": 1,
        "NoDocbcCost": 0,
        "GenHlth": 3,
        "MentHlth": 2,
        "PhysHlth": 3,
        "DiffWalk": 0,
        "Sex": 1,
        "Age": 7,
        "Education": 5,
        "Income": 6,
    }


class _StubModel:
    """Minimal estimator exposing predict_proba + classes_ for the service."""

    classes_ = [0, 1]

    def __init__(self, positive_probability: float = 0.7) -> None:
        self._positive = positive_probability

    def predict_proba(self, _frame):
        return [[round(1 - self._positive, 4), self._positive]]


@pytest.mark.anyio
async def test_diabetes_unauthenticated_rejected(client: TestClient):
    response = client.post("/api/ml/diabetes/predict", json=_valid_payload())
    assert response.status_code == 401


@pytest.mark.anyio
async def test_diabetes_predict_success_contract(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.services.diabetes_model.get_model", return_value=_StubModel(0.7)):
        response = client.post("/api/ml/diabetes/predict", json=_valid_payload(), headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "cdc_diabetes_random_forest"
    # 0.7 >= 0.5 threshold => positive survey label (1).
    assert data["prediction"] == 1
    assert data["decision_threshold"] == 0.5
    assert data["model_score"] == pytest.approx(0.7)
    assert "diabetes" in data["label"].lower()
    assert "Experimental" in data["notice"]
    assert "not a medical diagnosis" in data["notice"].lower()


@pytest.mark.anyio
async def test_diabetes_predict_below_threshold_is_negative(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.services.diabetes_model.get_model", return_value=_StubModel(0.2)):
        response = client.post("/api/ml/diabetes/predict", json=_valid_payload(), headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 0
    assert "no diabetes" in data["label"].lower()


@pytest.mark.anyio
async def test_diabetes_validation_rejects_missing_field(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    payload = _valid_payload()
    payload.pop("BMI")

    response = client.post("/api/ml/diabetes/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_diabetes_validation_rejects_extra_field(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    payload = _valid_payload()
    payload["arbitrary_injected_field"] = 1

    response = client.post("/api/ml/diabetes/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_diabetes_validation_rejects_out_of_range(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    # Age band is 1-13; 14 must be rejected before inference runs.
    payload = _valid_payload()
    payload["Age"] = 14

    response = client.post("/api/ml/diabetes/predict", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_diabetes_graceful_503_when_model_missing(client: TestClient):
    _, token = await _create_user()
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.diabetes_model.get_model",
        side_effect=FileNotFoundError("Missing"),
    ):
        response = client.post("/api/ml/diabetes/predict", json=_valid_payload(), headers=headers)

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()
