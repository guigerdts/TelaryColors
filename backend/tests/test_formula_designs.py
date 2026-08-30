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

import sqlalchemy as sa

from app.db.enums import PaintType
from app.modules.access_logs.models import AccessLog
from app.modules.designs.models import Design, FormulaDesign
from app.modules.formulas.models import Formula
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