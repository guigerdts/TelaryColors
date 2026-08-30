"""Inventory ORM models — ``inventory_items`` + ``inventory_transactions``
tables (inventory spec "Inventory Data Model", design Interfaces/Contracts).

``inventory_items`` records the tracked supplies (colorants and pasta-madre
inputs): ``item_type`` and ``reorder_threshold`` are indexed because listing
and the reorder-alert query filter on them. ``current_stock`` is the single
source of stock truth — it only changes through registered transactions (design
ADR-6: PATCH never touches it), and every movement writes a row in
``inventory_transactions`` atomically.

``inventory_transactions`` carries a signed ``quantity`` delta
(``current_stock += quantity``; ``entrada`` +, ``consumo``/``ajuste`` −, design
ADR-6), an optional ``formula_id`` linking a ``consumo`` to the production that
caused it, an optional ``design_id`` tagging a ``consumo`` with the design it
was made for (inventory spec "Design Reference on Consumption Transactions" —
nullable, never required, legacy rows unaffected), and the authenticated
``user_id`` that registered it. ``notes`` is free text, required by policy for
``ajuste`` and for negative resulting stock (enforced service-level in slice C,
spec "Negative Stock and Notes Policy").

Column types mirror Fase 1/2 conventions: enums as VARCHAR
(``native_enum=False``), quantities as fixed-precision ``Numeric`` (design
ADR-5), timestamps as naive-UTC DATETIME via the shared ``utcnow`` clock.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow
from app.db.enums import ItemType, TransactionType
from app.modules.designs.models import Design


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    item_type: Mapped[ItemType] = mapped_column(
        SAEnum(ItemType, native_enum=False, length=30),
        nullable=False,
        index=True,
    )
    unit: Mapped[str] = mapped_column(String, nullable=False)
    supplier: Mapped[str] = mapped_column(String, nullable=False)
    supply_city: Mapped[str] = mapped_column(String, nullable=False)
    current_stock: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0")
    )
    reorder_threshold: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, native_enum=False, length=30),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    formula_id: Mapped[int | None] = mapped_column(
        ForeignKey("formulas.id"), nullable=True
    )
    design_id: Mapped[int | None] = mapped_column(
        ForeignKey("designs.id"), nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)

    design: Mapped[Design | None] = relationship()