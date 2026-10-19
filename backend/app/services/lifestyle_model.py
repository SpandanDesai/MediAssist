"""ML inference service for UCI Obesity and lifestyle risk assessment."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
import joblib
import pandas as pd

from app.schemas.ml_assessment import (
    ObesityAllFeaturesInput,
    ObesityLifestyleInput,
    ObesityPredictionResult,
)

logger = logging.getLogger("mediassist.ml")

ML_DIR = Path(__file__).resolve().parents[1] / "ml"
LIFESTYLE_MODEL_PATH = ML_DIR / "obesity_lifestyle_only.joblib"
ALL_FEATURES_MODEL_PATH = ML_DIR / "obesity_all_features.joblib"

_lifestyle_model: Any = None
_all_features_model: Any = None

CATEGORY_FRIENDLY_NAMES: dict[str, str] = {
    "Insufficient_Weight": "Underweight / Insufficient Weight",
    "Normal_Weight": "Normal Weight",
    "Overweight_Level_I": "Overweight (Level I)",
    "Overweight_Level_II": "Overweight (Level II)",
    "Obesity_Type_I": "Obesity (Class I)",
    "Obesity_Type_II": "Obesity (Class II)",
    "Obesity_Type_III": "Obesity (Class III)",
}

DISCLAIMER_TEXT: str = (
    "Experimental machine learning classification based on the UCI Obesity dataset. "
    "This output is for educational and self-reflection purposes only and is NOT a "
    "medical diagnosis, clinical risk estimate, or individual prognosis."
)


def get_lifestyle_model():
    global _lifestyle_model
    if _lifestyle_model is None:
        if not LIFESTYLE_MODEL_PATH.exists():
            raise FileNotFoundError(f"Lifestyle model artifact not found at {LIFESTYLE_MODEL_PATH}")
        logger.info("Loading lifestyle ML pipeline from %s", LIFESTYLE_MODEL_PATH)
        _lifestyle_model = joblib.load(LIFESTYLE_MODEL_PATH)
    return _lifestyle_model


def get_all_features_model():
    global _all_features_model
    if _all_features_model is None:
        if not ALL_FEATURES_MODEL_PATH.exists():
            raise FileNotFoundError(f"All features model artifact not found at {ALL_FEATURES_MODEL_PATH}")
        logger.info("Loading all features ML pipeline from %s", ALL_FEATURES_MODEL_PATH)
        _all_features_model = joblib.load(ALL_FEATURES_MODEL_PATH)
    return _all_features_model


def _generate_educational_insights(features: ObesityLifestyleInput, predicted_category: str) -> list[str]:
    """Generates non-diagnostic, lifestyle habit observations."""
    insights: list[str] = []

    if features.FAF < 1.0:
        insights.append("Increasing physical activity to at least 150 minutes of moderate activity weekly is recommended by health guidelines.")
    elif features.FAF >= 2.0:
        insights.append("Great job maintaining regular physical activity several days a week.")

    if features.CH2O < 2.0:
        insights.append("Drinking at least 2 liters of water daily helps optimize hydration and metabolic function.")

    if features.FCVC < 2.0:
        insights.append("Try incorporating fresh vegetables or legumes into at least two daily meals.")

    if features.FAVC == "yes":
        insights.append("High-calorie processed foods are frequent in your diet; swapping with whole-food options can improve nutritional balance.")

    if features.TUE >= 1.5:
        insights.append("High daily screen/sedentary time noted; consider adding brief movement breaks every hour.")

    if features.CAEC in ("Frequently", "Always"):
        insights.append("Frequent between-meal snacking detected; portion-controlling snacks or prioritizing fiber and protein can help curb cravings.")

    if not insights:
        insights.append("Your lifestyle responses reflect several positive daily health habits.")

    return insights


def predict_lifestyle_category(
    features: ObesityLifestyleInput | dict[str, Any],
) -> ObesityPredictionResult:
    """Run inference using the lifestyle-only model (14 features)."""
    if isinstance(features, dict):
        validated = ObesityLifestyleInput(**features)
    else:
        validated = features

    model = get_lifestyle_model()
    frame = pd.DataFrame([validated.model_dump()])

    prediction = str(model.predict(frame)[0])
    probabilities = None

    if hasattr(model, "predict_proba"):
        raw_probs = model.predict_proba(frame)[0]
        classes = getattr(model, "classes_", [])
        if len(classes) == len(raw_probs):
            probabilities = {str(c): round(float(p), 4) for c, p in zip(classes, raw_probs)}

    return ObesityPredictionResult(
        predicted_category=prediction,
        category_label=CATEGORY_FRIENDLY_NAMES.get(prediction, prediction),
        model="obesity_lifestyle_only",
        class_probabilities=probabilities,
        disclaimer=DISCLAIMER_TEXT,
        recommendations=_generate_educational_insights(validated, prediction),
    )


def predict_all_features_category(
    features: ObesityAllFeaturesInput | dict[str, Any],
) -> ObesityPredictionResult:
    """Run inference using the all-features model (16 features, including Height & Weight)."""
    if isinstance(features, dict):
        validated = ObesityAllFeaturesInput(**features)
    else:
        validated = features

    model = get_all_features_model()
    frame = pd.DataFrame([validated.model_dump()])

    prediction = str(model.predict(frame)[0])
    probabilities = None

    if hasattr(model, "predict_proba"):
        raw_probs = model.predict_proba(frame)[0]
        classes = getattr(model, "classes_", [])
        if len(classes) == len(raw_probs):
            probabilities = {str(c): round(float(p), 4) for c, p in zip(classes, raw_probs)}

    return ObesityPredictionResult(
        predicted_category=prediction,
        category_label=CATEGORY_FRIENDLY_NAMES.get(prediction, prediction),
        model="obesity_all_features",
        class_probabilities=probabilities,
        disclaimer=DISCLAIMER_TEXT,
        recommendations=_generate_educational_insights(validated, prediction),
    )
