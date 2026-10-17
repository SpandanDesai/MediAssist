"""Profile routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.common import UserOut
from app.schemas.profile import ProfileUpdateRequest
from app.utils.serializers import serialize_user

router = APIRouter(tags=["profile"])

# Fields a user may clear to empty/null. Name is required and cannot be blanked.
_NULLABLE_FIELDS = {
    "age",
    "gender",
    "blood_group",
    "allergies",
    "medical_history",
    "chronic_diseases",
    "current_medications",
    "emergency_contact",
}


@router.get("/profile", response_model=UserOut)
async def get_profile(user: CurrentUser) -> UserOut:
    return serialize_user(user)


@router.put("/profile", response_model=UserOut)
async def update_profile(payload: ProfileUpdateRequest, user: CurrentUser) -> UserOut:
    # exclude_unset keeps explicit nulls so users can clear optional fields.
    sent = payload.model_dump(exclude_unset=True)
    updates: dict = {}
    for key, value in sent.items():
        if key == "name":
            if value:  # name is required; ignore blank submissions
                updates["name"] = value
        elif key in _NULLABLE_FIELDS:
            updates[key] = value if value not in ("", None) else None
    if not updates:
        return serialize_user(user)
    updated = await database.update_one("users", {"_id": user["_id"]}, updates)
    return serialize_user(updated or user)
