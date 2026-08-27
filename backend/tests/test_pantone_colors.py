"""Pantone colors acceptance: CRUD + search + classification (pantone-colors spec).

Scenarios covered:
- Authenticated users (admin OR operator) run a full CRUD cycle (201/200/200/204).
- Operators CAN create pantone colors (unlike /users which is admin-only, per
  design roles); unauthenticated requests receive 401.
- Duplicate ``code`` on create/update → 409 and the duplicate is not persisted.
- ``?q=`` prefix search (code.ilike('221%')) returns matching colors; a query
  with no matches returns an empty list (200, not an error).
- Invalid ``paint_type`` (not reactiva/pigmento) → 422.
- Omitted ``gamut`` defaults to ``C``.
- Every write action is audited in access_logs.
"""

import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import User


def _create(client, headers, code="221C", paint_type="reactiva", **overrides):
    payload = {"code": code, "paint_type": paint_type}
    payload.update(overrides)
    return client.post("/api/v1/pantone-colors", headers=headers, json=payload)


def test_full_crud_cycle(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")

    # create
    created = _create(client, headers)
    assert created.status_code == 201
    body = created.json()
    assert body["code"] == "221C"
    assert body["paint_type"] == "reactiva"
    color_id = body["id"]

    # read
    read = client.get(f"/api/v1/pantone-colors/{color_id}", headers=headers)
    assert read.status_code == 200
    assert read.json()["code"] == "221C"

    # update (change paint_type and gamut)
    updated = client.patch(
        f"/api/v1/pantone-colors/{color_id}",
        headers=headers,
        json={"paint_type": "pigmento", "gamut": "U"},
    )
    assert updated.status_code == 200
    assert updated.json()["paint_type"] == "pigmento"
    assert updated.json()["gamut"] == "U"

    # delete
    deleted = client.delete(f"/api/v1/pantone-colors/{color_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        assert db.get(PantoneColor, color_id) is None


def test_read_missing_returns_404(client, auth_headers) -> None:
    response = client.get(
        "/api/v1/pantone-colors/9999", headers=auth_headers("admin")
    )
    assert response.status_code == 404


def test_operator_can_create_pantone_color(client, auth_headers, session_factory) -> None:
    response = _create(client, auth_headers("operator"), code="185C", paint_type="pigmento")
    assert response.status_code == 201
    assert response.json()["code"] == "185C"

    with session_factory() as db:
        assert db.scalar(
            sa.select(PantoneColor).where(PantoneColor.code == "185C")
        ) is not None


def test_unauthenticated_returns_401(client) -> None:
    assert client.get("/api/v1/pantone-colors").status_code == 401
    assert client.post("/api/v1/pantone-colors", json={"code": "x", "paint_type": "reactiva"}).status_code == 401


def test_duplicate_code_on_create_returns_409_not_persisted(
    client, auth_headers, session_factory
) -> None:
    headers = auth_headers("admin")
    assert _create(client, headers, code="221C").status_code == 201

    dup = _create(client, headers, code="221C")
    assert dup.status_code == 409

    # the duplicate is not persisted: exactly one 221C row remains
    with session_factory() as db:
        count = db.scalar(
            sa.select(sa.func.count())
            .select_from(PantoneColor)
            .where(PantoneColor.code == "221C")
        )
        assert count == 1


def test_duplicate_code_on_update_returns_409(client, auth_headers) -> None:
    headers = auth_headers("admin")
    first = _create(client, headers, code="221C")
    assert first.status_code == 201
    second = _create(client, headers, code="185C")
    assert second.status_code == 201

    updated = client.patch(
        f"/api/v1/pantone-colors/{second.json()['id']}",
        headers=headers,
        json={"code": "221C"},  # collides with the first color's code
    )
    assert updated.status_code == 409


def test_search_q_prefix_matching_results(client, auth_headers) -> None:
    headers = auth_headers("admin")
    assert _create(client, headers, code="221C").status_code == 201
    assert _create(client, headers, code="221U", paint_type="pigmento").status_code == 201
    assert _create(client, headers, code="185C").status_code == 201

    response = client.get("/api/v1/pantone-colors?q=221", headers=headers)
    assert response.status_code == 200
    codes = {row["code"] for row in response.json()}
    assert codes == {"221C", "221U"}


def test_search_q_prefix_case_insensitive(client, auth_headers) -> None:
    headers = auth_headers("admin")
    assert _create(client, headers, code="221C").status_code == 201

    # lowercase prefix must match the stored uppercase "221C"
    response = client.get("/api/v1/pantone-colors?q=221c", headers=headers)
    assert response.status_code == 200
    codes = {row["code"] for row in response.json()}
    assert codes == {"221C"}


def test_search_q_no_matches_returns_empty_list(client, auth_headers) -> None:
    headers = auth_headers("admin")
    assert _create(client, headers, code="221C").status_code == 201

    response = client.get("/api/v1/pantone-colors?q=999", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_invalid_paint_type_returns_422(client, auth_headers) -> None:
    response = _create(client, auth_headers("admin"), code="221C", paint_type="acuarela")
    assert response.status_code == 422


def test_default_gamut_is_C(client, auth_headers) -> None:
    # gamut omitted on purpose
    response = _create(client, auth_headers("admin"), code="221C")
    assert response.status_code == 201
    assert response.json()["gamut"] == "C"


def test_write_actions_are_audited(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    created = _create(client, headers, code="221C")
    assert created.status_code == 201
    color_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/pantone-colors/{color_id}", headers=headers, json={"gamut": "U"}
    )
    assert updated.status_code == 200

    deleted = client.delete(f"/api/v1/pantone-colors/{color_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id).order_by(AccessLog.id)
        ).all()
        assert ("pantone.create", admin_id) in actions
        assert ("pantone.update", admin_id) in actions
        assert ("pantone.delete", admin_id) in actions
