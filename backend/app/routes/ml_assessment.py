"""ML assessment and obesity classification routes."""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser
from app.schemas.ml_assessment import (
    ObesityAllFeaturesInput,
    ObesityLifestyleInput,
    ObesityPredictionResult,
)
from app.services.lifestyle_model import (
    predict_all_features_category,
    predict_lifestyle_category,
)

logger = logging.getLogger("mediassist.ml_routes")

router = APIRouter(prefix="/ml", tags=["ML Assessment"])


@router.post(
    "/predict",
    response_model=ObesityPredictionResult,
    summary="Predict weight category from lifestyle features alone (14 features)",
)
async def predict_lifestyle(
    payload: ObesityLifestyleInput,
    user: CurrentUser,
) -> ObesityPredictionResult:
    """Classifies lifestyle indicators against the trained UCI dataset model.

    Height and Weight are deliberately excluded from this endpoint so the user
    can see what category their lifestyle habits alone align with.
    """
    try:
        return predict_lifestyle_category(payload)
    except FileNotFoundError as exc:
        logger.error("Model file missing: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model is currently unavailable on the server.",
        ) from exc
    except Exception as exc:
        logger.exception("Inference failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inference error: {exc}",
        ) from exc


@router.post(
    "/predict-all",
    response_model=ObesityPredictionResult,
    summary="Predict weight category from all features (16 features, including Height & Weight)",
)
async def predict_all(
    payload: ObesityAllFeaturesInput,
    user: CurrentUser,
) -> ObesityPredictionResult:
    """Classifies all features against the benchmark UCI dataset model."""
    try:
        return predict_all_features_category(payload)
    except FileNotFoundError as exc:
        logger.error("Model file missing: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model is currently unavailable on the server.",
        ) from exc
    except Exception as exc:
        logger.exception("Inference failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inference error: {exc}",
        ) from exc
