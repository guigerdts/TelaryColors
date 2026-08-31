"""Schemas for formula↔design links (formula-designs spec).

``FormulaDesignCreate`` carries only the ``design_id`` — the formula is part
of the URL, so the pair is always complete. ``FormulaDesignOut`` is the
single link row; ``source`` is ``manual`` (linked explicitly from the
formula detail page) or ``auto`` (derived from a tagged consumo).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.enums import DesignSource


class FormulaDesignCreate(BaseModel):
    design_id: int


class FormulaDesignOut(BaseModel):
    """One ``formula_designs`` row with the acting ``source``.

    The link is a pure association: only identity + provenance + timestamp.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    formula_id: int
    design_id: int
    source: DesignSource
    created_at: datetime