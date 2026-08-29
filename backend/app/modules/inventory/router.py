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
- ``POST /inventory/items/{item_id}/transactions`` atomically registers one
  stock movement in a single transaction — txn row + ``current_stock`` signed
  delta + exactly one ``inventory.transaction`` audit row (promote_sample
  pattern, design ADR-2/6); the notes policy is validated service-level
  BEFORE the mutation txn, so a 400 leaves zero residues (design ADR-3).

Read-only requests never log; every domain write records one audit row with
the acting user (access-logs spec; samples/design convention).
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.enums import TransactionType
from app.modules.access_logs.service import log_action
from app.modules.formulas.models import Formula
from app.modules.inventory.models import InventoryItem, InventoryTransaction
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemUpdate,
    InventoryTransactionCreate,
    InventoryTransactionOut,
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


@router.post(
    "/items/{item_id}/transactions",
    response_model=InventoryTransactionOut,
    status_code=status.HTTP_201_CREATED,
)
def register_transaction(
    item_id: int,
    payload: InventoryTransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InventoryTransaction:
    """Atomically register one stock movement (inventory spec "Atomic Stock
    Transaction", design ADR-2/3/6).

    One transaction inserts the ``inventory_transactions`` row (flush assigns
    its id), applies the signed delta ``item.current_stock += quantity``
    (design ADR-6 — ``entrada`` +, ``consumo``/``ajuste`` −; PATCH never
    touches stock, so transactions are the only mover), and writes exactly ONE
    ``inventory.transaction`` audit row — copied from ``promote_sample``
    (samples/router.py): add + flush, mutate the related row, log in the same
    transaction, commit; any mid-way failure rolls everything back so nothing
    persists (spec S7).

    The notes policy is validated service-level BEFORE the mutation txn opens
    (design ADR-3): ``ajuste`` always requires a non-empty note, and a
    resulting stock below zero requires a note with the exact rejection
    message; because the decision happens before any DB write, a 400 leaves
    zero residues (no txn row, no stock change, no audit row).
    """
    item = _get_item_or_404(db, item_id)
    if payload.formula_id is not None and db.get(Formula, payload.formula_id) is None:
        # Reject a dangling formula reference before any write (C.7 contract).
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fórmula no encontrada",
        )
    resulting = item.current_stock + payload.quantity  # in-memory, pre-txn
    violation = _notes_policy_violation(payload.transaction_type, payload.notes, resulting)
    if violation is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=violation
        )
    try:
        txn = InventoryTransaction(
            inventory_item_id=item.id,
            transaction_type=payload.transaction_type,
            quantity=payload.quantity,
            formula_id=payload.formula_id,
            user_id=user.id,
            notes=payload.notes,
        )
        db.add(txn)
        db.flush()  # assign txn.id before the audit in the same transaction
        item.current_stock = resulting
        log_action(db, user.id, "inventory.transaction")
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(item)
    db.refresh(txn)
    return txn


def _notes_policy_violation(
    transaction_type: TransactionType,
    notes: str | None,
    resulting: Decimal,
) -> str | None:
    """Return the 400 detail for a notes-policy violation, else ``None``
    (design ADR-3 — evaluated service-level, before the mutation txn opens).

    ``ajuste`` always requires a non-empty note; a resulting stock below zero
    requires a non-empty note with the EXACT spec message. Other types and
    in-stock movements may omit notes.
    """
    has_notes = bool((notes or "").strip())
    if transaction_type == TransactionType.ajuste and not has_notes:
        return "las transacciones de tipo ajuste requieren una nota"
    if resulting < 0 and not has_notes:
        return "las transacciones que dejan stock negativo requieren una nota"
    return None