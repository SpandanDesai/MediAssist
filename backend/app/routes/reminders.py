"""Personal care reminders (follow-ups, refills, rechecks) per user."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.reminders import ReminderCreate, ReminderOut, ReminderUpdate

router = APIRouter(tags=["reminders"])


def _iso(value: object) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


def _parse_due(value: object) -> datetime | None:
    """Best-effort parse of a stored ``due_at`` (ISO date or datetime) to aware UTC."""
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    # Date-only strings ('2026-11-01') are valid ISO but parse to a naive datetime at
    # midnight; accept both and normalise to aware UTC for comparison.
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _to_out(document: dict) -> ReminderOut:
    return ReminderOut(
        id=str(document["_id"]),
        title=str(document.get("title") or "Reminder"),
        notes=document.get("notes"),
        due_at=document.get("due_at"),
        done=bool(document.get("done")),
        created_at=_iso(document.get("created_at")),
    )


@router.get("/reminders", response_model=list[ReminderOut])
async def list_reminders(user: CurrentUser) -> list[ReminderOut]:
    rows = await database.find_many(
        "reminders", {"user_id": str(user["_id"])}, sort=[("created_at", 1)], limit=200
    )
    return [_to_out(row) for row in rows]


@router.get("/reminders/upcoming", response_model=list[ReminderOut])
async def upcoming_reminders(
    user: CurrentUser,
    days: int = Query(default=7, ge=0, le=365),
) -> list[ReminderOut]:
    """Pending reminders that are overdue or due within the next ``days`` days.

    Date-aware and timezone-normalised so the dashboard can surface a 'due soon'
    strip without pulling the entire list. Reminders without a usable ``due_at``
    are excluded.
    """
    now = datetime.now(UTC)
    horizon = now + timedelta(days=days)
    rows = await database.find_many(
        "reminders", {"user_id": str(user["_id"]), "done": False}, sort=[("due_at", 1)], limit=200
    )
    due: list[ReminderOut] = []
    for row in rows:
        moment = _parse_due(row.get("due_at"))
        if moment is not None and moment <= horizon:
            due.append(_to_out(row))
    return due


@router.post("/reminders", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(payload: ReminderCreate, user: CurrentUser) -> ReminderOut:
    created = await database.insert_one(
        "reminders",
        {
            "user_id": str(user["_id"]),
            "title": payload.title.strip(),
            "notes": payload.notes,
            "due_at": payload.due_at,
            "done": False,
            "created_at": datetime.now(UTC),
        },
    )
    return _to_out(created)


@router.patch("/reminders/{reminder_id}", response_model=ReminderOut)
async def update_reminder(reminder_id: str, payload: ReminderUpdate, user: CurrentUser) -> ReminderOut:
    sent = payload.model_dump(exclude_unset=True)
    if not sent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
    updates: dict = {}
    if "title" in sent and sent["title"]:
        updates["title"] = sent["title"].strip()
    for key in ("notes", "due_at", "done"):
        if key in sent:
            updates[key] = sent[key]
    updated = await database.update_one(
        "reminders", {"_id": reminder_id, "user_id": str(user["_id"])}, updates
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return _to_out(updated)


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: CurrentUser) -> dict[str, str]:
    deleted = await database.delete_one("reminders", {"_id": reminder_id, "user_id": str(user["_id"])})
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return {"status": "deleted"}
