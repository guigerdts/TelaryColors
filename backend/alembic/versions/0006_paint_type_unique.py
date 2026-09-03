"""change pantone_colors unique from code to (code, paint_type)

Revision ID: 0006_paint_type_unique
Revises: 0005_hex_color
Create Date: 2026-09-03

Replace the single-column ``UNIQUE(code)`` constraint on ``pantone_colors``
with a composite ``UNIQUE(code, paint_type)`` constraint.  This allows the
same Pantone code (e.g. "Black") to exist once per paint type (reactiva and
pigmento) while still preventing true duplicates.

SQLite does not support ``ALTER TABLE DROP CONSTRAINT`` and Alembic's batch
mode cannot locate unnamed auto-generated constraints by string name.  The
approach is: recreate the table from scratch with the new schema, copy all
rows, drop the old table, and rename the new one.  The existing
``ix_pantone_colors_code`` index is recreated for prefix-search performance.

Downgrade restores the original ``UNIQUE(code)`` constraint.
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_paint_type_unique"
down_revision = "0005_hex_color"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: create new table with composite unique constraint
    op.create_table(
        "pantone_colors_new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("gamut", sa.String(), nullable=False, server_default="C"),
        sa.Column("paint_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("hex_color", sa.String(), nullable=True),
        sa.UniqueConstraint("code", "paint_type", name="uq_pantone_code_paint_type"),
    )

    # Step 2: copy all existing rows
    op.execute(
        "INSERT INTO pantone_colors_new (id, code, gamut, paint_type, created_at, hex_color) "
        "SELECT id, code, gamut, paint_type, created_at, hex_color FROM pantone_colors"
    )

    # Step 3: drop old table and rename new
    op.drop_table("pantone_colors")
    op.rename_table("pantone_colors_new", "pantone_colors")

    # Step 4: recreate the code index for prefix search
    op.create_index("ix_pantone_colors_code", "pantone_colors", ["code"])


def downgrade() -> None:
    # Safety check: before restoring UNIQUE(code), verify no code appears in
    # more than one paint_type.  If duplicates exist, abort — restoring the
    # old constraint would require deleting rows, which this migration never
    # does automatically.
    conn = op.get_bind()
    duplicates = conn.execute(
        sa.text(
            "SELECT code, COUNT(*) AS cnt FROM pantone_colors "
            "GROUP BY code HAVING cnt > 1"
        )
    ).fetchall()
    if duplicates:
        codes = ", ".join(f"{row[0]} ({row[1]} registros)" for row in duplicates)
        raise RuntimeError(
            "Downgrade 0006 bloqueado: existen códigos con múltiples tipos de "
            f"pintura: {codes}.  Para volver a UNIQUE(code), primero consolidá "
            "manualmente estos registros (eliminar los duplicados) y luego "
            "ejecutá el downgrade nuevamente."
        )

    # No duplicates — safe to restore UNIQUE(code).
    op.create_table(
        "pantone_colors_old",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("gamut", sa.String(), nullable=False, server_default="C"),
        sa.Column("paint_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("hex_color", sa.String(), nullable=True),
        sa.UniqueConstraint("code"),
    )

    op.execute(
        "INSERT INTO pantone_colors_old (id, code, gamut, paint_type, created_at, hex_color) "
        "SELECT id, code, gamut, paint_type, created_at, hex_color FROM pantone_colors"
    )

    op.drop_table("pantone_colors")
    op.rename_table("pantone_colors_old", "pantone_colors")
    op.create_index("ix_pantone_colors_code", "pantone_colors", ["code"])
