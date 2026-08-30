"""Formula↔design links acceptance (formula-designs spec; design D2/D4).

Manual link (source=manual): an authenticated user links an EXISTING design to
a formula from the formula's page, without any inventory transaction; the link
persists with ``source=manual`` and a ``formula_design.create`` audit row in the
same transaction. A missing formula or design 404s with the module's Spanish
detail. Re-linking an existing pair is IDEMPOTENT (design D4): the call
succeeds (never a generic server error or a 409), returns the existing
relation with its original ``source`` unchanged, writes NO duplicate row, and
audits nothing new — only a genuinely new pair records ``formula_design.create``.

The automatic-link (source=auto) and detail-endpoint scenarios live in the
Slice D auto/detail tests further down this file (inventory spec "Atomic Stock
Transaction With Auto Design Link", formula-designs spec "Formula Detail
Endpoint").
"""

import pytest
import sqlalchemy as sa

from app.db.enums import PaintType
from app.modules.access_logs.models import AccessLog
from app.modules.designs.models import Design, FormulaDesign
from app.modules.formulas.models import Formula
from app.modules.inventory.models import InventoryItem, InventoryTransaction
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import User

MANUAL_CREATE_AUDIT = "formula_design.create"


def _user_id(session_factory, username: str = "admin") -> int:
    with session_factory() as db:
        return db.scalar(sa.select(User.id).where(User.username == username))


def _seed_formula_and_design(session_factory, design_name="Diseño Verificación") -> tuple[int, int]:
    """Seed one pantone color, one formula, and one design via ORM.

    Returns ``(formula_id, design_id)``. The design is created without
    ``design_colors`` rows (the link feature only needs the design to exist;
    ``DesignOut.colors`` serializes to ``[]``).
    """
    with session_factory() as db:
        admin_id = _user_id(session_factory)
        db.add(PantoneColor(code="221C", paint_type=PaintType.reactiva))
        db.flush()
        formula = Formula(
            pantone_color_id=db.scalar(
                sa.select(PantoneColor.id).where(PantoneColor.code == "221C")
            ),
            name="Fórmula Azul 221C",
            created_by=admin_id,
        )
        db.add(formula)
        db.flush()
        design = Design(
            name=design_name, paint_type=PaintType.reactiva, created_by=admin_id
        )
        db.add(design)
        db.flush()
        formula_id, design_id = formula.id, design.id
        db.commit()  # persist: the endpoint reads through its own session
    return formula_id, design_id


def _manual_link(client, headers, formula_id, design_id):
    return client.post(
        f"/api/v1/formulas/{formula_id}/designs",
        headers=headers,
        json={"design_id": design_id},
    )


def _link_row_count(session_factory, formula_id=None, design_id=None) -> int:
    with session_factory() as db:
        stmt = sa.select(sa.func.count()).select_from(FormulaDesign)
        if formula_id is not None:
            stmt = stmt.where(FormulaDesign.formula_id == formula_id)
        if design_id is not None:
            stmt = stmt.where(FormulaDesign.design_id == design_id)
        return db.scalar(stmt)


def _link_create_audit_count(session_factory) -> int:
    with session_factory() as db:
        return db.scalar(
            sa.select(sa.func.count()).select_from(AccessLog).where(
                AccessLog.action == MANUAL_CREATE_AUDIT
            )
        )


def test_manual_link_creates_source_manual_row_and_audit(
    client, auth_headers, session_factory
) -> None:
    """A manual link persists a ``formula_designs`` row with ``source=manual``
    and audits exactly one ``formula_design.create`` row (spec scenario
    "Manual link from formula detail" + "Manual create audited")."""
    headers = auth_headers("admin")
    formula_id, design_id = _seed_formula_and_design(session_factory)
    admin_id = _user_id(session_factory)

    response = _manual_link(client, headers, formula_id, design_id)

    assert response.status_code == 200
    body = response.json()
    assert body["formula_id"] == formula_id
    assert body["design_id"] == design_id
    assert body["source"] == "manual"
    with session_factory() as db:
        row = db.scalar(
            sa.select(FormulaDesign).where(
                FormulaDesign.formula_id == formula_id,
                FormulaDesign.design_id == design_id,
            )
        )
        assert row is not None
        assert row.source == "manual"
        audit = db.scalar(
            sa.select(AccessLog.user_id).where(
                AccessLog.action == MANUAL_CREATE_AUDIT
            )
        )
        assert audit is not None
        assert audit == admin_id


