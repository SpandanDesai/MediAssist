"""Lifestyle health risk assessment routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas.chat import AssessmentRequest, AssessmentResult
from app.services.rules_engine import assess_lifestyle

router = APIRouter(tags=["assessment"])


@router.post("/assessment", response_model=AssessmentResult)
async def run_assessment(payload: AssessmentRequest, user: CurrentUser) -> AssessmentResult:
    _ = user
    return assess_lifestyle(payload)
