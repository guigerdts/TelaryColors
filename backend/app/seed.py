"""Idempotent admin bootstrap for a fresh database (design ADR-10).

Run from the backend dir via the venv:  .venv/bin/python -m app.seed
or invoked programmatically through ``ensure_admin`` with an open session.

The first run on an empty database creates the single admin account from the
configured credentials; any later run is a no-op (never duplicates an admin).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_db
from app.modules.users.models import Role, User


def ensure_admin(db: Session, username: str, password: str) -> bool:
    """Create the seed admin if none exists; return True when a row is added.

    Idempotency: only creates an admin when the database has no admin yet, so
    a second call leaves existing data untouched (users spec "Seed Admin").
    """
    existing_admin = db.scalar(select(User).where(User.role == Role.admin))
    if existing_admin is not None:
        return False

    admin = User(
        username=username,
        full_name="Administrador",
        password_hash=hash_password(password),
        role=Role.admin,
    )
    db.add(admin)
    db.commit()
    return True


def run_seed() -> bool:
    """Seed against the configured database using env/default credentials."""
    db = next(get_db())
    try:
        return ensure_admin(
            db,
            username=settings.seed_admin_username,
            password=settings.seed_admin_password,
        )
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
