"""Shared fixtures for API tests (auth, users; later module slices).

Each test receives a fresh temp-file SQLite database with the schema
applied and two seeded users (admin + operator with known passwords).
``get_db`` is overridden on the app instance so HTTP requests hit that
database. Tokens are minted through the real ``create_access_token``
(token factory, design "Tests" section).

Note: engines are function-scoped (fresh DB per test) for full isolation,
instead of the session-scoped engine sketched in design.md — the existing
data-layer tests follow the same per-test pattern.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import create_engine, create_session_factory
from app.main import create_app
from app.modules.users.models import Role, User

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "telary-admin"
OPERATOR_USERNAME = "operator"
OPERATOR_PASSWORD = "telary-operator"


@pytest.fixture()
def db_engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'api.db'}")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def session_factory(db_engine):
    return create_session_factory(db_engine)


def _seed_user(db, username, password, role, full_name=None):
    user = User(
        username=username,
        full_name=full_name,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def seeded_users(session_factory):
    """Create the admin and operator accounts every API test builds on."""
    with session_factory() as db:
        admin = _seed_user(
            db, ADMIN_USERNAME, ADMIN_PASSWORD, Role.admin, full_name="Administrador"
        )
        operator = _seed_user(
            db, OPERATOR_USERNAME, OPERATOR_PASSWORD, Role.operator, full_name="Operador"
        )
        return {"admin": admin, "operator": operator}


@pytest.fixture()
def client(session_factory, seeded_users):
    """TestClient with ``get_db`` pointing at the per-test database."""
    app = create_app()

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


from datetime import datetime, timedelta, timezone

import jwt


@pytest.fixture()
def auth_headers():
    """Factory: build Bearer headers from a JWT signed with the app secret.

    The token is signed the same way the production ``create_access_token``
    signs tokens (same key, HS256) so the real decode path in
    ``get_current_user`` validates it.
    """

    def _build(username: str) -> dict[str, str]:
        payload = {
            "sub": username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    return _build