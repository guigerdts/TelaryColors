"""Sample ORM model — the ``samples`` table (samples spec "Sample Data Model").

A sample records a reusable near-miss tone: an optional photo, a target
Pantone (anchoring the reusable listing), an optional derived formula, a free
status lifecycle (``SampleStatus``), free-text notes, and an audit creator.

``pantone_target_id`` is NOT NULL and indexed because reusable samples are
listed by target Pantone (design ADR-6). ``formula_id`` and ``photo_url`` are
optional. ``status`` default ``archivada_reutilizable`` (register = near-miss,
design ADR-6) and is indexed because listing filters by it. ``created_at``
uses the shared ``utcnow`` naive-UTC clock.
"""

from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow
from app.db.enums import SampleStatus


class Sample(Base):
    __tablename__ = "samples"

    id: Mapped[int] = mapped_column(primary_key=True)
    pantone_target_id: Mapped[int] = mapped_column(
        ForeignKey("pantone_colors.id"), nullable=False, index=True
    )
    formula_id: Mapped[int | None] = mapped_column(
        ForeignKey("formulas.id"), nullable=True
    )
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[SampleStatus] = mapped_column(
        SAEnum(SampleStatus, native_enum=False, length=30),
        nullable=False,
        default=SampleStatus.archivada_reutilizable,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
