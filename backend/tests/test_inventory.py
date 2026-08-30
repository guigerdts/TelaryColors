"""Inventory data layer + item CRUD integration tests (inventory spec).

Slice A covers the additive ``0003_inventory`` migration: ``upgrade head`` must
create ``inventory_items`` + ``inventory_transactions`` beside the originals, and
``downgrade`` one step must drop ONLY the new tables and indexes, leaving every
Fase 1/2 table intact (inventory spec scenarios "Migration adds tables" and
"Downgrade is additive-safe").

Slice B covers the item CRUD endpoints (inventory spec "Inventory Item CRUD")
and the derived binary stock status (spec "Binary Stock Status at Read Time",
design ADR-1/4/6): create returns 201 with exactly one ``inventory.item.create``
audit row; PATCH of supplier/threshold persists and audits exactly one
``inventory.item.update`` row; missing items 404 on GET and PATCH; a PATCH body
carrying ``current_stock`` never changes the stock (ADR-6 — the schema rejects
the field, stock only moves through transactions); and the ADR-1 boundary is
inclusive — ``current_stock == reorder_threshold`` reads ``ok``, strictly below
reads ``bajo_umbral``, above reads ``ok``.
"""

import sqlite3
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest
import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.inventory.models import InventoryItem, InventoryTransaction
from app.modules.users.models import User

BACKEND_DIR = Path(__file__).resolve().parents[1]

# The seven Fase 1/2 tables plus ``samples`` that ``0003_inventory`` must NOT touch.
PRE_INVENTORY_TABLES = {
    "users",
    "access_logs",
    "pantone_colors",
    "formulas",
    "formula_ingredients",
    "designs",
    "design_colors",
    "samples",
}

NEW_INVENTORY_TABLES = {"inventory_items", "inventory_transactions"}


def _run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    """Invoke the venv alembic against a caller-provided database file."""
    env = dict(__import__("os").environ)
    env["DATABASE_URL"] = database_url
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def _table_names(db_path: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        return {row[0] for row in rows}
    finally:
        conn.close()


def test_upgrade_head_adds_inventory_tables(tmp_path) -> None:
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")

    assert result.returncode == 0, (
        f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}"
    )

    tables = _table_names(str(db))
    assert NEW_INVENTORY_TABLES.issubset(tables), (
        f"head is missing new inventory tables {sorted(NEW_INVENTORY_TABLES - tables)}"
    )
    assert PRE_INVENTORY_TABLES.issubset(tables), (
        "0003_inventory must not drop existing tables"
    )


def test_downgrade_drops_only_new_inventory_tables(tmp_path) -> None:
    db = tmp_path / "app.db"
    up = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert up.returncode == 0, f"upgrade head failed:\n{up.stderr}"

    down = _run_alembic(f"sqlite:///{db}", "downgrade", "-1")
    assert down.returncode == 0, f"downgrade -1 failed:\n{down.stdout}\n{down.stderr}"

    tables_after = _table_names(str(db))
    # Only the new inventory tables (and their indexes) drop.
    assert NEW_INVENTORY_TABLES.isdisjoint(tables_after), (
        "downgrade must drop the new inventory tables"
    )
    assert PRE_INVENTORY_TABLES.issubset(tables_after), (
        "downgrade must leave Fase 1/2 tables intact"
    )


# --- Slice B: item CRUD + derived binary stock status -----------------------
#
# Inventory spec "Inventory Item CRUD" (S3 create audited, S4 update audited)
# and "Binary Stock Status at Read Time" (S5 at-or-above reads ok, S6 flips
# without schema change); design ADR-1 (inclusive threshold — the ``==`` case
# must read ``ok``, not ``bajo_umbral``) and ADR-6 (PATCH never touches
# ``current_stock``; stock moves only through transactions).

DEFAULT_ITEM = {
    "name": "Colorante Azul",
    "item_type": "colorante",
    "unit": "kg",
    "supplier": "Proveedor Central",
    "supply_city": "Rosario",
    "current_stock": 10,
    "reorder_threshold": 3,
}


