"""Shared response shapes used across consultation endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UrgencyLevel = Literal["low", "medium", "high", "emergency"]

DISCLAIMER = (
    "This is educational information only and is not a medical diagnosis, "
    "treatment plan, or emergency service. Seek professional medical care for "
    "symptoms that concern you, and call local emergency services for urgent symptoms."
)


class PossibleCondition(BaseModel):
    name: str
    confidence: float | None = Field(default=None, ge=0, le=100)
    description: str | None = None


class CrisisResource(BaseModel):
    """Actionable help resource shown when emergency language is detected."""

    label: str
    detail: str
    phone: str | None = None
    url: str | None = None


class NearbyFacility(BaseModel):
    """Compact hospital/clinic card embedded in emergency responses."""

    id: str
    name: str
    type: str | None = None
    distance_km: float | None = None
    address: str | None = None
    phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    maps_url: str | None = None


class ConsultationResult(BaseModel):
    response: str
    possible_conditions: list[PossibleCondition] = Field(default_factory=list)
    urgency: UrgencyLevel = "low"
    recommendation: str | None = None
    follow_up_questions: list[str] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER
    emergency: bool = False
    conversation_id: str | None = None
    emergency_category: str | None = None
    crisis_resources: list[CrisisResource] = Field(default_factory=list)
    nearest_hospitals: list[NearbyFacility] = Field(default_factory=list)


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
    analysis: ConsultationResult | None = None


class ConversationSummary(BaseModel):
    id: str
    title: str
    preview: str | None = None
    updated_at: str
    messages: list[MessageOut] | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    age: int | None = None
    gender: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    medical_history: str | None = None
    chronic_diseases: str | None = None
    current_medications: str | None = None
    emergency_contact: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
