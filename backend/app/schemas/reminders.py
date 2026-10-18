"""Care reminder request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    due_at: str | None = Field(default=None, max_length=40)


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    due_at: str | None = Field(default=None, max_length=40)
    done: bool | None = None


class ReminderOut(BaseModel):
    id: str
    title: str
    notes: str | None = None
    due_at: str | None = None
    done: bool = False
    created_at: str
