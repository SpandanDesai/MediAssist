"""Conversation history routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query, status

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.common import ConversationSummary
from app.utils.serializers import serialize_conversation

router = APIRouter(tags=["history"])


@router.get("/history", response_model=list[ConversationSummary])
async def list_history(
    user: CurrentUser,
    q: str | None = Query(default=None, max_length=200),
) -> list[ConversationSummary]:
    query: dict = {"user_id": str(user["_id"])}
    if q:
        # Escape user input so it is matched literally, never as a regex.
        pattern = re.escape(q.strip())
        query["$or"] = [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"preview": {"$regex": pattern, "$options": "i"}},
        ]
    conversations = await database.find_many(
        "conversations",
        query,
        sort=[("updated_at", -1)],
        limit=100,
    )
    return [serialize_conversation(item, include_messages=True) for item in conversations]


@router.delete("/history/{conversation_id}")
async def delete_history(conversation_id: str, user: CurrentUser) -> dict[str, str]:
    deleted = await database.delete_one("conversations", {"_id": conversation_id, "user_id": str(user["_id"])})
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return {"status": "deleted"}
