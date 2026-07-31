"""Chat, voice, image, assessment, and report request models."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ConsultationResult, PossibleCondition


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    context: str | None = Field(default=None, max_length=4000)


class ImageAnalysisResult(ConsultationResult):
    description: str | None = None
    visible_abnormalities: list[str] = Field(default_factory=list)
    severity: str | None = None
    advice: str | None = None


class VoiceResponse(ConsultationResult):
    transcript: str | None = None
    audio_url: str | None = None


class AssessmentRequest(BaseModel):
    smoking: str = Field(min_length=1, max_length=40)
    alcohol: str = Field(min_length=1, max_length=40)
    exercise: str = Field(min_length=1, max_length=40)
    diet: str = Field(min_length=1, max_length=40)
    sleep: str = Field(min_length=1, max_length=40)
    stress: str = Field(min_length=1, max_length=40)


class AssessmentResult(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    suggestions: list[str]
    preventive_tips: list[str]
    disclaimer: str


class ReportRequest(BaseModel):
    conversation_id: str | None = None
    title: str | None = Field(default=None, max_length=200)
    symptoms: str | None = Field(default=None, max_length=4000)
    possible_conditions: list[PossibleCondition] = Field(default_factory=list)
    recommendations: str | None = Field(default=None, max_length=4000)


class ReportSummary(BaseModel):
    id: str
    title: str
    created_at: str
    conversation_id: str | None = None
