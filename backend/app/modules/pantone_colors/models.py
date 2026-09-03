"""Pantone color ORM model — ``pantone_colors`` table (design Data Model,
pantone-colors spec).

``code`` + ``paint_type`` together are unique: the same Pantone code (e.g.
"Black") can exist once per paint type (reactiva / pigmento).  ``code`` is
indexed for instant prefix search (``?q=221``).  ``gamut`` defaults to ``C``.
"""

from datetime import datetime

from sqlalchemy import Enum as SAEnum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow
from app.db.enums import PaintType


class PantoneColor(Base):
    __tablename__ = "pantone_colors"
    __table_args__ = (
        UniqueConstraint("code", "paint_type", name="uq_pantone_code_paint_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    gamut: Mapped[str] = mapped_column(
        String, nullable=False, default="C", server_default="C"
    )
    paint_type: Mapped[PaintType] = mapped_column(
        SAEnum(PaintType, native_enum=False, length=20),
        nullable=False,
    )
    hex_color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