def _create_item(client, headers, **overrides) -> dict:
    payload = {**DEFAULT_ITEM, **overrides}
    response = client.post("/api/v1/inventory/items", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()


def _admin_id(session_factory) -> int:
    with session_factory() as db:
        return db.scalar(sa.select(User.id).where(User.username == "admin"))


def test_create_item_persists_with_exactly_one_audit_row(
    client, auth_headers, session_factory
) -> None:
    """S3 Create item with threshold: 201, persisted, exactly one audit row."""
    headers = auth_headers("admin")

    created = _create_item(client, headers, current_stock=10, reorder_threshold=3)

    assert created["name"] == "Colorante Azul"
    assert created["item_type"] == "colorante"
    assert created["supply_city"] == "Rosario"
    admin_id = _admin_id(session_factory)
    with session_factory() as db:
        item = db.get(InventoryItem, created["id"])
        assert item is not None
        assert item.current_stock == Decimal("10")
        assert item.reorder_threshold == Decimal("3")
        create_rows = db.execute(
            sa.select(AccessLog.user_id).where(
                AccessLog.action == "inventory.item.create"
            )
        ).all()
        assert len(create_rows) == 1, (
            "create must write exactly one inventory.item.create audit row"
        )
        assert create_rows[0][0] == admin_id


def test_patch_supplier_and_threshold_persists_and_is_audited(
    client, auth_headers, session_factory
) -> None:
    """S4 Update supplier or threshold: change persists + exactly one audit."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers)["id"]

    patched = client.patch(
        f"/api/v1/inventory/items/{item_id}",
        headers=headers,
        json={"supplier": "Nuevo Proveedor", "reorder_threshold": 8},
    )
    assert patched.status_code == 200
    assert patched.json()["supplier"] == "Nuevo Proveedor"
    assert patched.json()["reorder_threshold"] == "8.0000"

    with session_factory() as db:
        item = db.get(InventoryItem, item_id)
        assert item.supplier == "Nuevo Proveedor"
        assert item.reorder_threshold == Decimal("8")
    admin_id = _admin_id(session_factory)
    with session_factory() as db:
        update_rows = db.execute(
            sa.select(AccessLog.user_id).where(
                AccessLog.action == "inventory.item.update"
            )
        ).all()
        assert len(update_rows) == 1, (
            "patch must write exactly one inventory.item.update audit row"
        )
        assert update_rows[0][0] == admin_id


def test_get_and_patch_missing_item_return_404(client, auth_headers) -> None:
    """Missing item: GET and PATCH both 404 (never created, never updated)."""
    headers = auth_headers("admin")

    fetched = client.get("/api/v1/inventory/items/99999", headers=headers)
    assert fetched.status_code == 404
    assert fetched.json()["detail"] == "Artículo de inventario no encontrado"

    patched = client.patch(
        "/api/v1/inventory/items/99999",
        headers=headers,
        json={"supplier": "Nadie"},
    )
    assert patched.status_code == 404
    assert patched.json()["detail"] == "Artículo de inventario no encontrado"


def test_patch_with_current_stock_leaves_stock_unchanged(
    client, auth_headers, session_factory
) -> None:
    """ADR-6: PATCH body carrying current_stock must not move the stock —
    the schema rejects the field (stock changes only via transactions)."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    patched = client.patch(
        f"/api/v1/inventory/items/{item_id}",
        headers=headers,
        json={"current_stock": 999, "supplier": "Otro Proveedor"},
    )
    assert patched.status_code == 200

    with session_factory() as db:
        item = db.get(InventoryItem, item_id)
        assert item.current_stock == Decimal("10"), (
            "PATCH must never change current_stock (ADR-6)"
        )
        assert item.supplier == "Otro Proveedor"


def test_status_at_threshold_is_ok(client, auth_headers) -> None:
    """ADR-1 boundary (inclusive): current_stock == reorder_threshold reads ok."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=5, reorder_threshold=5)["id"]

    fetched = client.get(f"/api/v1/inventory/items/{item_id}", headers=headers)

    assert fetched.status_code == 200
    assert fetched.json()["inventory_status"] == "ok"


def test_status_below_threshold_is_bajo_umbral(client, auth_headers) -> None:
    """ADR-1: current_stock < reorder_threshold reads bajo_umbral."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=4, reorder_threshold=5)["id"]

    fetched = client.get(f"/api/v1/inventory/items/{item_id}", headers=headers)

    assert fetched.status_code == 200
    assert fetched.json()["inventory_status"] == "bajo_umbral"


