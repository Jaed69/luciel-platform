"""vendedores.usuario_id — link a vendedor row to its owning Usuarios row (D-32)

Revision ID: 006
Revises: 005
Create Date: 2026-07-23

`create_all` on startup does not alter existing tables, so this is an
explicit migration (see apps/tours/CLAUDE.md — Schema/migrations). Nullable
and unique: legacy vendedor rows predating this feature stay unlinked.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("vendedores") as batch_op:
        batch_op.add_column(sa.Column("usuario_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_vendedores_usuario_id", "usuarios", ["usuario_id"], ["id"]
        )
        batch_op.create_unique_constraint("uq_vendedores_usuario_id", ["usuario_id"])


def downgrade() -> None:
    with op.batch_alter_table("vendedores") as batch_op:
        batch_op.drop_constraint("uq_vendedores_usuario_id", type_="unique")
        batch_op.drop_constraint("fk_vendedores_usuario_id", type_="foreignkey")
        batch_op.drop_column("usuario_id")
