"""Migration acceptance: the base migration builds the 7 original tables, the
additive ``0002_samples`` migration adds ``samples``, and the additive
``0003_inventory`` migration adds ``inventory_items`` + ``inventory_transactions``,
all idempotent.

Covers the base spec "Data Layer" + "Single Initial Migration" + the inventory
spec "Inventory Data Model": running ``alembic upgrade head`` on a clean
database creates all ten domain tables, and re-running it reports no pending
changes (nothing is added/removed on the second pass).
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

# The ten domain tables from the Data Model section of design.md plus the
# inventory data model (inventory spec "Inventory Data Model").
EXPECTED_TABLES = {
    "users",
    "access_logs",
    "pantone_colors",
    "formulas",
    "formula_ingredients",
    "designs",
    "design_colors",
    "samples",
    "inventory_items",
    "inventory_transactions",
}


def _run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    """Invoke the venv alembic against a caller-provided database file."""
    env = dict(os.environ)
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


def test_upgrade_head_creates_all_ten_tables(tmp_path) -> None:
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")

    assert result.returncode == 0, (
        f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}"
    )

    tables = _table_names(str(db))
    missing = EXPECTED_TABLES - tables
    assert not missing, f"migration created tables {sorted(tables)} but is missing {sorted(missing)}"
    assert EXPECTED_TABLES.issubset(tables)


def test_upgrade_head_is_idempotent(tmp_path) -> None:
    db = tmp_path / "app.db"
    first = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert first.returncode == 0, f"first upgrade failed:\n{first.stderr}"

    tables_after_first = _table_names(str(db))

    second = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert second.returncode == 0, f"second upgrade failed:\n{second.stderr}"

    # Re-running must not add, drop, or alter any table.
    assert _table_names(str(db)) == tables_after_first
