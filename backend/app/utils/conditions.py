"""Shared parsing for model-supplied "possible condition" payloads.

Both the Gemini agent normalizer and the AI-service consultation builder
receive loosely-shaped condition lists (strings, dicts with name/condition,
confidence/probability). This module keeps that coercion in one audited place.
"""

from __future__ import annotations

from typing import Any


def parse_condition_items(raw: Any) -> list[dict[str, Any]]:
    """Normalize a condition list into ``{name, confidence, description}`` dicts.

    Confidence is coerced to a float on a 0-100 scale (values <= 1 are treated
    as fractions and scaled). Non-list input, and any non-str/dict element, is
    skipped defensively so callers never crash on malformed model output.
    """
    if not isinstance(raw, list):
        return []

    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, str):
            out.append({"name": item, "confidence": None, "description": None})
            continue
        if not isinstance(item, dict):
            continue
        confidence = item.get("confidence", item.get("probability"))
        try:
            confidence_val = float(confidence) if confidence is not None else None
        except (TypeError, ValueError):
            confidence_val = None
        if confidence_val is not None and confidence_val <= 1:
            confidence_val *= 100
        out.append(
            {
                "name": str(item.get("name") or item.get("condition") or "Possible condition"),
                "confidence": confidence_val,
                "description": str(item["description"]) if item.get("description") else None,
            }
        )
    return out