def test_manual_link_missing_formula_404(client, auth_headers, session_factory) -> None:
    """Linking against a formula that does not exist 404s with the formulas
    module's exact detail and writes nothing (spec: link needs both ends)."""
    headers = auth_headers("admin")
    _, design_id = _seed_formula_and_design(session_factory)

    response = _manual_link(client, headers, 99999, design_id)

    assert response.status_code == 404
    assert response.json()["detail"] == "Fórmula no encontrada"
    assert _link_row_count(session_factory) == 0


def test_manual_link_missing_design_404(client, auth_headers, session_factory) -> None:
    """Linking a design that does not exist 404s with the designs module's
    exact detail and writes nothing."""
    headers = auth_headers("admin")
    formula_id, _ = _seed_formula_and_design(session_factory)

    response = _manual_link(client, headers, formula_id, 99999)

    assert response.status_code == 404
    assert response.json()["detail"] == "Diseño no encontrado"
    assert _link_row_count(session_factory) == 0


def test_manual_relink_idempotent_preserves_source_no_duplicate(
    client, auth_headers, session_factory
) -> None:
    """Re-linking an existing pair succeeds (no 409 / no server error), returns
    the EXISTING relation with its ``source`` untouched, writes no second row,
    and audits nothing new (spec scenario "Re-link returns existing"; design
    D4 — idempotent return-the-existing)."""
    headers = auth_headers("admin")
    formula_id, design_id = _seed_formula_and_design(session_factory)

    first = _manual_link(client, headers, formula_id, design_id)
    assert first.status_code == 200

    second = _manual_link(client, headers, formula_id, design_id)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["source"] == "manual"

    assert _link_row_count(session_factory, formula_id, design_id) == 1, (
        "re-linking the same pair must never create a duplicate row"
    )
    assert _link_create_audit_count(session_factory) == 1, (
        "a re-link is not a new create: exactly one formula_design.create audit"
    )


def test_manual_link_second_design_creates_separate_row(
    client, auth_headers, session_factory
) -> None:
    """Triangulation: linking a DIFFERENT design to the same formula creates a
    second row (only the same (formula_id, design_id) pair is idempotent)."""
    headers = auth_headers("admin")
    admin_id = _user_id(session_factory)
    formula_id, design_id = _seed_formula_and_design(session_factory)
    with session_factory() as db:
        other = Design(
            name="Diseño Alterno", paint_type=PaintType.reactiva, created_by=admin_id
        )
        db.add(other)
        db.flush()
        other_id = other.id
        db.commit()  # persist: the link endpoint reads through its own session

    assert _manual_link(client, headers, formula_id, design_id).status_code == 200
    other_link = _manual_link(client, headers, formula_id, other_id)
    assert other_link.status_code == 200
    assert other_link.json()["design_id"] == other_id

    assert _link_row_count(session_factory, formula_id) == 2
    assert _link_create_audit_count(session_factory) == 2


# --- Slice D2: automatic link (source=auto) + formula detail endpoint --------
#
# Inventory spec "Atomic Stock Transaction With Auto Design Link": a ``consumo``
# carrying both a valid ``formula_id`` and a valid ``design_id`` upserts a
# ``formula_designs`` row with ``source=auto`` in the SAME single transaction
# (add+flush→mutate→upsert→log→commit, rollback on any failure). A ``consumo``
# without ``design_id`` leaves it null and creates NO link. Re-linking an
# existing pair by auto is idempotent (design D4): the pair that already exists
# is reused — no duplicate, no IntegrityError. formula-designs spec "Formula
# Detail Endpoint": ``GET /formulas/{id}/detail`` returns the formula plus its
# linked designs merged across auto and manual without any design appearing
# twice; a formula with no links returns an empty list.

AUTO_CREATE_AUDIT = MANUAL_CREATE_AUDIT  # same "formula_design.create" action
TRANSACTION_AUDIT_ACTION = "inventory.transaction"

