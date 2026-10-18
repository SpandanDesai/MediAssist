"""Process-local, PHI-free operational counters.

A tiny in-memory metrics registry (no external dependency) used to observe
traffic and safety/fallback behaviour without exposing any user data. Counters
are best-effort and reset on process restart, which is acceptable for a
single-instance deployment; swap the store for Prometheus/OTel when scaling out.
"""

from __future__ import annotations

import threading
from collections import defaultdict


class _CounterStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, int] = defaultdict(int)

    def increment(self, name: str, value: int = 1) -> None:
        with self._lock:
            self._counters[name] += value

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self._counters)

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()


_store = _CounterStore()


def increment(name: str, value: int = 1) -> None:
    _store.increment(name, value)


def snapshot() -> dict[str, int]:
    return _store.snapshot()


def reset() -> None:
    """Test seam: clear all counters."""
    _store.reset()
