"""Experimental CDC diabetes survey-label classification route."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.deps import CurrentUser
from app.schemas.ml_diabetes import DiabetesInput, DiabetesPredictionResult
from app.services.diabetes_model import predict_diabetes_survey_label

logger = logging.getLogger("mediassist.ml_routes.diabetes")

router = APIRouter(prefix="/ml/diabetes", tags=["Diabetes ML"])


@router.post(
    "/predict",
    response_model=DiabetesPredictionResult,
    summary="Experimental CDC diabetes survey-label prediction (21 encoded features)",
)
async def predict_diabetes(
    payload: DiabetesInput,
    user: CurrentUser,
) -> DiabetesPredictionResult:
    """Classify the dataset's binary survey label from fully specified inputs.

    The RandomForest inference is CPU-bound, so it is offloaded to a worker
    thread to keep the event loop responsive. ``DiabetesInput`` forbids extra
    keys and enforces the dataset encodings; anything malformed is rejected
    before inference runs.
    """
    try:
        return await run_in_threadpool(predict_diabetes_survey_label, payload)
    except FileNotFoundError as exc:
        logger.error("Diabetes model file missing: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model is currently unavailable on the server.",
        ) from exc
    except (ValueError, TypeError) as exc:
        logger.warning("Invalid inference input: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid or incomplete model input.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 - surface as a controlled inference error
        logger.exception("Diabetes inference failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inference error: {exc}",
        ) from exc
