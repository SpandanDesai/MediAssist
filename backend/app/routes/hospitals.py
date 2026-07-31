"""Nearby hospital finder routes."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.deps import CurrentUser
from app.schemas.hospitals import HospitalListResponse
from app.services.hospitals import find_nearby_hospitals
from app.services.rate_limit import client_key, consultation_limiter

router = APIRouter(tags=["hospitals"])


@router.get("/hospitals", response_model=HospitalListResponse)
async def nearby_hospitals(
    request: Request,
    user: CurrentUser,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(default=5000, ge=500, le=30000),
) -> HospitalListResponse:
    consultation_limiter.check(client_key(request, str(user["_id"])))
    return await find_nearby_hospitals(lat, lng, radius)
