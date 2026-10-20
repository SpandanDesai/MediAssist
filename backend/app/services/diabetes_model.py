"""ML inference service for the experimental CDC diabetes survey classifier.

Loads the trained ``cdc_diabetes_rf.joblib`` RandomForest lazily (so a missing
artifact never breaks ``import app.main`` or the wider test suite) and returns a
prediction of the dataset's *binary survey label* — NOT a clinical diabetes
diagnosis or validated risk estimate.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.schemas.ml_diabetes import DiabetesInput, DiabetesPredictionResult

logger = logging.getLogger("mediassist.ml.diabetes")

# Expected layout: backend/app/services/diabetes_model.py
APP_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = APP_DIR / "ml" / "diabetes"
MODEL_PATH = MODEL_DIR / "cdc_diabetes_rf.joblib"
METADATA_PATH = MODEL_DIR / "diabetes_metadata.json"

NOTICE_TEXT: str = (
    "Experimental prediction based on the US CDC Diabetes Health Indicators survey. "
    "It estimates which survey label a respondent with these answers might receive; it "
    "does NOT determine whether you currently have diabetes or prediabetes. This is not a "
    "medical diagnosis, screening result, or validated clinical probability. Diabetes "
    "diagnosis requires appropriate clinical assessment and testing by a qualified "
    "healthcare professional."
)

_model: Any = None
_metadata: dict[str, Any] | None = None


def get_metadata() -> dict[str, Any]:
    """Load and cache the model's metadata (feature order, labels, threshold)."""
    global _metadata
    if _metadata is None:
        if not METADATA_PATH.exists():
            raise FileNotFoundError(f"Diabetes metadata not found at {METADATA_PATH}")
        with METADATA_PATH.open("r", encoding="utf-8") as file:
            _metadata = json.load(file)
    return _metadata


def get_model() -> Any:
    """Load and cache the trained RandomForest, raising if the artifact is absent."""
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Diabetes model artifact not found at {MODEL_PATH}")
        logger.info("Loading diabetes ML model from %s", MODEL_PATH)
        _model = joblib.load(MODEL_PATH)
    return _model


def predict_diabetes_survey_label(
    features: DiabetesInput | dict[str, Any],
) -> DiabetesPredictionResult:
    """Run inference for the binary survey-label classifier (21 encoded features)."""
    validated = DiabetesInput(**features) if isinstance(features, dict) else features

    model = get_model()
    metadata = get_metadata()
    feature_order: list[str] = list(metadata["features"])
    threshold = float(metadata.get("decision_threshold", 0.5))

    # Enforce the exact training column order; RandomForest consumes numerics only.
    frame = pd.DataFrame([validated.model_dump()])[feature_order]

    model_name = str(metadata.get("model_name", "cdc_diabetes_random_forest"))
    target_labels: dict[str, str] = dict(metadata.get("target_labels", {}) or {})

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(frame)[0]
        classes = [int(c) for c in getattr(model, "classes_", range(len(probabilities)))]
        class_to_prob = {cls: float(prob) for cls, prob in zip(classes, probabilities)}
        positive_score = class_to_prob.get(1, 0.0)
        prediction = 1 if positive_score >= threshold else 0
    else:
        prediction = int(model.predict(frame)[0])
        positive_score = float(prediction)

    label = str(target_labels.get(str(prediction), f"Class {prediction}"))

    return DiabetesPredictionResult(
        model=model_name,
        prediction=prediction,
        label=label,
        decision_threshold=threshold,
        model_score=round(positive_score, 4),
        notice=NOTICE_TEXT,
    )
