"""Profile update models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = Field(default=None, max_length=40)
    blood_group: str | None = Field(default=None, max_length=8)
    allergies: str | None = Field(default=None, max_length=2000)
    medical_history: str | None = Field(default=None, max_length=5000)
    chronic_diseases: str | None = Field(default=None, max_length=2000)
    emergency_contact: str | None = Field(default=None, max_length=200)
