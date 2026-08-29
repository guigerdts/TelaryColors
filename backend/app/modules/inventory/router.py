"""Inventory item CRUD routes (inventory spec "Inventory Item CRUD", design
module layout — mirrors the samples router pattern).

- ``GET /inventory/items`` lists every item newest-first, each with its
  derived ``inventory_status`` (design ADR-1/4, read-time computation).
- ``POST /inventory/items`` creates an item with an optional initial
  ``current_stock``, auditing exactly one ``inventory.item.create`` row in the
  same transaction (spec S3).
- ``GET/PATCH /inventory/items/{item_id}`` read/update by id (404 missing,
  detail "Artículo de inventario no encontrado"). PATCH is scoped to
  ``name``/``item_type``/``unit``/``supplier``/``supply_city``/
  ``reorder_threshold``: ``current_stock`` is absent from the schema (design
  ADR-6 — stock moves only through transactions), and a real change audits
  exactly one ``inventory.item.update`` row. There is NO DELETE route —
  items are never hard-deleted (405).

Read-only requests never log; every domain write records one audit row with
the acting user (access-logs spec; samples/design convention).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.modules.access_logs.service import log_action
from app.modules.inventory.models import InventoryItem
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _get_item_or_404(db: Session, item_id: int) -> InventoryItem:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artículo de inventario no encontrado",
        )
    return item


@router.get("/items", response_model=list[InventoryItemOut])
def list_items(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[InventoryItemOut]:
    """List all items newest-first, each with its derived stock status."""
    items = db.scalars(
        select(InventoryItem).order_by(
            InventoryItem.created_at.desc(), InventoryItem.id.desc()
        )
    ).all()
    return [InventoryItemOut.from_item(item) for item in items]


@router.post(
    "/items", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED
)
def create_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InventoryItemOut:
    """Create an item with its optional initial stock; audit the creation."""
    item = InventoryItem(
        name=payload.name,
        item_type=payload.item_type,
        unit=payload.unit,
        supplier=payload.supplier,
        supply_city=payload.supply_city,
        current_stock=payload.current_stock,
        reorder_threshold=payload.reorder_threshold,
    )
    db.add(item)
    db.flush()  # assign the id before auditing in the same transaction
    log_action(db, user.id, "inventory.item.create")
    db.commit()
    db.refresh(item)
    return InventoryItemOut.from_item(item)


@router.get("/items/{item_id}", response_model=InventoryItemOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> InventoryItemOut:
    """Read a single item with its derived stock status (404 if missing)."""
    return InventoryItemOut.from_item(_get_item_or_404(db, item_id))


@router.patch("/items/{item_id}", response_model=InventoryItemOut)
def update_item(
    item_id: int,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InventoryItemOut:
    """Update mutable fields; never ``current_stock`` (design ADR-6).

    A PATCH that actually changes a field audits exactly one
    ``inventory.item.update`` row in the same transaction; a no-op PATCH
    writes nothing and is not audited.
    """
    item = _get_item_or_404(db, item_id)
    changed = False
    if payload.name is not None and payload.name != item.name:
        item.name = payload.name
        changed = True
    if payload.item_type is not None and payload.item_type != item.item_type:
        item.item_type = payload.item_type
        changed = True
    if payload.unit is not None and payload.unit != item.unit:
        item.unit = payload.unit
        changed = True
    if payload.supplier is not None and payload.supplier != item.supplier:
        item.supplier = payload.supplier
        changed = True
    if payload.supply_city is not None and payload.supply_city != item.supply_city:
        item.supply_city = payload.supply_city
        changed = True
    if (
        payload.reorder_threshold is not None
        and payload.reorder_threshold != item.reorder_threshold
    ):
        item.reorder_threshold = payload.reorder_threshold
        changed = True
    if changed:
        log_action(db, user.id, "inventory.item.update")
    db.commit()
    db.refresh(item)
    return InventoryItemOut.from_item(item)