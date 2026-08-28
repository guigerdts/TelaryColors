"""Designs acceptance: CRUD + 1–7 color cardinality + audit (designs spec).

Scenarios covered:
- Authenticated users (admin OR operator) create a design with a name, a
  valid paint type, and 1–7 Pantone colors; ``created_by``/``created_at``/
  ``updated_at`` are persisted.
- Duplicate ``name`` on create and on update → 409 conflict.
- Invalid ``paint_type`` → 422.
- Cardinality: 0 colors → 422 with a Spanish error message; 8 colors → 422
  Spanish; exactly 1 and exactly 7 are accepted (boundary).
- Duplicate color references in the same design are rejected (409).
- Referencing a nonexistent Pantone color is rejected (404).
- Deleting a design cascades to its ``design_colors`` rows and audits a
  ``design.delete`` action.
- Operators CAN write designs (not admin-only); unauthenticated → 401.
- Every write action is audited in access_logs; read-only requests are not.
"""

import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.designs.models import Design, DesignColor
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import User


def _create_color(client, headers, code="221C") -> int:
    response = client.post(
        "/api/v1/pantone-colors",
        headers=headers,
        json={"code": code, "paint_type": "reactiva"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_color_codes(client, headers, count: int) -> list[int]:
    return [_create_color(client, headers, code=f"22{i}C") for i in range(count)]


def _create_design(client, headers, color_ids, **overrides):
    payload = {
        "name": "Diseño Base",
        "paint_type": "reactiva",
        "color_ids": color_ids,
    }
    payload.update(overrides)
    return client.post("/api/v1/designs", headers=headers, json=payload)


def test_create_design_persists_fields(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created = _create_design(client, headers, [color_id])
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Diseño Base"
    assert body["paint_type"] == "reactiva"
    assert [c["pantone_color_id"] for c in body["colors"]] == [color_id]
    design_id = body["id"]

    with session_factory() as db:
        design = db.get(Design, design_id)
        assert design is not None
        assert design.created_by == 1  # seeded admin occupies id 1
        assert design.created_at is not None
        assert design.updated_at is not None
        assert len(design.colors) == 1


def test_duplicate_name_on_create_returns_409(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    assert _create_design(client, headers, [color_id]).status_code == 201

    duplicate = _create_design(
        client, headers, [color_id], name="Diseño Base"
    )
    assert duplicate.status_code == 409


def test_duplicate_name_on_update_returns_409(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_ids = _create_color_codes(client, headers, 2)
    first = _create_design(client, headers, [color_ids[0]], name="Rojo")
    second = _create_design(client, headers, [color_ids[1]], name="Azul")
    assert first.status_code == 201
    assert second.status_code == 201

    # rename the second design onto the first design's name
    renamed = client.patch(
        f"/api/v1/designs/{second.json()['id']}",
        headers=headers,
        json={"name": "Rojo"},
    )
    assert renamed.status_code == 409


def test_invalid_paint_type_returns_422(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    response = _create_design(
        client, headers, [color_id], paint_type="esmalte"
    )
    assert response.status_code == 422


def test_zero_colors_returns_422_spanish(client, auth_headers) -> None:
    headers = auth_headers("admin")
    created = _create_design(client, headers, color_ids=[])
    assert created.status_code in (400, 422)
    assert "entre 1 y 7" in created.json()["detail"]


def test_eight_colors_returns_422_spanish(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_ids = _create_color_codes(client, headers, 8)
    created = _create_design(client, headers, color_ids=color_ids)
    assert created.status_code in (400, 422)
    assert "entre 1 y 7" in created.json()["detail"]


def test_one_and_seven_colors_accepted_boundary(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_ids = _create_color_codes(client, headers, 7)

    one = _create_design(client, headers, [color_ids[0]], name="Un Color")
    assert one.status_code == 201
    assert [c["pantone_color_id"] for c in one.json()["colors"]] == [color_ids[0]]

    seven = _create_design(client, headers, color_ids, name="Siete Colores")
    assert seven.status_code == 201
    assert len(seven.json()["colors"]) == 7


def test_duplicate_color_reference_rejected(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    response = _create_design(
        client, headers, color_ids=[color_id, color_id]
    )
    assert response.status_code == 409


def test_nonexistent_pantone_color_rejected(client, auth_headers) -> None:
    headers = auth_headers("admin")
    response = _create_design(client, headers, color_ids=[99999])
    assert response.status_code == 404
    assert response.json()["detail"] == "Color Pantone no encontrado"


def test_crud_cycle_list_read_update(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_ids = _create_color_codes(client, headers, 2)
    created = _create_design(client, headers, [color_ids[0]], name="Verde")
    assert created.status_code == 201
    design_id = created.json()["id"]

    listing = client.get("/api/v1/designs", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    read = client.get(f"/api/v1/designs/{design_id}", headers=headers)
    assert read.status_code == 200
    assert read.json()["name"] == "Verde"

    # update: rename + replace the color set (drop color 0, add color 1)
    updated = client.patch(
        f"/api/v1/designs/{design_id}",
        headers=headers,
        json={"name": "Verde Oscuro", "color_ids": [color_ids[1]]},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Verde Oscuro"
    assert [c["pantone_color_id"] for c in updated.json()["colors"]] == [color_ids[1]]

    assert client.get("/api/v1/designs/9999", headers=headers).status_code == 404


def test_delete_design_cascades_and_audits(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    created = _create_design(client, headers, [color_id])
    assert created.status_code == 201
    design_id = created.json()["id"]

    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    deleted = client.delete(f"/api/v1/designs/{design_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        assert db.get(Design, design_id) is None
        color_rows = db.execute(
            sa.select(DesignColor.id).where(DesignColor.design_id == design_id)
        ).all()
        assert color_rows == []
        assert db.scalar(
            sa.select(AccessLog).where(
                AccessLog.action == "design.delete",
                AccessLog.user_id == admin_id,
            )
        ) is not None


def test_operator_can_write_designs(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created = _create_design(client, auth_headers("operator"), [color_id])
    assert created.status_code == 201
    design_id = created.json()["id"]

    assert (
        client.patch(
            f"/api/v1/designs/{design_id}",
            headers=auth_headers("operator"),
            json={"name": "Renombrado por operador"},
        ).status_code
        == 200
    )
    assert (
        client.delete(
            f"/api/v1/designs/{design_id}", headers=auth_headers("operator")
        ).status_code
        == 204
    )

    with session_factory() as db:
        assert db.scalar(sa.select(Design)) is None


def test_unauthenticated_returns_401(client) -> None:
    assert client.get("/api/v1/designs").status_code == 401
    assert client.post("/api/v1/designs", json={}).status_code == 401


def test_write_actions_are_audited(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    created = _create_design(client, headers, [color_id])
    assert created.status_code == 201
    design_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/designs/{design_id}", headers=headers, json={"name": "Renombrada"}
    )
    assert updated.status_code == 200

    deleted = client.delete(f"/api/v1/designs/{design_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id).order_by(AccessLog.id)
        ).all()
        assert ("design.create", admin_id) in actions
        assert ("design.update", admin_id) in actions
        assert ("design.delete", admin_id) in actions


def test_read_only_requests_are_not_audited(
    client, auth_headers, session_factory
) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    created = _create_design(client, headers, [color_id])
    assert created.status_code == 201
    design_id = created.json()["id"]

    with session_factory() as db:
        before = db.scalar(sa.select(sa.func.count()).select_from(AccessLog))

    # list + single read (repeatedly) never write audit rows
    for _ in range(3):
        assert client.get("/api/v1/designs", headers=headers).status_code == 200
        assert (
            client.get(f"/api/v1/designs/{design_id}", headers=headers).status_code
            == 200
        )

    with session_factory() as db:
        after = db.scalar(sa.select(sa.func.count()).select_from(AccessLog))
    assert after == before