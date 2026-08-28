"""Formula ORM models — ``formulas`` + ``formula_ingredients`` tables
(design Data Model, formulas spec).

``quantity`` is a fixed-precision ``Numeric`` (no FP loss, design ADR-5);
``unit`` is validated as ``g``/``kg`` (VARCHAR column). Deleting a formula
cascades to its ingredients at both the DB level (``ondelete=CASCADE``)
and the ORM level (``delete-orphan``).
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow
from app.db.enums import Unit


class Formula(Base):
    __tablename__ = "formulas"

    id: Mapped[int] = mapped_column(primary_key=True)
    pantone_color_id: Mapped[int] = mapped_column(
        ForeignKey("pantone_colors.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False
    )

    ingredients: Mapped[list["FormulaIngredient"]] = relationship(
        back_populates="formula",
        cascade="all, delete-orphan",
    )


class FormulaIngredient(Base):
    __tablename__ = "formula_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    formula_id: Mapped[int] = mapped_column(
        ForeignKey("formulas.id", ondelete="CASCADE"), nullable=False
    )
    colorant: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    unit: Mapped[Unit] = mapped_column(
        SAEnum(Unit, native_enum=False, length=10),
        nullable=False,
    )

    formula: Mapped[Formula] = relationship(back_populates="ingredients")
