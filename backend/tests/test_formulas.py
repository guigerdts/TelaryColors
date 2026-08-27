"""Formulas acceptance: CRUD + nested ingredients + unit conversion
(formulas spec).

Scenarios covered:
- Authenticated users (admin OR operator) create a formula with nested
  ingredients; ``created_by``/``created_at``/``updated_at`` are persisted.
- List/read/update/delete a formula; delete cascades to its ingredients.
- Invalid ``unit`` (not g/kg) and invalid (non-numeric) ``quantity`` → 422.
- Automatic unit conversion: ``1 kg`` → ``quantity_g == 1000`` and
  ``0.001 kg`` → ``quantity_g == 1`` (sub-gram precision, Decimal).
  The original unit/quantity are preserved alongside ``quantity_g``.
- Formula→Pantone link: a valid reference works; a nonexistent
  ``pantone_color_id`` is rejected.
- Operators CAN create formulas (authed, not admin-only); unauthenticated
  requests receive 401.
- Every write action is audited in access_logs.
"""

from decimal import Decimal

import sqlalchemy as sa

from app.modules.access_logs.models import AccessLog
from app.modules.formulas.models import Formula, FormulaIngredient
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


def _create_formula(client, headers, color_id, ingredients=None, **overrides) -> None:
    payload = {
        "name": "Base Blanca",
        "pantone_color_id": color_id,
        "ingredients": ingredients
        or [{"colorant": "Blanco TiO2", "quantity": "100", "unit": "g"}],
    }
    payload.update(overrides)
    return client.post("/api/v1/formulas", headers=headers, json=payload)


def test_full_crud_cycle_with_cascade_delete(
    client, auth_headers, session_factory
) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    # create
    created = _create_formula(
        client,
        headers,
        color_id,
        ingredients=[
            {"colorant": "Blanco TiO2", "quantity": "100", "unit": "g"},
            {"colorant": "Negro", "quantity": "0.5", "unit": "kg"},
        ],
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Base Blanca"
    formula_id = body["id"]
    assert len(body["ingredients"]) == 2

    with session_factory() as db:
        formula = db.get(Formula, formula_id)
        assert formula is not None
        assert formula.created_by == 1  # seeded admin occupies id 1
        assert formula.created_at is not None
        assert formula.updated_at is not None
        assert len(formula.ingredients) == 2

    # read
    read = client.get(f"/api/v1/formulas/{formula_id}", headers=headers)
    assert read.status_code == 200
    assert read.json()["name"] == "Base Blanca"

    # update (rename, keep ingredients)
    updated = client.patch(
        f"/api/v1/formulas/{formula_id}",
        headers=headers,
        json={"name": "Base Gris"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Base Gris"
    assert len(updated.json()["ingredients"]) == 2

    # delete → cascade removes ingredients
    deleted = client.delete(f"/api/v1/formulas/{formula_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        assert db.get(Formula, formula_id) is None
        ingredient_ids = db.execute(
            sa.select(FormulaIngredient.id).where(FormulaIngredient.formula_id == formula_id)
        ).all()
        assert ingredient_ids == []


def test_list_and_missing_read_404(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    assert _create_formula(client, headers, color_id).status_code == 201

    listing = client.get("/api/v1/formulas", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    assert client.get("/api/v1/formulas/9999", headers=headers).status_code == 404


def test_operator_can_create_formula(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created = _create_formula(client, auth_headers("operator"), color_id)
    assert created.status_code == 201

    with session_factory() as db:
        assert db.scalar(sa.select(Formula)) is not None


def test_unauthenticated_returns_401(client) -> None:
    assert client.get("/api/v1/formulas").status_code == 401
    assert client.post("/api/v1/formulas", json={}).status_code == 401


def test_invalid_unit_returns_422(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    response = _create_formula(
        client,
        headers,
        color_id,
        ingredients=[{"colorant": "Blanco", "quantity": "1", "unit": "litros"}],
    )
    assert response.status_code == 422


def test_invalid_quantity_returns_422(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    # non-numeric quantity
    response = _create_formula(
        client,
        headers,
        color_id,
        ingredients=[{"colorant": "Blanco", "quantity": "mucho", "unit": "g"}],
    )
    assert response.status_code == 422


def test_kg_to_grams_conversion(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    response = _create_formula(
        client,
        headers,
        color_id,
        ingredients=[{"colorant": "Blanco", "quantity": "1", "unit": "kg"}],
    )
    assert response.status_code == 201
    ingredient = response.json()["ingredients"][0]
    # Decimal, no FP loss; 1 kg == 1000 g
    assert Decimal(ingredient["quantity_g"]) == Decimal("1000")
    # original unit + quantity preserved in output
    assert ingredient["unit"] == "kg"
    assert Decimal(ingredient["quantity"]) == Decimal("1")


def test_sub_gram_precision_conversion(client, auth_headers) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    # 0.001 kg == 1 g (sub-gram precision, Decimal without FP loss)
    response = _create_formula(
        client,
        headers,
        color_id,
        ingredients=[{"colorant": "Negro", "quantity": "0.001", "unit": "kg"}],
    )
    assert response.status_code == 201
    ingredient = response.json()["ingredients"][0]
    assert Decimal(ingredient["quantity_g"]) == Decimal("1")
    assert ingredient["unit"] == "kg"


def test_formula_to_pantone_link_valid(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    response = _create_formula(client, headers, color_id)
    assert response.status_code == 201

    with session_factory() as db:
        formula = db.get(Formula, response.json()["id"])
        assert formula.pantone_color_id == color_id


def test_formula_to_pantone_link_nonexistent_rejected(client, auth_headers) -> None:
    headers = auth_headers("admin")
    response = _create_formula(client, headers, color_id=99999)
    assert response.status_code in (404, 422)


def test_write_actions_are_audited(client, auth_headers, session_factory) -> None:
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    created = _create_formula(client, headers, color_id)
    assert created.status_code == 201
    formula_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/formulas/{formula_id}", headers=headers, json={"name": "Renombrada"}
    )
    assert updated.status_code == 200

    deleted = client.delete(f"/api/v1/formulas/{formula_id}", headers=headers)
    assert deleted.status_code == 204

    with session_factory() as db:
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id).order_by(AccessLog.id)
        ).all()
        assert ("formula.create", admin_id) in actions
        assert ("formula.update", admin_id) in actions
        assert ("formula.delete", admin_id) in actions
