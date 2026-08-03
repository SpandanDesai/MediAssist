"""Dr. Homie–compatible Gemini medical agent used by MediAssist AI features.

Ports the frontend MedicalAgent from Dr. Homie to the server so chat, voice,
and image analysis share the same Gemini model failover + JSON contract.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import ssl
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.common import DISCLAIMER

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _ssl_verify() -> ssl.SSLContext | bool:
    """Prefer the OS trust store (needed on some Windows/antivirus setups)."""
    try:
        return ssl.create_default_context()
    except Exception:
        return True

PRIORITY_MODELS = (
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-flash",
)

SKIP_MODEL_TOKENS = (
    "tts",
    "embed",
    "embedding",
    "image",
    "imagen",
    "aqa",
    "robotics",
    "computer-use",
    "gemini-2.5-pro-preview",
)

# Homie-style voice + MediAssist JSON contract the UI already expects.
SYSTEM_INSTRUCTION = """
You are MediAssist AI (powered by the same clinical reasoning style as Dr. HOMIE),
an empathetic AI Medical Assistant.

RULES:
1. TALK DIRECTLY TO THE USER (Use "You", not "The user").
2. Ask clarifying questions INSIDE your main message (user_message / response).
3. Be concise but helpful. Never claim a confirmed medical diagnosis.
4. Estimate possible conditions with confidence/probability percentages.
5. Estimate urgency as one of: low, medium, high, emergency.
6. If emergency symptoms are present, set emergency=true and urgency=emergency.
7. Always include a clear medical disclaimer.
8. Output ONLY valid JSON (no markdown fences).

JSON STRUCTURE:
{
  "user_message": "Your full reply to the user (Markdown allowed). Also mirrored in response.",
  "response": "Same helpful reply as user_message.",
  "top_conditions": [{"name": "Migraine", "probability": 60, "description": "optional"}],
  "possible_conditions": [{"name": "Migraine", "confidence": 60, "description": "optional"}],
  "urgency": "low",
  "recommendation": "Optional next-step advice",
  "follow_up_questions": ["Optional clarifying question"],
  "disclaimer": "Educational information only; not a diagnosis.",
  "emergency": false
}

For IMAGE analysis, also include:
description, visible_abnormalities (string array), severity, advice.

