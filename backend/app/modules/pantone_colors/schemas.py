"""Pydantic schemas for the pantone colors API (pantone-colors spec;
design module layout).

``PantoneColorCreate`` requires ``code`` and validates ``paint_type`` against
the ``reactiva``/``pigmento`` enum; ``gamut`` defaults to ``C`` when omitted.
``PantoneColorUpdate`` supports partial updates; the 409 duplicate check runs
at the router. ``PantoneColorOut`` never exposes internal state beyond the
public color fields.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import PaintType


class PantoneColorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    gamut: str
    paint_type: PaintType
    created_at: datetime


class PantoneColorCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    gamut: str = Field(default="C", min_length=1, max_length=10)
    paint_type: PaintType


class PantoneColorUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    gamut: str | None = Field(default=None, min_length=1, max_length=10)
    paint_type: PaintType | None = None
