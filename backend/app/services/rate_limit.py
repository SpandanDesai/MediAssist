"""Simple in-memory sliding-window rate limiter."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.services import metrics


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_gc = 0.0

    def _collect_garbage(self, now: float) -> None:
        """Drop keys whose entire window has expired so the bucket map stays bounded."""
        if now - self._last_gc < self.window_seconds:
            return
        self._last_gc = now
        stale = [
            key
            for key, bucket in self._hits.items()
            if not bucket or now - bucket[-1] > self.window_seconds
        ]
        for key in stale:
            self._hits.pop(key, None)

    def check(self, key: str) -> None:
        now = time.time()
        self._collect_garbage(now)
        bucket = self._hits[key]
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.limit:
            metrics.increment("rate_limit_blocked_total")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
            )
        bucket.append(now)


# Conservative defaults suitable for educational consultation traffic.
auth_limiter = RateLimiter(limit=20, window_seconds=60)
consultation_limiter = RateLimiter(limit=30, window_seconds=60)
upload_limiter = RateLimiter(limit=15, window_seconds=60)


def client_key(request: Request, user_id: str | None = None) -> str:
    if user_id:
        return f"user:{user_id}"
    # Only trust a proxy-supplied header when explicitly configured to do so;
    # otherwise a client could rotate X-Forwarded-For to evade per-IP limits.
    if get_settings().trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
    if request.client:
        return f"ip:{request.client.host}"
    return "ip:unknown"