def _seed_consumo_preconditions(session_factory) -> tuple[int, int, int]:
    """Seed one pantone color, one formula, one design, and one inventory item
    via ORM. Returns ``(formula_id, design_id, item_id)``."""
    with session_factory() as db:
        admin_id = _user_id(session_factory)
        db.add(PantoneColor(code="223C", paint_type=PaintType.reactiva))
        db.flush()
        color_id = db.scalar(
            sa.select(PantoneColor.id).where(PantoneColor.code == "223C")
        )
        formula = Formula(
            pantone_color_id=color_id,
            name="Fórmula Auto 223C",
            created_by=admin_id,
        )
        db.add(formula)
        db.flush()
        design = Design(
            name="Diseño Automático", paint_type=PaintType.reactiva, created_by=admin_id
        )
        db.add(design)
        db.flush()
        item = InventoryItem(
            name="Colorante Auto",
            item_type="colorante",
            unit="kg",
            supplier="Proveedor Auto",
            supply_city="Rosario",
            current_stock=10,
            reorder_threshold=3,
        )
        db.add(item)
        db.flush()
        formula_id, design_id, item_id = formula.id, design.id, item.id
        db.commit()
    return formula_id, design_id, item_id


def _register_consumo(client, headers, item_id, formula_id=None, design_id=None):
    """POST a ``consumo`` against an item with optional formula/design tags."""
    payload = {
        "transaction_type": "consumo",
        "quantity": -2,
        "formula_id": formula_id,
        "design_id": design_id,
    }
    return client.post(
        f"/api/v1/inventory/items/{item_id}/transactions",
        headers=headers,
        json=payload,
    )


def _stock_of(session_factory, item_id: int):
    with session_factory() as db:
        item = db.get(InventoryItem, item_id)
        assert item is not None
        return item.current_stock


def _transaction_count(session_factory) -> int:
    with session_factory() as db:
        return db.scalar(
            sa.select(sa.func.count()).select_from(InventoryTransaction)
        )


def _audit_count(session_factory, action: str) -> int:
    with session_factory() as db:
        return db.scalar(
            sa.select(sa.func.count()).select_from(AccessLog).where(
                AccessLog.action == action
            )
        )


def test_consumo_with_formula_and_design_auto_links_and_audits(
    client, auth_headers, session_factory
) -> None:
    """Spec scenario 'Automatic link from tagged consumption': a ``consumo``
    with valid formula_id + design_id persists a ``formula_designs`` row with
    ``source=auto`` and a single ``formula_design.create`` audit, all in the
    same 201 transaction."""
    headers = auth_headers("admin")
    formula_id, design_id, item_id = _seed_consumo_preconditions(session_factory)

    response = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=design_id
    )

    assert response.status_code == 201
    assert response.json()["formula_id"] == formula_id
    assert response.json()["design_id"] == design_id
    with session_factory() as db:
        row = db.scalar(
            sa.select(FormulaDesign).where(
                FormulaDesign.formula_id == formula_id,
                FormulaDesign.design_id == design_id,
            )
        )
        assert row is not None
        assert row.source == "auto"
    assert _audit_count(session_factory, AUTO_CREATE_AUDIT) == 1, (
        "a new auto pair records exactly one formula_design.create audit"
    )


def test_auto_relink_same_pair_idempotent_no_integrity_error(
    client, auth_headers, session_factory
) -> None:
    """Design D4 idempotent return-the-existing (user confirmation 1): tagging
    the SAME (formula_id, design_id) by auto a second time reuses the existing
    row — no IntegrityError, no duplicate pair, no second formula_design.create
    audit. Both consumos succeed (201), never a 409/500."""
    headers = auth_headers("admin")
    formula_id, design_id, item_id = _seed_consumo_preconditions(session_factory)

    first = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=design_id
    )
    assert first.status_code == 201

    second = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=design_id
    )
    assert second.status_code == 201, (
        "re-tagging an existing pair by auto must NOT error (idempotent)"
    )

    with session_factory() as db:
        rows = db.scalars(
            sa.select(FormulaDesign).where(
                FormulaDesign.formula_id == formula_id,
                FormulaDesign.design_id == design_id,
            )
        ).all()
        assert len(rows) == 1, (
            "auto re-tagging an existing pair must not create a second row"
        )
        assert rows[0].source == "auto"
    assert _audit_count(session_factory, AUTO_CREATE_AUDIT) == 1, (
        "only the first auto tag is a new create; the re-tag audits nothing new"
    )
    assert _transaction_count(session_factory) == 2, (
        "only the two consumos persist; the re-tag is still a real transaction"
    )


def test_consumo_without_design_id_leaves_null_and_no_link(
    client, auth_headers, session_factory
) -> None:
    """Spec scenario 'Consumption without design': omitting design_id persists
    the transaction with design_id null and creates NO formula_designs link."""
    headers = auth_headers("admin")
    formula_id, _, item_id = _seed_consumo_preconditions(session_factory)

    response = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=None
    )

    assert response.status_code == 201
    assert response.json()["design_id"] is None
    assert _link_row_count(session_factory, formula_id) == 0, (
        "a consumo without design_id must never create a link"
    )