def test_status_above_threshold_is_ok(client, auth_headers) -> None:
    """ADR-1: current_stock > reorder_threshold reads ok."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=6, reorder_threshold=5)["id"]

    fetched = client.get(f"/api/v1/inventory/items/{item_id}", headers=headers)

    assert fetched.status_code == 200
    assert fetched.json()["inventory_status"] == "ok"


def test_list_items_carries_per_item_status(client, auth_headers) -> None:
    """Design contract: GET /inventory/items lists each item with its status."""
    headers = auth_headers("admin")
    low_id = _create_item(client, headers, name="Bajo", current_stock=2, reorder_threshold=5)["id"]
    high_id = _create_item(client, headers, name="Alto", current_stock=7, reorder_threshold=5)["id"]

    listing = client.get("/api/v1/inventory/items", headers=headers)

    assert listing.status_code == 200
    by_id = {row["id"]: row for row in listing.json()}
    assert by_id[low_id]["inventory_status"] == "bajo_umbral"
    assert by_id[high_id]["inventory_status"] == "ok"


# --- Slice C: atomic stock transaction + notes policy (RED first) -----------
#
# Inventory spec "Atomic Stock Transaction" (S6 happy path, S7 rollback) and
# "Negative Stock and Notes Policy" (S8 negative w/ note, S9 negative w/o note,
# S10 ajuste w/o notes, S11 in-stock w/o note); design ADR-2 (ONE atomic
# endpoint — txn row + stock delta + audit in a single transaction, verbatim
# promote_sample pattern), ADR-3 (notes policy validated service-level BEFORE
# the mutation txn — a 400 leaves zero residues), ADR-6 (signed delta:
# ``current_stock += quantity``; the client sends the stock change, so
# ``entrada`` carries a positive delta and ``consumo``/``ajuste`` negative
# ones). Every test asserts the DB state, not just the HTTP status, so a
# partial write is impossible to miss.

TRANSACTION_AUDIT_ACTION = "inventory.transaction"


def _stock_of(session_factory, item_id: int) -> Decimal:
    with session_factory() as db:
        item = db.get(InventoryItem, item_id)
        assert item is not None
        return item.current_stock


def _transaction_row_count(session_factory) -> int:
    with session_factory() as db:
        return db.execute(
            sa.select(sa.func.count()).select_from(InventoryTransaction)
        ).scalar_one()


def _transaction_audit_rows(session_factory) -> list:
    with session_factory() as db:
        return db.execute(
            sa.select(AccessLog.user_id).where(
                AccessLog.action == TRANSACTION_AUDIT_ACTION
            )
        ).all()


def test_transaction_happy_path_persists_stock_delta_and_one_audit(
    client, auth_headers, session_factory
) -> None:
    """S6 Happy path: 201 with the txn row + the stock delta + EXACTLY ONE
    ``inventory.transaction`` audit row persisted atomically (ADR-2)."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]
    admin_id = _admin_id(session_factory)

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={"transaction_type": "entrada", "quantity": 5},
    )

    assert response.status_code == 201
    txn = response.json()
    assert txn["transaction_type"] == "entrada"
    assert txn["inventory_item_id"] == item_id
    assert Decimal(txn["quantity"]) == Decimal("5")
    assert txn["formula_id"] is None
    assert txn["notes"] is None

    with session_factory() as db:
        stored = db.get(InventoryTransaction, txn["id"])
        assert stored is not None
        assert stored.inventory_item_id == item_id
        assert stored.user_id == admin_id
        assert stored.quantity == Decimal("5")
    assert _stock_of(session_factory, item_id) == Decimal("15"), (
        "current_stock must apply the signed delta (10 + 5)"
    )
    audit_rows = _transaction_audit_rows(session_factory)
    assert len(audit_rows) == 1, (
        "exactly ONE inventory.transaction audit row on the happy path"
    )
    assert audit_rows[0][0] == admin_id


def test_transaction_failure_rolls_back_within_transaction(
    client, auth_headers, session_factory, monkeypatch
) -> None:
    """S7 Rollback: an audit write monkeypatched to raise AFTER the txn insert
    and the stock mutation have been staged must leave NOTHING persisted — no
    txn row, stock unchanged, no audit row. Mirrors Fase 2's
    ``test_promote_failure_rolls_back_within_transaction`` technique exactly
    (TestClient re-raises the server exception, so we assert the propagation
    AND the rollback)."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    def _boom(_db, _user_id, _action):
        raise RuntimeError("simulated inventory.transaction audit failure")

    monkeypatch.setattr("app.modules.inventory.router.log_action", _boom)

    with pytest.raises(RuntimeError, match="simulated inventory.transaction audit failure"):
        client.post(
            f"/api/v1/inventory/items/{item_id}/transactions",
            headers=headers,
            json={"transaction_type": "consumo", "quantity": -3},
        )

    assert _stock_of(session_factory, item_id) == Decimal("10"), (
        "rolled-back failure must leave current_stock unchanged"
    )
    assert _transaction_row_count(session_factory) == 0, (
        "rolled-back failure must leave no transaction row"
    )
    assert _transaction_audit_rows(session_factory) == [], (
        "rolled-back failure must leave no inventory.transaction audit row"
    )


def test_negative_resulting_stock_without_notes_rejected(
    client, auth_headers, session_factory
) -> None:
    """S9: a consumo that would leave stock negative without notes is rejected
    with 400 and the EXACT message; nothing persists (ADR-3 pre-txn 400)."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={"transaction_type": "consumo", "quantity": -15},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "las transacciones que dejan stock negativo requieren una nota"
    )
    assert _stock_of(session_factory, item_id) == Decimal("10"), (
        "rejected transaction must leave current_stock untouched"
    )
    assert _transaction_row_count(session_factory) == 0, (
        "rejected transaction must write no transaction row"
    )
    assert _transaction_audit_rows(session_factory) == [], (
        "rejected transaction must write no audit row"
    )


