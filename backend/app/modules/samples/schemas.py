"""Pydantic schemas for the samples API (samples spec; design module layout).

``SampleCreate`` requires the target Pantone anchor and accepts an optional
initial ``photo_url`` and free-text ``notes``; ``status`` always defaults to
``archivada_reutilizable`` (register = near-miss, design ADR-6) and cannot be
set at create time. ``SampleUpdate`` exposes the three mutable fields
(``status``/``photo_url``/``notes``); ``pantone_target_id`` is declared so an
attempt to change it fails loudly in the router (400) instead of being
silently dropped as an unknown extra field. ``SampleOut`` mirrors the ORM
shape, including the optional ``formula_id`` set by a later promote.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import SampleStatus


class SampleCreate(BaseModel):
    pantone_target_id: int
    photo_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)


class SampleUpdate(BaseModel):
    status: SampleStatus | None = None
    photo_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)
    # Immutable post-create (design ADR-6): declaring the field here lets the
    # router reject any attempt with an explicit 400 instead of silently
    # ignoring the value.
    pantone_target_id: int | None = None


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pantone_target_id: int
    formula_id: int | None
    photo_url: str | None
    status: SampleStatus
    notes: str | None
    created_by: int
    created_at: datetime