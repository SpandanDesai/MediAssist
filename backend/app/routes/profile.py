"""Profile routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.common import UserOut
from app.schemas.profile import ProfileUpdateRequest
from app.utils.serializers import serialize_user

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=UserOut)
async def get_profile(user: CurrentUser) -> UserOut:
    return serialize_user(user)


@router.put("/profile", response_model=UserOut)
async def update_profile(payload: ProfileUpdateRequest, user: CurrentUser) -> UserOut:
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if not updates:
        return serialize_user(user)
    updated = await database.update_one("users", {"_id": user["_id"]}, updates)
    return serialize_user(updated or user)