def test_ajuste_without_notes_rejected_even_when_stock_stays_positive(
    client, auth_headers, session_factory
) -> None:
    """S10: an ajuste with empty notes is rejected with 400 even when the
    resulting stock stays at or above zero; nothing persists (ADR-3)."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={"transaction_type": "ajuste", "quantity": -2},
    )

    assert response.status_code == 400
    assert _stock_of(session_factory, item_id) == Decimal("10"), (
        "rejected ajuste must leave current_stock untouched"
    )
    assert _transaction_row_count(session_factory) == 0, (
        "rejected ajuste must write no transaction row"
    )
    assert _transaction_audit_rows(session_factory) == [], (
        "rejected ajuste must write no audit row"
    )


def test_negative_resulting_stock_with_note_succeeds(
    client, auth_headers, session_factory
) -> None:
    """S8: a consumo leaving stock NEGATIVE is permitted with a non-empty note
    — negative stock is allowed, the note carries the explanation."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={
            "transaction_type": "consumo",
            "quantity": -15,
            "notes": "compra en tránsito, stock negativo temporal",
        },
    )

    assert response.status_code == 201
    assert Decimal(response.json()["quantity"]) == Decimal("-15")
    assert response.json()["notes"] == "compra en tránsito, stock negativo temporal"
    assert _stock_of(session_factory, item_id) == Decimal("-5"), (
        "negative resulting stock must persist (10 - 15)"
    )
    assert _transaction_row_count(session_factory) == 1
    assert len(_transaction_audit_rows(session_factory)) == 1


def test_in_stock_consumo_without_note_succeeds(
    client, auth_headers, session_factory
) -> None:
    """S11: a consumo keeping stock at or above zero persists without notes —
    notes are mandatory only for negative resulting stock and for ajuste."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={"transaction_type": "consumo", "quantity": -3},
    )

    assert response.status_code == 201
    assert _stock_of(session_factory, item_id) == Decimal("7"), (
        "in-stock consumo without notes must persist (10 - 3)"
    )
    assert _transaction_row_count(session_factory) == 1
    assert len(_transaction_audit_rows(session_factory)) == 1


def test_transaction_with_unknown_formula_id_rejected(
    client, auth_headers, session_factory
) -> None:
    """C.7 contract: a transaction carrying a formula_id that does not exist is
    rejected (400) before any write — no dangling FK reference, nothing
    persists."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    response = client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json={"transaction_type": "consumo", "quantity": -3, "formula_id": 99999},
    )

    assert response.status_code == 400
    assert _stock_of(session_factory, item_id) == Decimal("10")
    assert _transaction_row_count(session_factory) == 0
    assert _transaction_audit_rows(session_factory) == []


def test_signed_delta_entrada_adds_consumo_ajuste_subtract(
    client, auth_headers, session_factory
) -> None:
    """ADR-6 signed-delta semantics: the client sends the stock CHANGE and the
    server applies ``current_stock += quantity`` — entrada +5 ADDS (10 → 15),
    consumo −3 SUBTRACTS (15 → 12), ajuste −2 SUBTRACTS (12 → 10). Each leg is
    its own atomic transaction with one audit row."""
    headers = auth_headers("admin")
    item_id = _create_item(client, headers, current_stock=10)["id"]

    legs = [
        ({"transaction_type": "entrada", "quantity": 5}, Decimal("15"), None),
        ({"transaction_type": "consumo", "quantity": -3}, Decimal("12"), None),
        (
            {
                "transaction_type": "ajuste",
                "quantity": -2,
                "notes": "corrección de inventario",
            },
            Decimal("10"),
            "corrección de inventario",
        ),
    ]
    for payload, expected_stock, expected_notes in legs:
        response = client.post(
            f"/api/v1/inventory/items/{item_id}/transactions",
            headers=headers,
            json=payload,
        )
        assert response.status_code == 201, f"leg {payload} must succeed"
        assert _stock_of(session_factory, item_id) == expected_stock, (
            f"leg {payload['transaction_type']} must apply its signed delta"
        )
        assert response.json()["notes"] == expected_notes

    assert _transaction_row_count(session_factory) == 3, (
        "each leg must persist its own transaction row"
    )
    assert len(_transaction_audit_rows(session_factory)) == 3, (
        "each leg must write exactly one inventory.transaction audit row"
    )
