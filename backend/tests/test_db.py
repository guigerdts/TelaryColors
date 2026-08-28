"""Data layer: the SQLite engine applies WAL and foreign-key pragmas.

Covers the base spec "Data Layer": the configured SQLite database is
available for all modules, with WAL (LAN multi-user reads + one writer)
and ``PRAGMA foreign_keys=ON`` (FK enforcement).
"""

import pytest
import sqlalchemy as sa

from app.core import config
from app.db.session import create_engine, create_session_factory, get_db


def test_engine_enables_foreign_keys(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'fk.db'}")
    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


def test_engine_uses_wal_journal(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'wal.db'}")
    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"


def test_get_db_returns_connection_when_request_ends(tmp_path, monkeypatch) -> None:
    """The per-request session works during the request and returns its
    connection to the pool when the request ends (generator close)."""
    url = f"sqlite:///{tmp_path / 'session.db'}"
    engine = create_engine(url)
    checkouts: list = []
    checkins: list = []
    sa.event.listen(engine, "checkout", lambda *_: checkouts.append(1))
    sa.event.listen(engine, "checkin", lambda *_: checkins.append(1))
    monkeypatch.setattr(config.settings, "database_url", url)

    gen = get_db()
    db = next(gen)
    assert db.execute(sa.text("SELECT 1")).scalar() == 1
    gen.close()

    assert len(checkouts) == 1
    assert len(checkins) == 1


def test_session_factory_binds_engine(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'factory.db'}")
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        assert session.bind is engine