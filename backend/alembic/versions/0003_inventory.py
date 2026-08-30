"""add the inventory tables plus their supporting indexes

Revision ID: 0003_inventory
Revises: 0002_samples
Create Date: 2026-08-29

Additive, handwritten migration that grows the schema from the Fase 2 baseline
(0002_samples) to ten domain tables by adding ``inventory_items`` and
``inventory_transactions`` (inventory spec "Inventory Data Model", design
"Migration / Rollout"). It only creates the two new tables plus the three
lookup indexes (``item_type``, ``reorder_threshold``, ``inventory_item_id``)
and the downgrade drops exactly those — no Fase 1/2 table is touched (spec
scenarios "Migration adds tables" and "Downgrade is additive-safe").

Column types mirror the SQLAlchemy 2.0 models in
``app/modules/inventory/models.py``: the ``item_type``/``transaction_type``
enums are stored as VARCHAR (SQLite has no native enum, design ADR-5),
quantities as fixed-precision NUMERIC (design ADR-5), timestamps as naive-UTC
DATETIME.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_inventory"
down_revision = "0002_samples"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("supplier", sa.String(), nullable=False),
        sa.Column("supply_city", sa.String(), nullable=False),
        sa.Column("current_stock", sa.Numeric(10, 4), nullable=False),
        sa.Column("reorder_threshold", sa.Numeric(10, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_inventory_items_item_type", "inventory_items", ["item_type"]
    )
    op.create_index(
        "ix_inventory_items_reorder_threshold",
        "inventory_items",
        ["reorder_threshold"],
    )

    op.create_table(
        "inventory_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "inventory_item_id",
            sa.Integer(),
            sa.ForeignKey("inventory_items.id"),
            nullable=False,
        ),
        sa.Column("transaction_type", sa.String(length=30), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 4), nullable=False),
        sa.Column(
            "formula_id",
            sa.Integer(),
            sa.ForeignKey("formulas.id"),
            nullable=True,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_inventory_transactions_inventory_item_id",
        "inventory_transactions",
        ["inventory_item_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inventory_transactions_inventory_item_id",
        table_name="inventory_transactions",
    )
    op.drop_table("inventory_transactions")
    op.drop_index(
        "ix_inventory_items_reorder_threshold", table_name="inventory_items"
    )
    op.drop_index("ix_inventory_items_item_type", table_name="inventory_items")
    op.drop_table("inventory_items")