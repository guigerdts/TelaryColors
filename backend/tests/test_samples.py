"""Samples module acceptance tests.

Phase A focuses on the data layer: the additive ``0002_samples`` migration
creates the ``samples`` table plus the ``ix_samples_pantone_target_id`` and
``ix_samples_status`` indexes (samples spec "Sample Data Model", scenario
"Migration adds table"). Later phases add CRUD, upload, and promote tests in
this same file.
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


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


def _index_names(db_path: str, table: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' "
            "AND tbl_name=? AND sql IS NOT NULL",
            (table,),
        ).fetchall()
        return {row[0] for row in rows}
    finally:
        conn.close()


def test_upgrade_head_creates_samples_table_and_indexes(tmp_path) -> None:
    """S1 Migration adds table."""
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")

    assert result.returncode == 0, (
        f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}"
    )

    conn = sqlite3.connect(str(db))
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='samples'"
        ).fetchone()
    finally:
        conn.close()

    assert row is not None, "samples table was not created by upgrade head"

    indexes = _index_names(str(db), "samples")
    assert "ix_samples_pantone_target_id" in indexes
    assert "ix_samples_status" in indexes
