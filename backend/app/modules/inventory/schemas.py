"""Pydantic schemas for the inventory API (inventory spec, design module layout).

Slice A defines the data-model shapes only: ``InventoryItemCreate`` accepts the
tracked fields (``current_stock`` is the initial value and defaults to zero),
``InventoryItemUpdate`` exposes the mutable fields and deliberately omits
``current_stock`` (stock only moves through transactions — design ADR-6),
``InventoryItemOut`` mirrors the ORM row, and the transaction schemas carry the
signed ``quantity`` delta plus the nullable ``formula_id`` linking a ``consumo``
to its production.

The derived ``inventory_status`` field (``ok``/``bajo_umbral``, design ADR-1/4)
and the ``derive_status`` helper are added in slice B together with the read
endpoints that use them, driven by their own RED tests; they are computed at
read time and never stored.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import ItemType, TransactionType


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
    created_at: datetime
    updated_at: datetime


class InventoryTransactionCreate(BaseModel):
    transaction_type: TransactionType
    quantity: Decimal
    formula_id: int | None = None
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