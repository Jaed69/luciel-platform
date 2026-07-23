"""agencia_tour_precios.precio nullable — allow single-currency price (D-32)

Revision ID: 007
Revises: 006
Create Date: 2026-07-23

Precio en agencia×tour ya no obliga a cargar PEN — puede ser solo USD.
AgenciaTourPrecioIn valida a nivel de API que al menos una moneda esté
presente; el esquema solo relaja la restricción NOT NULL.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("agencia_tour_precios") as batch_op:
        batch_op.alter_column("precio", existing_type=sa.Numeric(12, 2), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("agencia_tour_precios") as batch_op:
        batch_op.alter_column("precio", existing_type=sa.Numeric(12, 2), nullable=False)
