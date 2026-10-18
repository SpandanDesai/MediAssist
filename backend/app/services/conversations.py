"""Helpers for the standalone ``messages`` collection.

Conversation documents now store only metadata (title, preview, tags, …) while the
individual turns live in their own ``messages`` collection. This keeps a single very
long thread from growing one MongoDB document without bound and lets us page through
history independently of the conversation list.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.db.database import database


async def _count(user_id: str, conversation_id: str) -> int:
    rows = await database.find_many("messages", {"user_id": user_id, "conversation_id": conversation_id}, limit=1000)
    return len(rows)


def _assistant_urgency(message: dict[str, Any]) -> str | None:
    analysis = message.get("analysis") or {}
    urgency = str(analysis.get("urgency") or "").lower()
    return urgency if urgency in {"low", "medium", "high", "emergency"} else None


async def append_messages(
    conversation_id: str,
    user_id: str,
    messages: list[dict[str, Any]],
) -> None:
    """Persist new turns for a conversation and keep the parent metadata fresh."""
    if not messages:
        return
    conversation = await database.find_one("conversations", {"_id": conversation_id}) or {}
    # message_count is a cumulative counter used to hand out monotonic ``seq`` values;
    # stored_count is how many rows are currently present (the trim target).
    base = int(conversation.get("message_count") or 0)
    if not base:
        base = await _count(user_id, conversation_id)
    stored_before = conversation.get("stored_count")
    if stored_before is None:
        stored_before = await _count(user_id, conversation_id)
    stored_before = int(stored_before)

    for offset, message in enumerate(messages, start=1):
        await database.insert_one(
            "messages",
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "id": message.get("id") or str(uuid4()),
                "role": message["role"],
                "content": message["content"],
                "analysis": message.get("analysis"),
                "seq": base + offset,
                "created_at": message.get("created_at") or datetime.now(UTC),
            },
        )

    stored_after = stored_before + len(messages)
    updates: dict[str, Any] = {
        "message_count": base + len(messages),
        "stored_count": stored_after,
    }
    for message in reversed(messages):
        if message.get("role") == "assistant":
            urgency = _assistant_urgency(message)
            if urgency:
                updates["last_urgency"] = urgency
            break

    # Bound stored history to the most recent turns (mirrors the old per-document cap).
    # Delete only the true overflow for THIS append, not cumulative message_count -
    # otherwise every later turn would over-trim and lose far more history than intended.
    limit = get_settings().max_conversation_messages
    overflow = stored_after - limit
    if overflow > 0:
        stale = await database.find_many(
            "messages",
            {"user_id": user_id, "conversation_id": conversation_id},
            sort=[("seq", 1)],
            limit=overflow,
        )
        stale_ids = [str(row["_id"]) for row in stale]
        if stale_ids:
            await database.delete_many("messages", {"_id": {"$in": stale_ids}})
            updates["stored_count"] = stored_after - len(stale_ids)

    await database.update_one("conversations", {"_id": conversation_id}, updates)


async def get_messages(conversation_id: str, user_id: str, *, limit: int = 500) -> list[dict[str, Any]]:
    rows = await database.find_many(
        "messages",
        {"conversation_id": conversation_id, "user_id": user_id},
        sort=[("seq", 1)],
        limit=limit,
    )
    # Legacy conversations kept turns inline; fall back to them when the new store is empty.
    if not rows:
        conversation = await database.find_one("conversations", {"_id": conversation_id, "user_id": user_id})
        if conversation and conversation.get("messages"):
            rows = list(conversation["messages"])
    return rows


async def get_messages_page(
    conversation_id: str,
    user_id: str,
    *,
    before_seq: int | None = None,
    limit: int = 200,
) -> tuple[list[dict[str, Any]], bool]:
    """Return one chronological page of turns plus a ``has_more`` flag.

    ``before_seq`` pages toward older history: the newest ``limit`` turns strictly
    older than it are returned (ascending). ``has_more`` is True when even older
    turns still exist, so a UI can offer a 'load older' action without guessing.
    """
    base = {"conversation_id": conversation_id, "user_id": user_id}
    query = dict(base)
    if before_seq is not None:
        query["seq"] = {"$lt": before_seq}
    # Pull the most recent ``limit`` turns in this window, then restore order.
    rows = await database.find_many("messages", query, sort=[("seq", -1)], limit=limit)
    rows = list(reversed(rows))
    has_more = len(rows) >= limit
    if rows and before_seq is None:
        # First page: confirm whether anything older than the window still exists.
        oldest = rows[0].get("seq")
        if oldest is not None:
            older = await database.find_many("messages", {**base, "seq": {"$lt": oldest}}, limit=1)
            has_more = bool(older)
    return rows, has_more


async def get_history(conversation_id: str, user_id: str, *, n: int = 12) -> list[dict[str, str]]:
    """Return the most recent ``n`` user/assistant turns in chronological order."""
    rows = await database.find_many(
        "messages",
        {"conversation_id": conversation_id, "user_id": user_id},
        sort=[("seq", -1)],
        limit=n,
    )
    history: list[dict[str, str]] = []
    for row in reversed(rows):
        if row.get("role") in {"user", "assistant"} and row.get("content"):
            history.append({"role": row["role"], "content": row["content"]})
    return history


async def delete_for_conversation(conversation_id: str, user_id: str) -> None:
    await database.delete_many("messages", {"conversation_id": conversation_id, "user_id": user_id})
