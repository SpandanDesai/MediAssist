"""Gemini-backed consultation, transcription, TTS helpers, and vision services.

Uses the Dr. Homie–compatible GeminiMedicalAgent for chat, image, and voice.
Falls back to the local rules engine when GEMINI_API_KEY is missing.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.chat import ImageAnalysisResult, VoiceResponse
from app.schemas.common import DISCLAIMER, ConsultationResult, PossibleCondition
from app.services.emergency import detect_emergency, emergency_consultation
from app.services.gemini_agent import VISION_EXTRA, VOICE_EXTRA, get_gemini_agent, ssl_verify
from app.services.medication_guard import medication_consultation, needs_medication_guard
from app.services.metrics import increment
from app.services.rules_engine import analyze_image_notes, analyze_symptoms
from app.utils.conditions import parse_condition_items

logger = logging.getLogger(__name__)


def _conditions_from_raw(raw: Any) -> list[PossibleCondition]:
    return [
        PossibleCondition(
            name=item["name"],
            confidence=item["confidence"],
            description=item["description"],
        )
        for item in parse_condition_items(raw)
    ]


def _consultation_from_dict(data: dict[str, Any], conversation_id: str | None) -> ConsultationResult:
    urgency = str(data.get("urgency") or "low").lower()
    if urgency not in {"low", "medium", "high", "emergency"}:
        urgency = "medium"
    return ConsultationResult(
        response=str(
            data.get("response")
            or data.get("user_message")
            or data.get("message")
            or "Here is cautious educational guidance."
        ),
        possible_conditions=_conditions_from_raw(
            data.get("possible_conditions") or data.get("top_conditions") or data.get("conditions")
        ),
        urgency=urgency,  # type: ignore[arg-type]
        recommendation=str(data["recommendation"]) if data.get("recommendation") else None,
        follow_up_questions=[str(q) for q in (data.get("follow_up_questions") or []) if q],
        disclaimer=str(data.get("disclaimer") or DISCLAIMER),
        emergency=bool(data.get("emergency")) or urgency == "emergency",
        conversation_id=conversation_id,
    )


def _gemini_ready() -> bool:
    return get_gemini_agent().configured


def _deterministic_pre_check(text: str, conversation_id: str | None) -> ConsultationResult | None:
    """Safety checks that must run before any model call."""
    emergency = detect_emergency(text)
    if emergency:
        increment("emergency_detected_total")
        return emergency_consultation(emergency, conversation_id)
    if needs_medication_guard(text):
        increment("medication_guard_triggered_total")
        return medication_consultation(text, conversation_id)
    return None


async def consult_text(
    message: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> ConsultationResult:
    pre = _deterministic_pre_check(message, conversation_id)
    if pre is not None:
        return pre

    if not _gemini_ready():
        return analyze_symptoms(message, conversation_id, profile_context)

    user_content = message
    if profile_context:
        user_content = f"Optional patient profile context:\n{profile_context}\n\nUser message:\n{message}"

    try:
        data = await get_gemini_agent().generate(user_text=user_content, history=history)
        result = _consultation_from_dict(data, conversation_id)
        # Re-check the model's own output so an unsafe reply is never returned as-is.
        # The input message was already screened by _deterministic_pre_check, so only
        # the generated text needs inspecting here.
        output_emergency = detect_emergency(result.response) or (
            detect_emergency(result.recommendation or "") if result.recommendation else None
        )
        if result.emergency or output_emergency:
            category = output_emergency or "urgent symptoms"
            return emergency_consultation(category, conversation_id)
        return result
    except Exception as exc:
        logger.exception("Gemini chat failed: %s", exc)
        increment("gemini_fallback_total")
        return analyze_symptoms(message, conversation_id, profile_context)


async def consult_image(
    image_bytes: bytes,
    mime_type: str,
    notes: str | None = None,
    conversation_id: str | None = None,
) -> ImageAnalysisResult:
    if notes:
        pre = _deterministic_pre_check(notes, conversation_id)
        if pre is not None:
            return ImageAnalysisResult(
                **pre.model_dump(),
                description=(
                    "Emergency language detected in notes accompanying the image."
                    if pre.emergency
                    else "Safety guidance applied to the accompanying notes."
                ),
                visible_abnormalities=[],
                severity="emergency" if pre.emergency else "uncertain",
                advice=pre.recommendation,
            )

    if not _gemini_ready():
        return analyze_image_notes(notes, conversation_id)

    prompt = notes or "Please cautiously describe visible findings and educational possibilities."

    try:
        data = await get_gemini_agent().generate(
            user_text=prompt,
            image_bytes=image_bytes,
            image_mime=mime_type,
            extra_instruction=VISION_EXTRA,
        )
        base = _consultation_from_dict(data, conversation_id)
        return ImageAnalysisResult(
            **base.model_dump(),
            description=str(data.get("description") or "Cautious visual observations only."),
            visible_abnormalities=[str(x) for x in (data.get("visible_abnormalities") or []) if x],
            severity=str(data.get("severity") or base.urgency),
            advice=str(data.get("advice") or base.recommendation or ""),
        )
    except Exception as exc:
        logger.exception("Gemini vision failed: %s", exc)
        increment("gemini_fallback_total")
        return analyze_image_notes(notes, conversation_id)


def _guess_audio_mime(filename: str) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".m4a"):
        return "audio/mp4"
    if lower.endswith(".webm"):
        return "audio/webm"
    return "audio/webm"


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Ask Gemini to transcribe speech; used when a plain transcript is needed."""

    if not _gemini_ready():
        return "Voice consultation received. Configure GEMINI_API_KEY to enable speech understanding."

    try:
        data = await get_gemini_agent().generate(
            user_text=(
                "Transcribe the attached audio as accurately as possible. "
                "Return JSON with at least transcript set to the spoken words."
            ),
            audio_bytes=audio_bytes,
            audio_mime=_guess_audio_mime(filename),
            extra_instruction=VOICE_EXTRA,
        )
        transcript = data.get("transcript") or data.get("response") or data.get("user_message")
        return str(transcript or "I could not transcribe that audio clearly.")
    except Exception as exc:
        logger.exception("Gemini transcription failed: %s", exc)
        return "I could not transcribe that audio clearly. Please try again or type your symptoms."


