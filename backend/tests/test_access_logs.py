"""Access-logs acceptance: audit endpoint + wiring (access-logs spec).

Scenarios covered:
- ``GET /access-logs`` is admin-only: admin → 200, operator → 403,
  unauthenticated → 401. The list is ordered by timestamp descending.
- Every data-mutating action (login, user.create, pantone.create,
  formula.create, design.create) writes an access_log row for the acting
  user; read-only GETs (including the audit endpoint itself) write none.
- A successful login records a ``login`` audit row.
- Audit-record integrity: after a referenced user's profile is updated,
  the historical access_log row keeps its original user_id and timestamp.
- History is stable across repeated reads (no log growth from reads).
"""

import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.designs.models import Design
from app.modules.formulas.models import Formula
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import User


def _login(client, username: str, password: str) -> None:
    response = client.post(
        "/api/v1/auth/login", data={"username": username, "password": password}
    )
    assert response.status_code == 200


def _create_color(client, headers, code="221C") -> int:
    response = client.post(
        "/api/v1/pantone-colors",
        headers=headers,
        json={"code": code, "paint_type": "reactiva"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_formula(client, headers, color_id) -> int:
    response = client.post(
        "/api/v1/formulas",
        headers=headers,
        json={
            "name": "Base Blanca",
            "pantone_color_id": color_id,
            "ingredients": [{"colorant": "Blanco", "quantity": "100", "unit": "g"}],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_design(client, headers, color_id, name="Diseño Auditado") -> int:
    response = client.post(
        "/api/v1/designs",
        headers=headers,
        json={"name": name, "paint_type": "reactiva", "color_ids": [color_id]},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _count_logs(session_factory) -> int:
    with session_factory() as db:
        return db.scalar(sa.select(sa.func.count()).select_from(AccessLog))


def test_access_logs_admin_only(client, auth_headers) -> None:
    assert client.get("/api/v1/access-logs").status_code == 401
    assert client.get("/api/v1/access-logs", headers=auth_headers("operator")).status_code == 403
    response = client.get("/api/v1/access-logs", headers=auth_headers("admin"))
    assert response.status_code == 200
    assert response.json() == []


def test_access_logs_ordered_by_timestamp_desc(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    _create_design(client, headers, color_id, name="Primer Diseño")  # first design.create
    _create_design(client, headers, color_id, name="Segundo Diseño")  # second design.create

    response = client.get("/api/v1/access-logs", headers=headers)
    assert response.status_code == 200
    rows = response.json()
    timestamps = [row["timestamp"] for row in rows]
    assert timestamps == sorted(timestamps, reverse=True)
    # prettiest-newest first: the second design.create leads the first
    design_creates = [row for row in rows if row["action"] == "design.create"]
    assert len(design_creates) == 2
    assert design_creates[0]["id"] > design_creates[1]["id"]


def test_mutations_write_audit_rows(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    _login(client, "admin", "telary-admin")

    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    created_user = client.post(
        "/api/v1/users",
        headers=headers,
        json={"username": "ana", "full_name": "Ana", "password": "secreto123"},
    )
    assert created_user.status_code == 201

    color_id = _create_color(client, headers)
    formula_id = _create_formula(client, headers, color_id)
    design_id = _create_design(client, headers, color_id)

    assert client.patch(
        f"/api/v1/formulas/{formula_id}", headers=headers, json={"name": "Renombrada"}
    ).status_code == 200
    assert client.patch(
        f"/api/v1/designs/{design_id}", headers=headers, json={"name": "Retocada"}
    ).status_code == 200

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id).order_by(AccessLog.id)
        ).all()
        for expected in (
            "login",
            "user.create",
            "pantone.create",
            "formula.create",
            "formula.update",
            "design.create",
            "design.update",
        ):
            assert (expected, admin_id) in actions, f"missing audit row {expected}"


def test_successful_login_writes_login_row(client, session_factory) -> None:
    _login(client, "operator", "telary-operator")

    with session_factory() as db:
        operator_id = db.scalar(sa.select(User.id).where(User.username == "operator"))
        row = db.scalar(
            sa.select(AccessLog).where(
                AccessLog.action == "login", AccessLog.user_id == operator_id
            )
        )
        assert row is not None
        assert row.timestamp is not None


def test_read_requests_do_not_write_audit_rows(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    design_id = _create_design(client, headers, color_id)
    formula_id = _create_formula(client, headers, color_id)
    with session_factory() as db:
        pantone_id = db.scalar(sa.select(PantoneColor.id))

    before = _count_logs(session_factory)

    # every read flavor: list, single, search, me, and the audit endpoint itself
    assert client.get("/api/v1/designs", headers=headers).status_code == 200
    assert client.get(f"/api/v1/designs/{design_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/formulas", headers=headers).status_code == 200
    assert client.get(f"/api/v1/formulas/{formula_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/pantone-colors?q=22", headers=headers).status_code == 200
    assert client.get(f"/api/v1/pantone-colors/{pantone_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/users", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/access-logs", headers=headers).status_code == 200

    assert _count_logs(session_factory) == before


def test_history_stable_across_repeated_reads(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    _create_design(client, headers, color_id)
    before = _count_logs(session_factory)

    for _ in range(5):
        assert client.get("/api/v1/access-logs", headers=headers).status_code == 200

    assert _count_logs(session_factory) == before


def test_historical_audit_row_unchanged_after_user_update(
    client, auth_headers, session_factory
) -> None:
    operator_headers = auth_headers("operator")
    admin_headers = auth_headers("admin")
    color_id = _create_color(client, admin_headers)

    # operator performs a mutation → audit row references them
    design_id = _create_design(client, operator_headers, color_id)

    with session_factory() as db:
        operator_id = db.scalar(sa.select(User.id).where(User.username == "operator"))
        row = db.scalar(
            sa.select(AccessLog).where(
                AccessLog.action == "design.create",
                AccessLog.user_id == operator_id,
            )
        )
        original = (row.user_id, row.timestamp, row.action)

    # admin later updates the operator's profile
    updated = client.patch(
        f"/api/v1/users/{operator_id}",
        headers=admin_headers,
        json={"full_name": "Operador Renombrado"},
    )
    assert updated.status_code == 200

    with session_factory() as db:
        row = db.scalar(
            sa.select(AccessLog).where(
                AccessLog.action == "design.create",
                AccessLog.user_id == operator_id,
            )
        )
        assert (row.user_id, row.timestamp, row.action) == original

    # the design is still readable by its operator — wiring intact
    assert client.get(f"/api/v1/designs/{design_id}", headers=operator_headers).status_code == 200


def test_delete_actions_audited_across_resources(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    color_id = _create_color(client, headers)
    formula_id = _create_formula(client, headers, color_id)
    design_id = _create_design(client, headers, color_id)

    assert client.delete(f"/api/v1/formulas/{formula_id}", headers=headers).status_code == 204
    assert client.delete(f"/api/v1/designs/{design_id}", headers=headers).status_code == 204

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id).order_by(AccessLog.id)
        ).all()
        assert ("formula.delete", admin_id) in actions
        assert ("design.delete", admin_id) in actions


def test_read_only_designs_and_formulas_leave_no_rows(
    client, auth_headers, session_factory
) -> None:
    """Direct DB proof that reads never materialize ORM rows into the audit log."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    design_id = _create_design(client, headers, color_id)
    before = _count_logs(session_factory)

    assert client.get(f"/api/v1/designs/{design_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/formulas", headers=headers).status_code == 200

    with session_factory() as db:
        # the read objects are gone from the working set — nothing new logged
        assert db.scalar(sa.select(sa.func.count()).select_from(AccessLog)) == before
        assert db.get(Design, design_id) is not None  # design untouched
        assert db.scalar(sa.select(sa.func.count()).select_from(Formula)) == 0  # no formulas created