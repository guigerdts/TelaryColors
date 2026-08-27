"""Seed acceptance: idempotent admin bootstrap (users spec "Seed Admin",
design ADR-10).

Seeding on a fresh database creates exactly one admin using the configured
credentials, hashes the password at seed time, and re-running leaves the data
unchanged (no duplicate admin).
"""

import sqlalchemy as sa

from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.db.session import create_engine, create_session_factory
from app.modules.users.models import Role, User
from app.modules.users import models as _models  # noqa: F401  register users table
from app.seed import ensure_admin


def _new_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed.db'}")
    Base.metadata.create_all(engine)
    session_factory = create_session_factory(engine)
    return session_factory


def test_seed_creates_one_admin(tmp_path) -> None:
    session_factory = _new_db(tmp_path)
    with session_factory() as db:
        created = ensure_admin(db, username="admin", password="telary-admin")
        assert created is True

        admins = db.execute(
            sa.select(User).where(User.role == Role.admin)
        ).scalars().all()
        assert len(admins) == 1
        assert admins[0].username == "admin"
        assert admins[0].role == Role.admin
        # Stored value is a bcrypt hash, not the plaintext password.
        assert admins[0].password_hash != "telary-admin"
        assert admins[0].password_hash.startswith("$2")
        assert verify_password("telary-admin", admins[0].password_hash) is True


def test_seed_is_idempotent_data_unchanged(tmp_path) -> None:
    session_factory = _new_db(tmp_path)

    def snapshot(db):
        rows = db.execute(
            sa.select(
                User.id,
                User.username,
                User.password_hash,
                User.role,
                User.full_name,
                User.created_at,
            )
        ).all()
        return sorted(tuple(r) for r in rows)

    with session_factory() as db:
        ensure_admin(db, username="admin", password="telary-admin")
        before = snapshot(db)

        # Second run must not create a duplicate and must not touch data.
        created_again = ensure_admin(db, username="admin", password="telary-admin")
        assert created_again is False
        assert snapshot(db) == before

        total = db.execute(sa.select(sa.func.count()).select_from(User)).scalar()
        assert total == 1
