"""Design ORM models — ``designs`` + ``design_colors`` tables (design Data
Model, designs spec).

The 1–7 color cardinality cannot be a SQLite CHECK (cross-row), so it is
enforced at the application layer in a transaction; the DB enforces the
``(design_id, pantone_color_id)`` unique pair here, preventing duplicate
references. Deleting a design cascades to its ``design_colors`` rows.
"""

from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow
from app.db.enums import PaintType


class Design(Base):
    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    paint_type: Mapped[PaintType] = mapped_column(
        SAEnum(PaintType, native_enum=False, length=20),
        nullable=False,
    )
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
