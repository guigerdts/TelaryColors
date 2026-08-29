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

import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.inventory.models import InventoryItem
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
