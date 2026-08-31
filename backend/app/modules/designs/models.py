"""Design ORM models — ``designs`` + ``design_colors`` tables (design Data
Model, designs spec).

The 1–7 color cardinality cannot be a SQLite CHECK (cross-row), so it is
enforced at the application layer in a transaction; the DB enforces the
``(design_id, pantone_color_id)`` unique pair here, preventing duplicate
references. Deleting a design cascades to its ``design_colors`` rows.

``Design.client``/``notes`` are the additive Fase 4 fields (designs spec
"Client Field"/"Notes Field") — both nullable, so existing rows and the
legacy CRUD contract are untouched (``0004_designs`` migration).

``FormulaDesign`` is the formula↔design usage link (formula-designs spec
"Formula-Design Link Data Model"): it sits beside — never replaces —
``design_colors`` because recipe-usage and color-composition are different
dimensions of a design. The ``UNIQUE(formula_id, design_id)`` table
constraint is the real database-level pair guarantee; a second row for the
same pair fails an IntegrityError at commit, not an application check.
"""

from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow
from app.db.enums import DesignSource, PaintType


class Design(Base):
    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    paint_type: Mapped[PaintType] = mapped_column(
        SAEnum(PaintType, native_enum=False, length=20),
        nullable=False,
    )
    client: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False
    )

    colors: Mapped[list["DesignColor"]] = relationship(
        back_populates="design",
        cascade="all, delete-orphan",
    )


class DesignColor(Base):
    __tablename__ = "design_colors"
    __table_args__ = (
        UniqueConstraint(
            "design_id", "pantone_color_id", name="uq_design_color"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    design_id: Mapped[int] = mapped_column(
        ForeignKey("designs.id", ondelete="CASCADE"), nullable=False
    )
    pantone_color_id: Mapped[int] = mapped_column(
        ForeignKey("pantone_colors.id"), nullable=False
    )

    design: Mapped[Design] = relationship(back_populates="colors")


class FormulaDesign(Base):
    """Join between a formula and a design that uses it (recipe-usage link).

    ``source`` records how the link was created: ``auto`` (tagged consumo)
    or ``manual`` (from the formula detail page). The UNIQUE pair constraint
    makes re-linking idempotent at the data layer: a duplicate pair cannot
    exist even if the application layer is bypassed (formula-designs spec
    "Formula-Design Link Data Model", design D2).
    """

    __tablename__ = "formula_designs"
    __table_args__ = (
        UniqueConstraint("formula_id", "design_id", name="uq_formula_design"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    formula_id: Mapped[int] = mapped_column(
        ForeignKey("formulas.id"), nullable=False
    )
    design_id: Mapped[int] = mapped_column(
        ForeignKey("designs.id"), nullable=False
    )
    source: Mapped[DesignSource] = mapped_column(
        SAEnum(DesignSource, native_enum=False, length=10),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
