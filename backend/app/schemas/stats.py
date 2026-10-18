"""Aggregated health-trend response shapes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RiskTrendPoint(BaseModel):
    created_at: str
    risk_score: int
    risk_level: str


class HighRiskConversation(BaseModel):
    id: str
    title: str
    urgency: str
    updated_at: str


class HealthStats(BaseModel):
    counts: dict[str, int] = Field(default_factory=dict)
    conversations_by_modality: dict[str, int] = Field(default_factory=dict)
    urgency_distribution: dict[str, int] = Field(default_factory=dict)
    assessment_trend: list[RiskTrendPoint] = Field(default_factory=list)
    # Recent conversations whose latest turn was flagged high/emergency, so the
    # dashboard can surface an "needs attention" list without extra round-trips.
    recent_high_risk: list[HighRiskConversation] = Field(default_factory=list)
    window: int = 100
