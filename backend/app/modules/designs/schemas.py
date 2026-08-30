"""Pydantic schemas for the designs API (designs spec; design module layout).

``DesignCreate`` requires a unique ``name``, a ``paint_type`` from the
shared enum, and ``color_ids`` referencing Pantone colors. The 1–7 color
cardinality is NOT enforced here: it is validated inside the router's
transaction so the rejection carries a Spanish message (design ADR-6 /
design-time note — SQLite cannot CHECK a cross-row count). ``DesignUpdate``
only sets fields that are provided (existing users/formulas pattern);
``color_ids`` replaces the whole color set when supplied. ``DesignOut``
nests the design's ``colors`` from the ORM relationship, each exposing its
``pantone_color_id``.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import PaintType


class DesignColorOut(BaseModel):
    """One ``design_colors`` link row, exposed as ``pantone_color_id``."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    pantone_color_id: int


class DesignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    paint_type: PaintType
    color_ids: list[int]
    client: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class DesignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    paint_type: PaintType | None = None
    color_ids: list[int] | None = None
    client: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class DesignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    paint_type: PaintType
    client: str | None
    notes: str | None
    created_by: int
    created_at: datetime
    updated_at: datetime
    colors: list[DesignColorOut]