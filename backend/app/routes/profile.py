"""Profile routes."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.common import UserOut
from app.schemas.profile import ProfileUpdateRequest
from app.services.conversations import get_messages
from app.utils.serializers import serialize_conversation, serialize_message, serialize_user, str_list_unique

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

# Structured ledgers stored as de-duplicated lists of non-empty strings.
_LIST_FIELDS = {"allergy_list", "medication_list"}


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
        elif key in _LIST_FIELDS:
            updates[key] = str_list_unique(value)
        elif key in _NULLABLE_FIELDS:
            updates[key] = value if value not in ("", None) else None
    if not updates:
        return serialize_user(user)
    updated = await database.update_one("users", {"_id": user["_id"]}, updates)
    return serialize_user(updated or user)


@router.delete("/profile")
async def delete_account(user: CurrentUser) -> dict[str, str]:
    """Permanently delete user account and all associated health data."""
    user_id = str(user["_id"])
    # Delete conversations, their messages, reports, images, assessments, and user account
    await database.delete_many("messages", {"user_id": user_id})
    await database.delete_many("conversations", {"user_id": user_id})
    await database.delete_many("reports", {"user_id": user_id})
    await database.delete_many("report_shares", {"user_id": user_id})
    await database.delete_many("images", {"user_id": user_id})
    await database.delete_many("assessments", {"user_id": user_id})
    await database.delete_many("reminders", {"user_id": user_id})
    await database.delete_one("users", {"_id": user["_id"]})
    return {"status": "deleted", "message": "Account and all associated health data have been permanently deleted."}


@router.get("/profile/export")
async def export_data(user: CurrentUser) -> dict:
    """Return the account holder's complete health data as portable JSON.

    Supports data-portability/erasure requests. Never includes the password hash;
    stored images are surfaced as analysis metadata only (raw bytes are not kept).
    """
    user_id = str(user["_id"])
    conversations = await database.find_many(
        "conversations", {"user_id": user_id}, sort=[("updated_at", -1)], limit=500
    )
    reports = await database.find_many("reports", {"user_id": user_id}, sort=[("created_at", -1)], limit=500)
    assessments = await database.find_many(
        "assessments", {"user_id": user_id}, sort=[("created_at", -1)], limit=500
    )
    images = await database.find_many("images", {"user_id": user_id}, sort=[("created_at", -1)], limit=500)
    reminders = await database.find_many("reminders", {"user_id": user_id}, limit=500)

    def _iso(value: object) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value or "")

    conversation_payloads = []
    for c in conversations:
        turns = await get_messages(str(c["_id"]), user_id)
        conversation_payloads.append(
            {
                **serialize_conversation(c).model_dump(),
                "messages": [serialize_message(row).model_dump() for row in turns],
            }
        )

    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": serialize_user(user).model_dump(),
        "conversations": conversation_payloads,
        "reports": [
            {
                "id": str(r["_id"]),
                "title": r.get("title"),
                "symptoms": r.get("symptoms"),
                "possible_conditions": r.get("possible_conditions"),
                "recommendations": r.get("recommendations"),
                "urgency": r.get("urgency"),
                "conversation_id": r.get("conversation_id"),
                "created_at": _iso(r.get("created_at")),
            }
            for r in reports
        ],
        "assessments": [
            {
                "id": str(a["_id"]),
                "inputs": a.get("inputs"),
                "risk_score": a.get("risk_score"),
                "risk_level": a.get("risk_level"),
                "suggestions": a.get("suggestions"),
                "preventive_tips": a.get("preventive_tips"),
                "created_at": _iso(a.get("created_at")),
            }
            for a in assessments
        ],
        "images": [
            {
                "id": str(i["_id"]),
                "filename": i.get("filename"),
                "content_type": i.get("content_type"),
                "notes": i.get("notes"),
                "analysis": i.get("analysis"),
                "created_at": _iso(i.get("created_at")),
            }
            for i in images
        ],
        "reminders": [
            {
                "id": str(rem["_id"]),
                "title": rem.get("title"),
                "notes": rem.get("notes"),
                "due_at": rem.get("due_at"),
                "done": bool(rem.get("done")),
                "created_at": _iso(rem.get("created_at")),
            }
            for rem in reminders
        ],
    }
