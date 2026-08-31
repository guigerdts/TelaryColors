"""Pydantic schemas for the inventory API (inventory spec, design module layout).

``InventoryItemCreate`` accepts the tracked fields (``current_stock`` is the
initial value and defaults to zero), ``InventoryItemUpdate`` exposes the mutable
fields and deliberately omits ``current_stock`` (stock only moves through
transactions — design ADR-6), ``InventoryItemOut`` mirrors the ORM row plus the
derived ``inventory_status`` computed by ``derive_status`` at read time
(design ADR-1/4 — never stored, flips with no migration), and the transaction
schemas carry the signed ``quantity`` delta plus the nullable ``formula_id``
linking a ``consumo`` to its production.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import ItemType, TransactionType
from app.modules.inventory.models import InventoryItem


class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    item_type: ItemType
    unit: str = Field(min_length=1, max_length=20)
    supplier: str = Field(min_length=1, max_length=200)
    supply_city: str = Field(min_length=1, max_length=200)
    current_stock: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_threshold: Decimal = Field(default=Decimal("0"), ge=0)


class InventoryItemUpdate(BaseModel):
    # current_stock is intentionally absent: stock moves only via transactions
    # (design ADR-6), so a PATCH can never drift the sum invariant.
    name: str | None = Field(default=None, min_length=1, max_length=200)
    item_type: ItemType | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    supplier: str | None = Field(default=None, min_length=1, max_length=200)
    supply_city: str | None = Field(default=None, min_length=1, max_length=200)
    reorder_threshold: Decimal | None = Field(default=None, ge=0)


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    item_type: ItemType
    unit: str
    supplier: str
    supply_city: str
    current_stock: Decimal
    reorder_threshold: Decimal
    # Computed at read time by ``derive_status`` (design ADR-1/4); the default
    # is replaced by ``from_item`` — it exists only so ``model_validate(item)``
    # succeeds on an ORM row (which has no such attribute).
    inventory_status: Literal["ok", "bajo_umbral"] = "ok"
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_item(cls, item: InventoryItem) -> "InventoryItemOut":
        """Serialize an ORM row, computing its derived stock status (ADR-1/4)."""
        return cls.model_validate(item).model_copy(
            update={"inventory_status": derive_status(item)}
        )


def derive_status(item: InventoryItem) -> Literal["ok", "bajo_umbral"]:
    """Binary stock status at read time (design ADR-1/4).

    At or above the reorder threshold reads ``ok`` — inclusive, so
    ``current_stock == reorder_threshold`` is still ``ok`` (spec scenario
    "Indicator flips without schema change"); only strictly below reads
    ``bajo_umbral``. Computed on read, never stored; a threshold crossing
    flips the status with no migration or recalc job. Shared by the item
    list/read endpoints and the slice-D reorder alerts.
    """
    return "ok" if item.current_stock >= item.reorder_threshold else "bajo_umbral"


class InventoryTransactionCreate(BaseModel):
    transaction_type: TransactionType
    quantity: Decimal
    formula_id: int | None = None
    design_id: int | None = None
    notes: str | None = Field(default=None, max_length=1000)


class InventoryTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inventory_item_id: int
    transaction_type: TransactionType
    quantity: Decimal
    formula_id: int | None
    user_id: int
    notes: str | None
    created_at: datetime


class InventoryTransactionHistoryOut(BaseModel):
    """One per-item history row (design Interfaces/Contracts: type, qty,
    formula_id, user, notes, ts; spec "Transaction History").

    ``user`` is the acting user's username — the traceability identity who
    registered the movement. ``created_at`` is the design's "ts" shorthand,
    named to match every other timestamp field in this module.
    """

    id: int
    transaction_type: TransactionType
    quantity: Decimal
    formula_id: int | None
    user: str
    notes: str | None
    created_at: datetime


class ReorderAlertGroup(BaseModel):
    """One (``supply_city``, ``supplier``) group of items strictly below their
    reorder threshold (design ADR-1 — reorder alert read flow).

    Every item's ``inventory_status`` is computed by the SAME ``derive_status``
    shared with item list/read (ADR-1/4), so a group item always reads
    ``bajo_umbral`` and a threshold crossing flips the alert with no schema
    change.
    """

    supply_city: str
    supplier: str
    items: list[InventoryItemOut]