For VOICE / AUDIO input, also include:
transcript (what the user said, as best you can understand).
""".strip()

VISION_EXTRA = (
    "The user shared a medical-related photo for educational analysis only. "
    "Describe visible findings cautiously; prefer specialist review when uncertain."
)

VOICE_EXTRA = (
    "The user shared an audio voice note. Transcribe their speech into 'transcript', "
    "then provide the same medical guidance JSON as for text consultations."
)


class GeminiMedicalAgent:
    """Stateful Gemini client with Homie-style model discovery and failover."""

    def __init__(self, api_key: str | None = None) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.gemini_api_key or ""
        self.available_models: list[str] = []
        self._initialized = False

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def init(self) -> None:
        if self._initialized:
            return
        if not self.configured:
            self.available_models = ["models/gemini-1.5-flash", "models/gemini-2.0-flash"]
            self._initialized = True
            return

        try:
            async with httpx.AsyncClient(timeout=30.0, verify=_ssl_verify()) as client:
                response = await client.get(f"{GEMINI_BASE}/models", params={"key": self.api_key})
                response.raise_for_status()
                data = response.json()

            all_models = data.get("models") or []

            def _is_chat_model(name: str, methods: list[str]) -> bool:
                low = name.lower()
                if "generateContent" not in methods:
                    return False
                if "gemini" not in low and "gemma" not in low:
                    return False
                return not any(token in low for token in SKIP_MODEL_TOKENS)

            def _exact_priority(priority: str, name: str) -> bool:
                # Prefer exact model id match (Homie-compatible priority list).
                return name == priority or name.endswith("/" + priority)

            chosen: list[str] = []
            for priority in PRIORITY_MODELS:
                found = next(
                    (
                        m.get("name")
                        for m in all_models
                        if _exact_priority(priority, m.get("name") or "")
                        and _is_chat_model(m.get("name") or "", m.get("supportedGenerationMethods") or [])
                    ),
                    None,
                )
                if found and found not in chosen:
                    chosen.append(found)

            for model in all_models:
                name = model.get("name") or ""
                methods = model.get("supportedGenerationMethods") or []
                if _is_chat_model(name, methods) and name not in chosen:
                    chosen.append(name)

            # Keep failover short — Homie tries a handful of chat models, not every listing.
            chosen = chosen[:8]

            if not chosen:
                raise RuntimeError("No Gemini models found.")
            self.available_models = chosen
            logger.info("Gemini models priority: %s", self.available_models)
        except Exception as exc:
            logger.warning("Gemini model discovery failed: %s", exc)
            self.available_models = [
                "models/gemini-flash-latest",
                "models/gemini-3.5-flash",
                "models/gemini-2.0-flash",
            ]
        self._initialized = True

    async def generate(
        self,
        *,
        user_text: str,
        history: list[dict[str, str]] | None = None,
        image_bytes: bytes | None = None,
        image_mime: str | None = None,
        audio_bytes: bytes | None = None,
        audio_mime: str | None = None,
        extra_instruction: str | None = None,
    ) -> dict[str, Any]:
        """Generate a structured medical response via Gemini."""

        if not self.configured:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        await self.init()

        system_text = SYSTEM_INSTRUCTION
        if extra_instruction:
            system_text = f"{SYSTEM_INSTRUCTION}\n\n{extra_instruction}"

        contents: list[dict[str, Any]] = [
            {"role": "user", "parts": [{"text": f"SYSTEM: {system_text}"}]},
        ]

        for item in history or []:
            role = item.get("role")
            content = item.get("content")
            if not content:
                continue
            if role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})

        parts: list[dict[str, Any]] = [{"text": user_text}]
        if image_bytes and image_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image_mime,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )
        if audio_bytes and audio_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": audio_mime,
                        "data": base64.b64encode(audio_bytes).decode("ascii"),
                    }
                }
            )
        contents.append({"role": "user", "parts": parts})

        last_error: Exception | None = None
        for model_name in self.available_models:
            url = f"{GEMINI_BASE}/{model_name}:generateContent"
            try:
                return await self._try_generate(url, contents)
            except Exception as exc:
                logger.warning("Gemini model %s failed: %s", model_name, exc)
                last_error = exc

        raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")

    async def _try_generate(self, url: str, contents: list[dict[str, Any]]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"response_mime_type": "application/json"},
        }
        async with httpx.AsyncClient(timeout=90.0, verify=_ssl_verify()) as client:
            response = await client.post(url, params={"key": self.api_key}, json=payload)
            if response.status_code == 400:
                logger.warning("JSON mode failed for %s, retrying text mode", url)
                payload.pop("generationConfig", None)
                response = await client.post(url, params={"key": self.api_key}, json=payload)
            if not response.is_success:
                raise RuntimeError(f"{response.status_code} {response.text[:500]}")
            return self._parse_response(response.json())

    def _parse_response(self, data: dict[str, Any]) -> dict[str, Any]:
        candidates = data.get("candidates") or []
        if not candidates:
            raise RuntimeError("No candidates returned from Gemini")
        parts = (((candidates[0] or {}).get("content") or {}).get("parts")) or []
        text = ""
        for part in parts:
            if isinstance(part, dict) and part.get("text"):
                text += str(part["text"])
        if not text:
            raise RuntimeError("Empty Gemini response")
        clean = re.sub(r"```json|```", "", text).strip()
        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError:
            # Recover partial JSON objects when the model wraps prose.
            match = re.search(r"\{[\s\S]*\}", clean)
            if not match:
                raise
            parsed = json.loads(match.group(0))
        if not isinstance(parsed, dict):
            raise RuntimeError("Gemini response was not a JSON object")
        return normalize_homie_payload(parsed)


def normalize_homie_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Map Homie fields (user_message / top_conditions) onto MediAssist keys."""

    response = (
        data.get("response")
        or data.get("user_message")
        or data.get("message")
        or "Here is cautious educational guidance."
    )
    conditions = data.get("possible_conditions") or data.get("top_conditions") or data.get("conditions") or []
    normalized_conditions: list[dict[str, Any]] = []
    if isinstance(conditions, list):
        for item in conditions:
            if isinstance(item, str):
                normalized_conditions.append({"name": item})
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
            normalized_conditions.append(
                {
                    "name": str(item.get("name") or item.get("condition") or "Possible condition"),
                    "confidence": confidence_val,
                    "description": str(item["description"]) if item.get("description") else None,
                }
            )

    urgency = str(data.get("urgency") or "low").lower()
    if urgency not in {"low", "medium", "high", "emergency"}:
        urgency = "medium"
    emergency = bool(data.get("emergency")) or urgency == "emergency"

    out = {
        "response": str(response),
        "user_message": str(data.get("user_message") or response),
        "possible_conditions": normalized_conditions,
        "top_conditions": [
            {"name": c["name"], "probability": c.get("confidence")} for c in normalized_conditions
        ],
        "urgency": urgency,
        "recommendation": str(data["recommendation"]) if data.get("recommendation") else None,
        "follow_up_questions": [str(q) for q in (data.get("follow_up_questions") or []) if q],
        "disclaimer": str(data.get("disclaimer") or DISCLAIMER),
        "emergency": emergency,
        "description": data.get("description"),
        "visible_abnormalities": data.get("visible_abnormalities") or [],
        "severity": data.get("severity"),
        "advice": data.get("advice"),
        "transcript": data.get("transcript"),
    }
    return out


_agent: GeminiMedicalAgent | None = None


def get_gemini_agent() -> GeminiMedicalAgent:
    global _agent
    if _agent is None:
        _agent = GeminiMedicalAgent()
    return _agent
