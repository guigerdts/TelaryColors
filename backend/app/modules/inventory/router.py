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
- ``GET /inventory/items/{item_id}/transactions`` lists one item's movement
  history newest-first (``created_at DESC, id DESC``) with full traceability
  fields (design Interfaces/Contracts — type, qty, formula_id, user, notes,
  ts).
- ``GET /inventory/reorder-alerts`` lists items strictly below their reorder
  threshold (design ADR-1), grouped by ``supply_city`` then ``supplier`` for
  buy-route planning; every group item's derived status reads
  ``bajo_umbral`` through the SAME ``derive_status`` used by item read/list
  (design ADR-1/4).

Read-only requests never log; every domain write records one audit row with
the acting user (access-logs spec; samples/design convention).
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.enums import DesignSource, TransactionType
from app.modules.access_logs.service import log_action
from app.modules.designs.models import Design
from app.modules.formula_designs.router import upsert_formula_design
from app.modules.formulas.models import Formula
from app.modules.inventory.models import InventoryItem, InventoryTransaction
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemUpdate,
    InventoryTransactionCreate,
    InventoryTransactionHistoryOut,
    InventoryTransactionOut,
    ReorderAlertGroup,
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
    if payload.design_id is not None and db.get(Design, payload.design_id) is None:
        # Reject a dangling design tag before any write (design data flow:
        # validate formula_id & design_id exist, 400 otherwise).
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diseño no encontrado",
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
            design_id=payload.design_id,
            user_id=user.id,
            notes=payload.notes,
        )
        db.add(txn)
        db.flush()  # assign txn.id before the audit in the same transaction
        item.current_stock = resulting
        # Auto design link (design D6/D7, inventory spec "Automatic link from
        # tagged consumption"): a ``consumo`` carrying both IDs upserts a
        # ``formula_designs`` row with ``source=auto`` in THIS transaction.
        # The idempotent helper returns the existing pair (never duplicates,
        # never violates the real UNIQUE) and audits ``formula_design.create``
        # only for a genuinely new pair. Runs BEFORE the inventory.transaction
        # audit, so a later failure rolls the link back with everything else.
        if (
            payload.transaction_type == TransactionType.consumo
            and payload.formula_id is not None
            and payload.design_id is not None
        ):
            upsert_formula_design(
                db,
                formula_id=payload.formula_id,
                design_id=payload.design_id,
                source=DesignSource.auto,
                user_id=user.id,
            )
        log_action(db, user.id, "inventory.transaction")
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(item)
    db.refresh(txn)
    return txn


@router.get(
    "/items/{item_id}/transactions",
    response_model=list[InventoryTransactionHistoryOut],
)
def list_item_transactions(
    item_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[InventoryTransactionHistoryOut]:
    """Per-item transaction history, newest-first (inventory spec
    "Transaction History", design Interfaces/Contracts).

    Rows are ordered ``created_at DESC, id DESC`` — ``utcnow`` has second
    precision, so the id tie-break keeps the order deterministic for movements
    registered in the same second. Each row carries the full traceability
    fields (type, quantity, formula_id, the acting user's username, notes,
    timestamp). A missing item 404s with the module's exact detail; read-only
    requests never audit (module convention).
    """
    _get_item_or_404(db, item_id)
    rows = db.execute(
        select(InventoryTransaction, User.username)
        .join(User, User.id == InventoryTransaction.user_id)
        .where(InventoryTransaction.inventory_item_id == item_id)
        .order_by(
            InventoryTransaction.created_at.desc(),
            InventoryTransaction.id.desc(),
        )
    ).all()
    return [
        InventoryTransactionHistoryOut(
            id=txn.id,
            transaction_type=txn.transaction_type,
            quantity=txn.quantity,
            formula_id=txn.formula_id,
            user=username,
            notes=txn.notes,
            created_at=txn.created_at,
        )
        for txn, username in rows
    ]


@router.get("/reorder-alerts", response_model=list[ReorderAlertGroup])
def list_reorder_alerts(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ReorderAlertGroup]:
    """Items below their reorder threshold, grouped for buy-route planning
    (inventory spec "Reorder Alerts by City and Supplier", design ADR-1/4).

    The selection predicate is the ADR-1 strict inequality (``current_stock <
    reorder_threshold`` — the ``==`` boundary still reads ok), and every
    reported item's ``inventory_status`` is computed by the SAME
    ``derive_status`` shared with item list/read, so an alerted item always
    reads ``bajo_umbral`` and a threshold crossing flips the alert with no
    schema change. Groups are ordered by ``supply_city`` then ``supplier``;
    the response is ``[]`` when nothing is below threshold.
    """
    items = db.scalars(
        select(InventoryItem)
        .where(InventoryItem.current_stock < InventoryItem.reorder_threshold)
        .order_by(
            InventoryItem.supply_city,
            InventoryItem.supplier,
            InventoryItem.id,
        )
    ).all()
    grouped: dict[tuple[str, str], list[InventoryItemOut]] = {}
    for item in items:
        grouped.setdefault((item.supply_city, item.supplier), []).append(
            InventoryItemOut.from_item(item)
        )
    return [
        ReorderAlertGroup(
            supply_city=city, supplier=supplier, items=item_list
        )
        for (city, supplier), item_list in grouped.items()
    ]


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