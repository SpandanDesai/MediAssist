"""OpenAI-backed consultation, transcription, TTS, and vision services."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from app.core.config import get_settings
from app.schemas.chat import ImageAnalysisResult, VoiceResponse
from app.schemas.common import DISCLAIMER, ConsultationResult, PossibleCondition
from app.services.emergency import detect_emergency, emergency_consultation
from app.services.rules_engine import analyze_image_notes, analyze_symptoms, extract_json_object

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MediAssist AI, a cautious healthcare information assistant.
Rules:
- Never claim a confirmed medical diagnosis or certainty.
- Provide educational information only.
- Estimate possible conditions with confidence percentages that sum near 100.
- Explain reasoning briefly.
- Estimate urgency as one of: low, medium, high, emergency.
- Ask follow-up questions when useful.
- Recommend home care only when appropriate, and professional care when symptoms warrant it.
- Always include a clear medical disclaimer.
- If emergency symptoms are present, set emergency=true and urgency=emergency.
Return ONLY valid JSON with keys:
response, possible_conditions (array of {name, confidence, description}), urgency,
recommendation, follow_up_questions (array of strings), disclaimer, emergency (boolean).
"""

VISION_PROMPT = """You are MediAssist AI analyzing a medical-related photo for educational purposes only.
Never claim certainty or a confirmed diagnosis.
Describe visible findings cautiously, list possible conditions with confidence percentages,
estimate severity/urgency, and give advice. Prefer dermatologist review when uncertain.
If severe findings are possible, recommend emergency/urgent care.
Return ONLY valid JSON with keys:
response, description, visible_abnormalities (string array), possible_conditions
({name, confidence, description}), urgency, severity, recommendation, advice,
follow_up_questions, disclaimer, emergency.
"""


def _client():
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(api_key=settings.openai_api_key)
    except Exception as exc:  # pragma: no cover - import/runtime guard
        logger.warning("OpenAI client unavailable: %s", exc)
        return None


def _conditions_from_raw(raw: Any) -> list[PossibleCondition]:
    if not isinstance(raw, list):
        return []
    out: list[PossibleCondition] = []
    for item in raw:
        if isinstance(item, str):
            out.append(PossibleCondition(name=item))
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
            PossibleCondition(
                name=str(item.get("name") or item.get("condition") or "Possible condition"),
                confidence=confidence_val,
                description=str(item["description"]) if item.get("description") else None,
            )
        )
    return out


def _consultation_from_dict(data: dict[str, Any], conversation_id: str | None) -> ConsultationResult:
    urgency = str(data.get("urgency") or "low").lower()
    if urgency not in {"low", "medium", "high", "emergency"}:
        urgency = "medium"
    return ConsultationResult(
        response=str(data.get("response") or data.get("message") or "Here is cautious educational guidance."),
        possible_conditions=_conditions_from_raw(data.get("possible_conditions") or data.get("conditions")),
        urgency=urgency,  # type: ignore[arg-type]
        recommendation=str(data["recommendation"]) if data.get("recommendation") else None,
        follow_up_questions=[str(q) for q in (data.get("follow_up_questions") or []) if q],
        disclaimer=str(data.get("disclaimer") or DISCLAIMER),
        emergency=bool(data.get("emergency")) or urgency == "emergency",
        conversation_id=conversation_id,
    )


async def consult_text(
    message: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> ConsultationResult:
    emergency = detect_emergency(message)
    if emergency:
        return emergency_consultation(emergency, conversation_id)

    client = _client()
    settings = get_settings()
    if client is None:
        return analyze_symptoms(message, conversation_id, profile_context)

    user_content = message
    if profile_context:
        user_content = f"Optional patient profile context:\n{profile_context}\n\nUser message:\n{message}"

    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history or []:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_content})

    try:
        completion = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content or "{}"
        data = extract_json_object(content) or json.loads(content)
        result = _consultation_from_dict(data, conversation_id)
        if result.emergency or detect_emergency(result.response):
            category = detect_emergency(message) or detect_emergency(result.response) or "urgent symptoms"
            return emergency_consultation(category, conversation_id)
        return result
    except Exception as exc:
        logger.exception("OpenAI chat failed: %s", exc)
        return analyze_symptoms(message, conversation_id, profile_context)


async def consult_image(
    image_bytes: bytes,
    mime_type: str,
    notes: str | None = None,
    conversation_id: str | None = None,
) -> ImageAnalysisResult:
    if notes:
        emergency = detect_emergency(notes)
        if emergency:
            base = emergency_consultation(emergency, conversation_id)
            return ImageAnalysisResult(
                **base.model_dump(),
                description="Emergency language detected in notes accompanying the image.",
                visible_abnormalities=[],
                severity="emergency",
                advice=base.recommendation,
            )

    client = _client()
    settings = get_settings()
    if client is None:
        return analyze_image_notes(notes, conversation_id)

    encoded = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{encoded}"
    prompt = notes or "Please cautiously describe visible findings and educational possibilities."

    try:
        completion = client.chat.completions.create(
            model=settings.openai_vision_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": VISION_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
        )
        content = completion.choices[0].message.content or "{}"
        data = extract_json_object(content) or json.loads(content)
        base = _consultation_from_dict(data, conversation_id)
        return ImageAnalysisResult(
            **base.model_dump(),
            description=str(data.get("description") or "Cautious visual observations only."),
            visible_abnormalities=[str(x) for x in (data.get("visible_abnormalities") or []) if x],
            severity=str(data.get("severity") or base.urgency),
            advice=str(data.get("advice") or base.recommendation or ""),
        )
    except Exception as exc:
        logger.exception("OpenAI vision failed: %s", exc)
        return analyze_image_notes(notes, conversation_id)


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client = _client()
    settings = get_settings()
    if client is None:
        return "Voice consultation received. Configure OPENAI_API_KEY to enable speech-to-text."

    import io

    buffer = io.BytesIO(audio_bytes)
    buffer.name = filename
    try:
        result = client.audio.transcriptions.create(
            model=settings.openai_transcription_model,
            file=buffer,
        )
        return getattr(result, "text", None) or str(result)
    except Exception as exc:
        logger.exception("Transcription failed: %s", exc)
        return "I could not transcribe that audio clearly. Please try again or type your symptoms."


async def synthesize_speech(text: str) -> str | None:
    """Return a data URL with base64 audio, or None when TTS is unavailable."""
    client = _client()
    settings = get_settings()
    if client is None:
        return None
    try:
        speech = client.audio.speech.create(
            model=settings.openai_tts_model,
            voice=settings.openai_tts_voice,
            input=text[:4000],
            response_format="mp3",
        )
        audio_bytes = speech.content if hasattr(speech, "content") else bytes(speech.read())
        encoded = base64.b64encode(audio_bytes).decode("ascii")
        return f"data:audio/mpeg;base64,{encoded}"
    except Exception as exc:
        logger.warning("TTS unavailable: %s", exc)
        return None


async def consult_voice(
    audio_bytes: bytes,
    filename: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> VoiceResponse:
    transcript = await transcribe_audio(audio_bytes, filename)
    result = await consult_text(
        transcript,
        conversation_id=conversation_id,
        history=history,
        profile_context=profile_context,
    )
    spoken = result.response
    if result.recommendation:
        spoken = f"{result.response}\n\nRecommendation: {result.recommendation}"
    audio_url = await synthesize_speech(spoken)
    return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=audio_url)
