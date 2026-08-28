"""Pydantic schemas for the formulas API (formulas spec; design module layout).

``FormulaCreate`` carries ``name``/``notes``, a required ``pantone_color_id``
link, and nested ``ingredients`` (at least one). ``IngredientIn`` validates a
decimal ``quantity`` (positive) and a ``unit`` from the ``g``/``kg`` enum.
``IngredientOut`` exposes the single kilogram→grams conversion point:
``quantity_g`` (design: one conversion, Decimal, no FP loss), while preserving
the original ``quantity``/``unit``. ``FormulaOut`` nests the ingredients.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db.enums import Unit


class IngredientIn(BaseModel):
    colorant: str = Field(min_length=1, max_length=100)
    quantity: Decimal = Field(gt=0)
    unit: Unit


class IngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    colorant: str
    quantity: Decimal
    unit: Unit
    # default 0 placeholder so ``from_attributes`` doesn't fail when the ORM
    # source (FormulaIngredient) has no ``quantity_g`` attribute; the after
    # validator replaces it with the real conversion result.
    quantity_g: Decimal = Field(default=Decimal("0"))

    @model_validator(mode="after")
    def _compute_quantity_g(self) -> "IngredientOut":
        """Single unit-conversion point: 1 kg == 1000 g (Decimal, no FP loss)."""
        self.quantity_g = (
            self.quantity * Decimal("1000") if self.unit == Unit.kg else self.quantity
        )
        return self


class FormulaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    pantone_color_id: int
    ingredients: list[IngredientIn] = Field(min_length=1)


class FormulaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    pantone_color_id: int | None = None
    ingredients: list[IngredientIn] | None = None


class FormulaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pantone_color_id: int
    name: str
    notes: str | None
    created_by: int
    created_at: datetime
    updated_at: datetime
    ingredients: list[IngredientOut]
