"""Migration acceptance: the base migration builds the 7 original tables, the
additive ``0002_samples`` migration adds ``samples``, the additive
``0003_inventory`` migration adds ``inventory_items`` + ``inventory_transactions``,
and the additive ``0004_designs`` migration adds ``formula_designs`` plus the
nullable ``client``/``notes`` columns on ``designs`` and the nullable
``design_id`` on ``inventory_transactions`` — all idempotent.

Covers the base spec "Data Layer" + "Single Initial Migration", the inventory
spec "Inventory Data Model", and the formula-designs spec "Formula-Design Link
Data Model": running ``alembic upgrade head`` on a clean database creates all
eleven domain tables with a real ``UNIQUE(formula_id, design_id)`` constraint
on ``formula_designs``, and re-running it reports no pending changes (nothing
is added/removed on the second pass). The ``0004`` downgrade is
additive-safe: it drops only the new table and columns, leaving every Fase
1/2/3 table and row intact (spec scenarios "Downgrade is additive-safe").
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]

# The eleven domain tables from the Data Model section of design.md plus the
# inventory data model (inventory spec "Inventory Data Model") and the
# formula-designs join (formula-designs spec "Formula-Design Link Data Model").
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
    "formula_designs",
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


def _column_names(db_path: str, table: str) -> set[str]:
    """The column names of ``table`` via PRAGMA table_info."""
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        return {row[1] for row in rows}
    finally:
        conn.close()


def _unique_indexes(db_path: str, table: str) -> list[tuple[str, list[str]]]:
    """``(index_name, [columns...])`` for each UNIQUE index on ``table``.

    SQLAlchemy's ``UniqueConstraint`` inside ``create_table`` materialises as
    a UNIQUE index in SQLite (PRAGMA index_list row: ``unique=1``, origin
    ``u``); the columns come from PRAGMA index_info. This is the real
    database-level constraint the formula-designs spec requires.
    """
    conn = sqlite3.connect(db_path)
    try:
        indexes = conn.execute(f"PRAGMA index_list({table})").fetchall()
        result = []
        for _seq, name, unique, _origin, _partial in indexes:
            if not unique:
                continue
            info = conn.execute(f"PRAGMA index_info({name})").fetchall()
            result.append((name, [row[2] for row in info]))
        return result
    finally:
        conn.close()


# Minimal NOT-NULL values for one representative row per Fase 1/2/3 table, so
# the downgrade test can prove pre-existing DATA (not just tables) survives
# the additive ``0004`` downgrade.
PRE_0004_ROWS = {
    "users": {
        "username": "seed-user",
        "password_hash": "x",
        "role": "admin",
        "created_at": "2026-01-01 00:00:00",
    },
    "pantone_colors": {
        "code": "221C",
        "gamut": "C",
        "paint_type": "reactiva",
        "created_at": "2026-01-01 00:00:00",
    },
    "access_logs": {
        "user_id": 1,
        "timestamp": "2026-01-01 00:00:00",
        "action": "seed.probe",
    },
    "formulas": {
        "pantone_color_id": 1,
        "name": "Formula Base",
        "created_by": 1,
        "created_at": "2026-01-01 00:00:00",
        "updated_at": "2026-01-01 00:00:00",
    },
    "formula_ingredients": {
        "formula_id": 1,
        "colorant": "Base Blanca",
        "quantity": 100,
        "unit": "g",
    },
    "designs": {
        "name": "Diseno Fase1",
        "paint_type": "reactiva",
        "created_by": 1,
        "created_at": "2026-01-01 00:00:00",
        "updated_at": "2026-01-01 00:00:00",
    },
    "design_colors": {"design_id": 1, "pantone_color_id": 1},
    "samples": {
        "pantone_target_id": 1,
        "status": "aprobada",
        "created_by": 1,
        "created_at": "2026-01-01 00:00:00",
    },
    "inventory_items": {
        "name": "Colorante Rojo",
        "item_type": "colorante",
        "unit": "kg",
        "supplier": "Proveedor A",
        "supply_city": "Rosario",
        "current_stock": 10,
        "reorder_threshold": 5,
        "created_at": "2026-01-01 00:00:00",
        "updated_at": "2026-01-01 00:00:00",
    },
    "inventory_transactions": {
        "inventory_item_id": 1,
        "transaction_type": "entrada",
        "quantity": 10,
        "user_id": 1,
        "created_at": "2026-01-01 00:00:00",
    },
}


def _seed_pre_0004_rows(db_path: str) -> dict[str, int]:
    """Insert one row into each Fase 1/2/3 table; return row counts by table."""
    conn = sqlite3.connect(db_path)
    try:
        for table, values in PRE_0004_ROWS.items():
            columns = ", ".join(values)
            placeholders = ", ".join("?" for _ in values)
            conn.execute(
                f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
                tuple(values.values()),
            )
        conn.commit()
        return {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in PRE_0004_ROWS
        }
    finally:
        conn.close()


def test_upgrade_head_creates_all_eleven_tables(tmp_path) -> None:
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


def test_0004_adds_client_notes_and_design_id_columns(tmp_path) -> None:
    """``0004`` adds the nullable ``client``/``notes`` to ``designs`` and the
    nullable ``design_id`` to ``inventory_transactions`` (designs spec
    "Client Field"/"Notes Field", inventory spec "Design Reference on
    Consumption Transactions")."""
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert result.returncode == 0, f"upgrade failed:\n{result.stderr}"

    design_columns = _column_names(str(db), "designs")
    assert {"client", "notes"} <= design_columns

    txn_columns = _column_names(str(db), "inventory_transactions")
    assert "design_id" in txn_columns


def test_0004_creates_formula_designs_with_unique_pair_constraint(tmp_path) -> None:
    """``formula_designs`` persists as a table with a REAL database-level
    ``UNIQUE(formula_id, design_id)`` constraint, not an application-layer
    check (formula-designs spec "Formula-Design Link Data Model" — scenario
    "Migration creates table")."""
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert result.returncode == 0, f"upgrade failed:\n{result.stderr}"

    tables = _table_names(str(db))
    assert "formula_designs" in tables

    fd_columns = _column_names(str(db), "formula_designs")
    assert {"formula_id", "design_id", "source", "created_at"} <= fd_columns

    unique = _unique_indexes(str(db), "formula_designs")
    assert any(
        cols == ["formula_id", "design_id"]
        for _name, cols in unique
    ), f"no UNIQUE(formula_id, design_id) index found; got {unique}"


def test_0004_downgrade_is_additive_safe(tmp_path) -> None:
    """Downgrade drops ONLY the new table and columns; every Fase 1/2/3 table
    stays present with its rows intact (inventory spec "Downgrade is
    additive-safe")."""
    db = tmp_path / "app.db"
    url = f"sqlite:///{db}"
    assert _run_alembic(url, "upgrade", "head").returncode == 0

    # Precondition: the 0004 state is present (fails at the 0003 baseline).
    assert "formula_designs" in _table_names(str(db))
    assert {"client", "notes"} <= _column_names(str(db), "designs")
    assert "design_id" in _column_names(str(db), "inventory_transactions")

    # Seed Fase 1/2/3 rows AND one formula_designs row before downgrading.
    counts = _seed_pre_0004_rows(str(db))
    conn = sqlite3.connect(db)
    try:
        conn.execute(
            "INSERT INTO formula_designs (formula_id, design_id, source, created_at)"
            " VALUES (1, 1, 'auto', '2026-01-01 00:00:00')"
        )
        conn.commit()
    finally:
        conn.close()

    downgrade = _run_alembic(url, "downgrade", "-1")
    assert downgrade.returncode == 0, (
        f"alembic downgrade -1 failed:\n{downgrade.stdout}\n{downgrade.stderr}"
    )

    # Only the 0004 additions are gone.
    tables = _table_names(str(db))
    assert "formula_designs" not in tables
    assert "client" not in _column_names(str(db), "designs")
    assert "notes" not in _column_names(str(db), "designs")
    assert "design_id" not in _column_names(str(db), "inventory_transactions")

    # All Fase 1/2/3 tables still exist with their seeded rows intact.
    conn = sqlite3.connect(db)
    try:
        for table, expected in counts.items():
            assert table in tables, f"{table} was dropped by the 0004 downgrade"
            actual = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            assert actual == expected, (
                f"{table} lost rows in the 0004 downgrade: {actual} != {expected}"
            )
    finally:
        conn.close()


def test_0005_adds_hex_color_column(tmp_path) -> None:
    """``0005`` adds the nullable ``hex_color`` column to ``pantone_colors``
    (hex_color spec: store real HEX per Pantone)."""
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")
    assert result.returncode == 0, f"upgrade failed:\n{result.stderr}"

    columns = _column_names(str(db), "pantone_colors")
    assert "hex_color" in columns


def test_0005_downgrade_drops_hex_color(tmp_path) -> None:
    """Downgrade drops ``hex_color`` and all 0004 additions (reaching the 0003
    baseline in one ``downgrade -1`` step); every Fase 1/2/3 table and row
    survives (additive-safe pattern)."""
    db = tmp_path / "app.db"
    url = f"sqlite:///{db}"
    assert _run_alembic(url, "upgrade", "head").returncode == 0

    # Precondition: hex_color exists after upgrade.
    assert "hex_color" in _column_names(str(db), "pantone_colors")

    # Seed Fase 1/2/3 rows.
    counts = _seed_pre_0004_rows(str(db))

    # Downgrade by one: remove 0005 and 0004 in one step (reaches 0003).
    downgrade = _run_alembic(url, "downgrade", "-1")
    assert downgrade.returncode == 0, (
        f"alembic downgrade -1 failed:\n{downgrade.stdout}\n{downgrade.stderr}"
    )

    # hex_color is gone.
    assert "hex_color" not in _column_names(str(db), "pantone_colors")

    # All Fase 1/2/3 tables still exist with their seeded rows intact.
    conn = sqlite3.connect(db)
    try:
        for table, expected in counts.items():
            assert table in _table_names(str(db)), f"{table} was dropped"
            actual = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            assert actual == expected, (
                f"{table} lost rows in downgrade: {actual} != {expected}"
            )
    finally:
        conn.close()


def test_formula_designs_duplicate_pair_rejected_at_database(tmp_path) -> None:
    """A second ``(formula_id, design_id)`` row fails a real uniqueness
    violation at the database (formula-designs spec scenario "Duplicate pair
    rejected at data layer") — inserted by raw SQL, no API/mock involved."""
    db = tmp_path / "app.db"
    assert _run_alembic(f"sqlite:///{db}", "upgrade", "head").returncode == 0

    conn = sqlite3.connect(db)
    try:
        conn.execute(
            "INSERT INTO formula_designs (formula_id, design_id, source, created_at)"
            " VALUES (1, 1, 'auto', '2026-01-01 00:00:00')"
        )
        conn.commit()

        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO formula_designs (formula_id, design_id, source, created_at)"
                " VALUES (1, 1, 'manual', '2026-01-01 00:00:00')"
            )
    finally:
        conn.close()
