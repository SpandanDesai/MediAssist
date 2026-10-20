"""Async persistence with MongoDB and a local-memory development fallback."""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Iterable
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
except ImportError:
    AsyncIOMotorClient = None  # type: ignore[assignment,misc]
    AsyncIOMotorDatabase = Any  # type: ignore[misc,assignment]

from app.core.config import get_settings

logger = logging.getLogger(__name__)
Document = dict[str, Any]


class Database:
    """Store UUID-keyed documents in Atlas when available, otherwise memory."""

    def __init__(self) -> None:
        self.client: AsyncIOMotorClient | None = None
        self.database: AsyncIOMotorDatabase | None = None
        self._memory: dict[str, dict[str, Document]] = {}
        self._lock = asyncio.Lock()
        self.using_memory = True
        self.connection_error: str | None = None

    async def connect(self) -> None:
        settings = get_settings()
        if not settings.mongodb_uri:
            self.connection_error = "MONGODB_URI is not configured"
            logger.warning("MongoDB is not configured; using volatile in-memory storage.")
            return
        if AsyncIOMotorClient is None:
            self.connection_error = "motor package is unavailable"
            logger.warning("Motor is unavailable; using volatile in-memory storage.")
            return
        candidate = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=3500)
        try:
            await candidate.admin.command("ping")
            self.client = candidate
            self.database = candidate[settings.mongodb_database]
            self.using_memory = False
            self.connection_error = None
            await self._create_indexes()
            logger.info("Connected to MongoDB database '%s'.", settings.mongodb_database)
        except Exception as exc:
            candidate.close()
            self.connection_error = f"MongoDB unavailable: {type(exc).__name__}"
            logger.warning("%s; using volatile in-memory storage.", self.connection_error)

    async def disconnect(self) -> None:
        if self.client:
            self.client.close()
        self.client = None
        self.database = None
        self.using_memory = True

    async def _create_indexes(self) -> None:
        if self.database is None:
            return
        await self.database.users.create_index("email", unique=True)
        await self.database.conversations.create_index([("user_id", 1), ("updated_at", -1)])
        await self.database.messages.create_index([("conversation_id", 1), ("seq", 1)])
        await self.database.messages.create_index([("user_id", 1), ("conversation_id", 1)])
        await self.database.reports.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.report_shares.create_index("jti", unique=True)
        await self.database.report_shares.create_index([("report_id", 1), ("user_id", 1)])
        await self.database.assessments.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.images.create_index([("user_id", 1), ("created_at", -1)])
        # Data retention TTL: expire temporary image metadata after 90 days (7776000 seconds)
        await self.database.images.create_index("created_at", expireAfterSeconds=7776000)
        await self.database.reminders.create_index([("user_id", 1), ("created_at", 1)])
        await self.database.vitals.create_index([("user_id", 1), ("recorded_at", -1)])

    async def insert_one(self, collection: str, document: Document) -> Document:
        stored = deepcopy(document)
        stored.setdefault("_id", str(uuid4()))
        stored.setdefault("created_at", datetime.now(UTC))
        if self.database is not None:
            await self.database[collection].insert_one(stored)
            return stored
        async with self._lock:
            self._memory.setdefault(collection, {})[stored["_id"]] = stored
        return deepcopy(stored)

    async def find_one(self, collection: str, query: Document) -> Document | None:
        if self.database is not None:
            result = await self.database[collection].find_one(query)
            return dict(result) if result else None
        async with self._lock:
            for item in self._memory.get(collection, {}).values():
                if _matches(item, query):
                    return deepcopy(item)
        return None

    async def find_many(
        self,
        collection: str,
        query: Document,
        *,
        sort: Iterable[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Document]:
        if self.database is not None:
            cursor = self.database[collection].find(query)
            if sort:
                cursor = cursor.sort(list(sort))
            return [dict(item) async for item in cursor.skip(skip).limit(limit)]
        async with self._lock:
            items = [deepcopy(item) for item in self._memory.get(collection, {}).values() if _matches(item, query)]
        if sort:
            for field, direction in reversed(list(sort)):
                items.sort(key=lambda item: _sort_key(item.get(field)), reverse=direction < 0)
        return items[skip : skip + limit]

    async def update_one(self, collection: str, query: Document, values: Document) -> Document | None:
        values = deepcopy(values)
        values["updated_at"] = datetime.now(UTC)
        if self.database is not None:
            from pymongo import ReturnDocument

            result = await self.database[collection].find_one_and_update(
                query, {"$set": values}, return_document=ReturnDocument.AFTER
            )
            return dict(result) if result else None
        async with self._lock:
            for identifier, item in self._memory.get(collection, {}).items():
                if _matches(item, query):
                    item.update(values)
                    self._memory[collection][identifier] = item
                    return deepcopy(item)
        return None

    async def delete_one(self, collection: str, query: Document) -> bool:
        if self.database is not None:
            return (await self.database[collection].delete_one(query)).deleted_count == 1
        async with self._lock:
            for identifier, item in list(self._memory.get(collection, {}).items()):
                if _matches(item, query):
                    del self._memory[collection][identifier]
                    return True
        return False

    async def delete_many(self, collection: str, query: Document) -> int:
        if self.database is not None:
            return (await self.database[collection].delete_many(query)).deleted_count
        count = 0
        async with self._lock:
            for identifier, item in list(self._memory.get(collection, {}).items()):
                if _matches(item, query):
                    del self._memory[collection][identifier]
                    count += 1
        return count


def _matches(document: Document, query: Document) -> bool:
    """Small Mongo-like query subset used by the local fallback."""
    for field, expected in query.items():
        if field == "$or":
            if not any(_matches(document, clause) for clause in expected):
                return False
            continue
        actual = document.get(field)
        if isinstance(expected, dict) and "$regex" in expected:
            flags = re.IGNORECASE if "i" in str(expected.get("$options", "")) else 0
            if not re.search(str(expected["$regex"]), str(actual or ""), flags):
                return False
        elif isinstance(expected, dict) and "$in" in expected:
            if actual not in expected["$in"]:
                return False
        elif isinstance(expected, dict) and any(op in expected for op in ("$lt", "$lte", "$gt", "$gte")):
            if not _compare_operators(actual, expected):
                return False
        elif actual != expected:
            return False
    return True


def _compare_operators(actual: Any, expected: dict[str, Any]) -> bool:
    """Evaluate ``$lt``/``$lte``/``$gt``/``$gte`` for the memory store.

    Missing fields never satisfy a range filter (mirrors MongoDB matching), and
    comparisons use natural value ordering so numeric ``seq`` bounds behave correctly.
    """
    if actual is None:
        return False
    for op, bound in expected.items():
        if op not in {"$lt", "$lte", "$gt", "$gte"}:
            continue
        try:
            if op == "$lt" and not actual < bound:
                return False
            if op == "$lte" and not actual <= bound:
                return False
            if op == "$gt" and not actual > bound:
                return False
            if op == "$gte" and not actual >= bound:
                return False
        except TypeError:
            return False
    return True


def _sort_key(value: Any) -> tuple[int, str, float]:
    """Total ordering across None, numbers, datetimes, and strings for the memory store.

    Numbers sort numerically (so integer fields like message ``seq`` order 2 before 10,
    not lexicographically), datetimes by their ISO string, and everything else as text.
    The leading tag keeps distinct types from being compared against each other.
    """
    if value is None:
        return (0, "", 0.0)
    if isinstance(value, bool):
        return (1, "", float(value))
    if isinstance(value, (int, float)):
        return (2, "", float(value))
    if isinstance(value, datetime):
        return (3, value.isoformat(), 0.0)
    return (4, str(value), 0.0)


database = Database()