async def synthesize_speech(text: str) -> str | None:
    """Optional TTS via Gemini speech models; returns None when unavailable."""

    settings = get_settings()
    agent = get_gemini_agent()
    if not agent.configured:
        return None

    # Prefer a dedicated TTS model when the key can reach it; otherwise skip audio.
    tts_model = settings.gemini_tts_model
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/{tts_model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": text[:4000]}]}],
            "generationConfig": {
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {"voice_name": settings.gemini_tts_voice}
                    }
                },
            },
        }
        async with httpx.AsyncClient(timeout=60.0, verify=ssl_verify()) as client:
            response = await client.post(url, params={"key": agent.api_key}, json=payload)
            if not response.is_success:
                logger.warning("Gemini TTS unavailable: %s %s", response.status_code, response.text[:200])
                return None
            data = response.json()
            parts = ((((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")) or [])
            for part in parts:
                inline = part.get("inlineData") or part.get("inline_data") or {}
                audio_b64 = inline.get("data")
                mime = inline.get("mimeType") or inline.get("mime_type") or "audio/mpeg"
                if audio_b64:
                    return f"data:{mime};base64,{audio_b64}"
    except Exception as exc:
        logger.warning("Gemini TTS unavailable: %s", exc)
    return None


async def consult_voice(
    audio_bytes: bytes,
    filename: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> VoiceResponse:
    """Run voice consult with pre-generation transcription and deterministic safety guards."""

    if not _gemini_ready():
        transcript = "Voice consultation received. Configure GEMINI_API_KEY to enable speech understanding."
        result = analyze_symptoms(transcript, conversation_id, profile_context)
        return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=None)

    # First transcribe the audio so we can inspect user words BEFORE model consultation
    transcript = await transcribe_audio(audio_bytes, filename)

    # Run medication guard and emergency check directly on the transcript before the main consultation model runs
    pre = _deterministic_pre_check(transcript, conversation_id)
    if pre is not None:
        spoken = pre.response
        if pre.recommendation:
            spoken = f"{pre.response}\n\nRecommendation: {pre.recommendation}"
        audio_url = await synthesize_speech(spoken)
        return VoiceResponse(**pre.model_dump(), transcript=transcript, audio_url=audio_url)

    # Proceed to full text consultation with conversation history and profile context
    try:
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
    except Exception as exc:
        logger.exception("Voice consultation processing failed: %s", exc)
        result = analyze_symptoms(transcript, conversation_id, profile_context)
        return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=None)
