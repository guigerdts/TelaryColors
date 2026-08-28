"""Auth acceptance: JWT login + current user + role guard (auth spec).

Scenarios covered:
- Successful login returns a 12h HS256 JWT, updates the user's
  ``last_access_at`` and records a ``login`` audit row (same tx).
- Wrong password / unknown user return 401 and issue no token.
- Passwords over 72 bytes are rejected with a validation error (422);
  the login is the first place a user can set a password (bcrypt guard
  from design ADR-1 / key learning #5).
- GET /auth/me resolves the bearer token (200) and rejects missing,
  invalid, and expired tokens (401).
- ``require_roles`` admits admins and rejects operators (403).
"""

from datetime import datetime, timedelta, timezone

import jwt
import sqlalchemy as sa
from fastapi import Depends
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import MAX_PASSWORD_BYTES
from app.main import create_app
from app.modules.access_logs.models import AccessLog
from app.modules.users.models import Role, User


def test_login_success_returns_token_updates_last_access_and_audits(
    client, session_factory
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "telary-admin"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"

    claims = jwt.decode(body["access_token"], settings.secret_key, algorithms=["HS256"])
    assert claims["sub"] == "admin"
    remaining = datetime.fromtimestamp(claims["exp"], tz=timezone.utc) - datetime.now(
        timezone.utc
    )
    assert timedelta(hours=11) < remaining <= timedelta(hours=12)

    # Response carries the public user profile, never the hash.
    assert body["user"]["username"] == "admin"
    assert body["user"]["role"] == "admin"
    assert "password_hash" not in body["user"]

    with session_factory() as db:
        user = db.scalar(sa.select(User).where(User.username == "admin"))
        # Seeded admin has last_access_at=None; a successful login must set it.
        assert user.last_access_at is not None
        audit = db.scalar(sa.select(AccessLog).where(AccessLog.action == "login"))
        assert audit is not None
        assert audit.user_id == user.id


def test_login_wrong_password_returns_401(client) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "not-the-password"},
    )
    assert response.status_code == 401
    assert "access_token" not in response.json()


def test_login_unknown_user_returns_401(client) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "ghost", "password": "whatever"},
    )
    assert response.status_code == 401


def test_login_password_over_72_bytes_returns_422(client) -> None:
    long_password = "x" * (MAX_PASSWORD_BYTES + 1)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": long_password},
    )
    assert response.status_code == 422


def test_me_with_valid_token_returns_profile(client, auth_headers) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers("admin"))
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert "password_hash" not in body


def test_me_without_token_returns_401(client) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_with_invalid_token_returns_401(client) -> None:
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert response.status_code == 401


def test_me_with_expired_token_returns_401(client) -> None:
    expired = jwt.encode(
        {"sub": "admin", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        settings.secret_key,
        algorithm="HS256",
    )
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"}
    )
    assert response.status_code == 401


def test_require_roles_admits_admin_and_rejects_operator(
    session_factory, seeded_users, auth_headers
) -> None:
    """Probe route protected by ``require_roles(Role.admin)``."""
    from app.core.deps import require_roles

    app = create_app()

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    @app.get("/api/v1/_probe/admin-only")
    def _probe(current_user: User = Depends(require_roles(Role.admin))):
        return {"username": current_user.username}

    with TestClient(app) as probe_client:
        admin_response = probe_client.get(
            "/api/v1/_probe/admin-only", headers=auth_headers("admin")
        )
        assert admin_response.status_code == 200
        assert admin_response.json() == {"username": "admin"}

        operator_response = probe_client.get(
            "/api/v1/_probe/admin-only", headers=auth_headers("operator")
        )
        assert operator_response.status_code == 403