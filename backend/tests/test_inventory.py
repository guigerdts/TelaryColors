"""Inventory data layer integration tests (inventory spec "Inventory Data Model").

Slice A covers the additive ``0003_inventory`` migration: ``upgrade head`` must
create ``inventory_items`` + ``inventory_transactions`` beside the originals, and
``downgrade`` one step must drop ONLY the new tables and indexes, leaving every
Fase 1/2 table intact (inventory spec scenarios "Migration adds tables" and
"Downgrade is additive-safe").
"""

import sqlite3
import subprocess
import sys
from pathlib import Path

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
