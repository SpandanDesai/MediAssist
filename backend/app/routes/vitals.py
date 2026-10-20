"""Personal vitals tracker routes (weight, blood pressure, glucose, ...).

User-owned time-series readings that power the dashboard trend chart and the
Vitals page. Every query is ownership-scoped by ``user_id`` so one account can
never read or delete another's readings.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.vitals import UNIT_BY_KIND, VitalCreate, VitalOut

router = APIRouter(tags=["vitals"])


def _iso(value: object) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


def _normalise_recorded_at(value: str | None) -> datetime:
    """Parse an optional ISO date/datetime into an aware UTC moment.

    Falls back to "now" when absent or unparseable, mirroring the tolerant
    date handling already used for reminders.
    """
    if not value or not value.strip():
        return datetime.now(UTC)
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(UTC)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _to_out(document: dict) -> VitalOut:
    kind = str(document.get("kind"))
    return VitalOut(
        id=str(document["_id"]),
        kind=kind,  # type: ignore[arg-type]
        value=float(document.get("value") or 0.0),
        unit=str(document.get("unit") or UNIT_BY_KIND.get(kind, "")),
        note=document.get("note"),
        recorded_at=_iso(document.get("recorded_at")),
        created_at=_iso(document.get("created_at")),
    )


@router.get("/vitals", response_model=list[VitalOut])
async def list_vitals(
    user: CurrentUser,
    kind: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[VitalOut]:
    query: dict = {"user_id": str(user["_id"])}
    if kind:
        query["kind"] = kind
    rows = await database.find_many("vitals", query, sort=[("recorded_at", -1)], limit=limit)
    return [_to_out(row) for row in rows]


@router.post("/vitals", response_model=VitalOut, status_code=status.HTTP_201_CREATED)
async def create_vital(payload: VitalCreate, user: CurrentUser) -> VitalOut:
    created = await database.insert_one(
        "vitals",
        {
            "user_id": str(user["_id"]),
            "kind": payload.kind,
            "value": payload.value,
            "unit": UNIT_BY_KIND[payload.kind],
            "note": payload.note,
            "recorded_at": _normalise_recorded_at(payload.recorded_at),
            "created_at": datetime.now(UTC),
        },
    )
    return _to_out(created)


@router.delete("/vitals/{vital_id}")
async def delete_vital(vital_id: str, user: CurrentUser) -> dict[str, str]:
    deleted = await database.delete_one("vitals", {"_id": vital_id, "user_id": str(user["_id"])})
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vital not found.")
    return {"status": "deleted"}
