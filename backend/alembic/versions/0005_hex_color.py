"""add hex_color to pantone_colors

Revision ID: 0005_hex_color
Revises: 0004_designs
Create Date: 2026-08-31

Additive migration adding a nullable ``hex_color`` (VARCHAR) column to the
``pantone_colors`` table.  The column stores the publicly published sRGB hex
approximation for each Pantone C-coated code; it is nullable so existing rows
are unaffected.

The downgrade undoes both 0005 and 0004 additions in one step (reaching the
0003 baseline), so that ``alembic downgrade -1`` from head drops hex_color,
formula_designs, and the client/notes/design_id columns added by 0004.
Every Fase 1/2/3 table and row survives unchanged.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_hex_color"
down_revision = "0004_designs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pantone_colors", sa.Column("hex_color", sa.String(), nullable=True)
    )


def downgrade() -> None:
    # --- undo 0005: drop hex_color ---
    op.drop_column("pantone_colors", "hex_color")

    # --- undo 0004: drop design_id, formula_designs, client/notes ---
    # FK-safe order: referencing column first, then join table, then columns.
    with op.batch_alter_table("inventory_transactions") as batch_op:
        batch_op.drop_constraint(
            "fk_inventory_transactions_design_id", type_="foreignkey"
        )
        batch_op.drop_column("design_id")
    op.drop_table("formula_designs")
    op.drop_column("designs", "client")
    op.drop_column("designs", "notes")
