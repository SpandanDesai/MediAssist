"""Lightweight endpoint so the UI can show medication-safety guidance up front."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.deps import CurrentUser
from app.services.medication_guard import needs_medication_guard

router = APIRouter(tags=["medication"])


class MedicationCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class MedicationCheckResponse(BaseModel):
    requires_professional_guidance: bool


@router.post("/medication/check", response_model=MedicationCheckResponse)
async def medication_check(payload: MedicationCheckRequest, user: CurrentUser) -> MedicationCheckResponse:
    _ = user
    return MedicationCheckResponse(requires_professional_guidance=needs_medication_guard(payload.text))
