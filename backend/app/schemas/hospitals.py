"""Nearby hospital response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HospitalOut(BaseModel):
    id: str
    name: str
    type: str | None = None
    distance: float | None = None
    address: str | None = None
    phone: str | None = None
    latitude: float
    longitude: float
    is_open: bool | None = None


class HospitalListResponse(BaseModel):
    hospitals: list[HospitalOut] = Field(default_factory=list)
    source: str = "openstreetmap"
