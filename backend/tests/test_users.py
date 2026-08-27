"""Users acceptance: admin-only CRUD + validation + audit (users spec).

Scenarios covered:
- Admins list, create, update, and delete users (200 / 201 / 204).
- Operators receive 403 on every user-management endpoint and no row is
  written; unauthenticated requests receive 401.
- Invalid roles and >72-byte passwords are rejected with 422; duplicate
  usernames conflict with 409.
- Created users store a bcrypt hash — responses never leak the hash or
  the plaintext password.
- Deleting a user with audit history (referenced by access_logs) returns
  409 and does not delete (FK integrity, access-logs spec).
- Every write action is audited in access_logs (create / update / delete).
"""

import sqlalchemy as sa

from app.core.security import MAX_PASSWORD_BYTES, verify_password
from app.modules.access_logs.models import AccessLog
from app.modules.users.models import Role, User


def test_admin_lists_users(client, auth_headers) -> None:
    response = client.get("/api/v1/users", headers=auth_headers("admin"))
    assert response.status_code == 200
    usernames = {row["username"] for row in response.json()}
    assert usernames == {"admin", "operator"}


def test_list_users_unauthenticated_returns_401(client) -> None:
    assert client.get("/api/v1/users").status_code == 401


def test_operator_cannot_list_users(client, auth_headers) -> None:
    assert client.get("/api/v1/users", headers=auth_headers("operator")).status_code == 403


def test_admin_creates_user_hashes_password_and_no_leak(
    client, auth_headers, session_factory
) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "ana", "full_name": "Ana Ruiz", "password": "secreto123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "ana"
    assert body["role"] == "operator"  # least-privilege default
    assert "password_hash" not in body
    assert "secreto123" not in response.text

    with session_factory() as db:
        user = db.scalar(sa.select(User).where(User.username == "ana"))
        assert user is not None
        assert user.password_hash != "secreto123"
        assert user.password_hash.startswith("$2")
        assert verify_password("secreto123", user.password_hash) is True


def test_admin_creates_user_with_explicit_role(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "luis", "password": "pass", "role": "admin"},
    )
    assert response.status_code == 201
    assert response.json()["role"] == "admin"


def test_create_user_duplicate_username_returns_409(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "admin", "password": "whatever"},
    )
    assert response.status_code == 409


def test_create_user_invalid_role_returns_422(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "mario", "password": "pw", "role": "superuser"},
    )
    assert response.status_code == 422


def test_create_user_password_too_long_returns_422(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "mario", "password": "x" * (MAX_PASSWORD_BYTES + 1)},
    )
    assert response.status_code == 422


def test_operator_cannot_create_user_and_no_row_written(
    client, auth_headers, session_factory
) -> None:
    response = client.post(
        "/api/v1/users",
        headers=auth_headers("operator"),
        json={"username": "hacker", "password": "pw"},
    )
    assert response.status_code == 403

    with session_factory() as db:
        total = db.scalar(sa.select(sa.func.count()).select_from(User))
        assert total == 2  # only the seeded admin + operator


def test_create_user_unauthenticated_returns_401(client) -> None:
    response = client.post(
        "/api/v1/users", json={"username": "x", "password": "pw"}
    )
    assert response.status_code == 401


def test_admin_updates_user_role(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        target_id = db.scalar(sa.select(User.id).where(User.username == "operator"))

    response = client.patch(
        f"/api/v1/users/{target_id}",
        headers=auth_headers("admin"),
        json={"role": "admin"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"

    with session_factory() as db:
        updated = db.get(User, target_id)
        assert updated.role == Role.admin


def test_update_user_missing_returns_404(client, auth_headers) -> None:
    response = client.patch(
        "/api/v1/users/9999",
        headers=auth_headers("admin"),
        json={"role": "admin"},
    )
    assert response.status_code == 404


def test_update_user_invalid_role_returns_422(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        target_id = db.scalar(sa.select(User.id).where(User.username == "operator"))

    response = client.patch(
        f"/api/v1/users/{target_id}",
        headers=auth_headers("admin"),
        json={"role": "superuser"},
    )
    assert response.status_code == 422


def test_operator_cannot_update_role(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        target_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    response = client.patch(
        f"/api/v1/users/{target_id}",
        headers=auth_headers("operator"),
        json={"role": "operator"},
    )
    assert response.status_code == 403


def test_admin_deletes_user(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        target_id = db.scalar(sa.select(User.id).where(User.username == "operator"))

    response = client.delete(f"/api/v1/users/{target_id}", headers=auth_headers("admin"))
    assert response.status_code == 204

    with session_factory() as db:
        assert db.get(User, target_id) is None


def test_delete_user_missing_returns_404(client, auth_headers) -> None:
    response = client.delete("/api/v1/users/9999", headers=auth_headers("admin"))
    assert response.status_code == 404


def test_operator_cannot_delete_user(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        target_id = db.scalar(sa.select(User.id).where(User.username == "operator"))

    response = client.delete(f"/api/v1/users/{target_id}", headers=auth_headers("operator"))
    assert response.status_code == 403


def test_delete_user_with_audit_history_returns_409(
    client, auth_headers, session_factory
) -> None:
    # Operator logs in → an access_logs row now references the operator.
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "operator", "password": "telary-operator"},
    )
    assert login.status_code == 200

    with session_factory() as db:
        operator_id = db.scalar(sa.select(User.id).where(User.username == "operator"))

    response = client.delete(f"/api/v1/users/{operator_id}", headers=auth_headers("admin"))
    assert response.status_code == 409

    with session_factory() as db:
        assert db.get(User, operator_id) is not None  # not deleted


def test_write_actions_are_audited(client, auth_headers, session_factory) -> None:
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    created = client.post(
        "/api/v1/users",
        headers=auth_headers("admin"),
        json={"username": "ana", "password": "pw"},
    )
    assert created.status_code == 201
    new_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/users/{new_id}",
        headers=auth_headers("admin"),
        json={"role": "admin"},
    )
    assert updated.status_code == 200

    deleted = client.delete(f"/api/v1/users/{new_id}", headers=auth_headers("admin"))
    assert deleted.status_code == 204

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id)
            .where(AccessLog.user_id == admin_id)
            .order_by(AccessLog.id)
        ).all()
        assert ("user.create", admin_id) in actions
        assert ("user.update", admin_id) in actions
        assert ("user.delete", admin_id) in actions