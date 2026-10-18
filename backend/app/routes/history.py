"""Conversation history routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.common import ConversationSummary, MessageOut
from app.services.conversations import delete_for_conversation, get_messages, get_messages_page
from app.utils.serializers import serialize_conversation, serialize_message, str_list_unique

router = APIRouter(tags=["history"])


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    tags: list[str] | None = Field(default=None, max_length=25)
    archived: bool | None = None


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
    return [serialize_conversation(item) for item in conversations]


@router.get("/history/{conversation_id}/messages", response_model=list[MessageOut])
async def list_conversation_messages(
    conversation_id: str,
    user: CurrentUser,
    response: Response,
    limit: int = Query(default=500, ge=1, le=1000),
    before_seq: int | None = Query(default=None, ge=1),
) -> list[MessageOut]:
    """Return a page of one conversation's turns (stored in its own collection).

    The body stays a plain array for backward compatibility. Pagination metadata is
    exposed via ``X-Has-More`` and ``X-Oldest-Seq`` so a client can request the next
    (older) page with ``?before_seq=<X-Oldest-Seq>``.
    """
    conversation = await database.find_one(
        "conversations", {"_id": conversation_id, "user_id": str(user["_id"])}
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    rows, has_more = await get_messages_page(conversation_id, str(user["_id"]), before_seq=before_seq, limit=limit)
    # Legacy conversations kept turns inline; surface them when the store is empty.
    if not rows and before_seq is None:
        rows = await get_messages(conversation_id, str(user["_id"]), limit=limit)
    seqs = [row.get("seq") for row in rows if row.get("seq") is not None]
    if seqs:
        response.headers["X-Oldest-Seq"] = str(min(seqs))
    response.headers["X-Has-More"] = "true" if has_more else "false"
    return [serialize_message(row) for row in rows]


@router.delete("/history/{conversation_id}")
async def delete_history(conversation_id: str, user: CurrentUser) -> dict[str, str]:
    deleted = await database.delete_one("conversations", {"_id": conversation_id, "user_id": str(user["_id"])})
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    await delete_for_conversation(conversation_id, str(user["_id"]))
    return {"status": "deleted"}


@router.patch("/history/{conversation_id}", response_model=ConversationSummary)
async def update_history(
    conversation_id: str,
    payload: ConversationUpdate,
    user: CurrentUser,
) -> ConversationSummary:
    """Rename, tag, or archive a conversation. Only the supplied fields change."""
    sent = payload.model_dump(exclude_unset=True)
    if not sent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    updates: dict = {}
    if "title" in sent and sent["title"]:
        updates["title"] = sent["title"].strip()
    if "tags" in sent and sent["tags"] is not None:
        updates["tags"] = str_list_unique(sent["tags"])
    if "archived" in sent and sent["archived"] is not None:
        updates["archived"] = bool(sent["archived"])

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields to update.")

    updated = await database.update_one(
        "conversations", {"_id": conversation_id, "user_id": str(user["_id"])}, updates
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return serialize_conversation(updated)