def test_auto_consumo_dangling_design_id_400_nothing_persists(
    client, auth_headers, session_factory
) -> None:
    """Design data-flow 'validate formula_id & design_id exist (400 otherwise)':
    a consumo referencing a design that does not exist 400s before any write,
    leaving no txn row, no stock change, and no link."""
    headers = auth_headers("admin")
    formula_id, _, item_id = _seed_consumo_preconditions(session_factory)

    response = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=999999
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Diseño no encontrado"
    assert _transaction_count(session_factory) == 0
    assert _stock_of(session_factory, item_id) == 10
    assert _link_row_count(session_factory, formula_id) == 0


def test_auto_link_rolls_back_when_transaction_fails_after_upsert(
    client, auth_headers, session_factory, monkeypatch
) -> None:
    """User confirmation 3 / spec 'Rollback on mid-operation failure': an audit
    write monkeypatched to raise AFTER the stock mutation and the auto upsert
    have been staged leaves NOTHING persisted — no txn row, stock unchanged, no
    ``formula_designs`` row, and neither audit. The upsert must not survive a
    later failure in the same register_transaction."""
    headers = auth_headers("admin")
    formula_id, design_id, item_id = _seed_consumo_preconditions(session_factory)

    def _boom(_db, _user_id, _action):
        raise RuntimeError("simulated post-upsert inventory.transaction audit failure")

    # Patch the inventory router's own audit reference (runs AFTER the auto
    # upsert staged the formula_designs row and its create audit); the upsert
    # helper's log_action in formula_designs.router stays unpatched, so the
    # failure lands genuinely after the upsert.
    monkeypatch.setattr("app.modules.inventory.router.log_action", _boom)

    with pytest.raises(RuntimeError, match="simulated post-upsert"):
        _register_consumo(
            client, headers, item_id, formula_id=formula_id, design_id=design_id
        )

    assert _transaction_count(session_factory) == 0, "no txn row persists"
    assert _stock_of(session_factory, item_id) == 10, "stock unchanged"
    assert _link_row_count(session_factory, formula_id, design_id) == 0, (
        "the staged auto link must roll back with the failed transaction"
    )
    assert _audit_count(session_factory, AUTO_CREATE_AUDIT) == 0, (
        "no formula_design.create audit persists"
    )
    assert _audit_count(session_factory, TRANSACTION_AUDIT_ACTION) == 0, (
        "no inventory.transaction audit persists"
    )


def test_detail_merges_auto_and_manual_without_duplicates(
    client, auth_headers, session_factory
) -> None:
    """User confirmation 2 / spec 'Detail merges auto and manual without
    duplicates': the same (formula_id, design_id) pair reached once by auto and
    once by manual is listed by GET /formulas/{id}/detail EXACTLY ONCE."""
    headers = auth_headers("admin")
    formula_id, design_id, item_id = _seed_consumo_preconditions(session_factory)

    # auto link (consumo) then manual link (formula detail) on the SAME pair
    auto = _register_consumo(
        client, headers, item_id, formula_id=formula_id, design_id=design_id
    )
    assert auto.status_code == 201
    manual = _manual_link(client, headers, formula_id, design_id)
    assert manual.status_code == 200

    response = client.get(
        f"/api/v1/formulas/{formula_id}/detail", headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == formula_id
    design_ids = [d["id"] for d in body["designs"]]
    assert design_ids == [design_id], (
        "a design linked by both auto and manual must appear exactly once"
    )
    (design,) = body["designs"]
    assert design["name"] == "Diseño Automático"
    assert design["client"] is None
    assert design["notes"] is None


def test_detail_formula_without_designs_empty_list(
    client, auth_headers, session_factory
) -> None:
    """Spec scenario 'Formula without designs': a formula with no links returns
    an empty designs list."""
    headers = auth_headers("admin")
    formula_id, _, _ = _seed_consumo_preconditions(session_factory)

    response = client.get(
        f"/api/v1/formulas/{formula_id}/detail", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["designs"] == []


def test_detail_missing_formula_404(
    client, auth_headers, session_factory
) -> None:
    """Spec: a formula that does not exist 404s with the formulas module's
    exact detail."""
    headers = auth_headers("admin")

    response = client.get("/api/v1/formulas/999999/detail", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Fórmula no encontrada"