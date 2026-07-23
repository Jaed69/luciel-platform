"""solicitudes — feedback/mejora/bug tickets (D-28)

Revision ID: 003
Revises: 002
Create Date: 2026-07-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "solicitudes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("titulo", sa.String(160), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("tipo", sa.Enum("bug", "mejora", "solicitud", name="tiposolicitud"), nullable=False),
        sa.Column("prioridad", sa.Enum("baja", "media", "alta", name="prioridadsolicitud"), nullable=False, server_default="media"),
        sa.Column("estado", sa.Enum("abierto", "en_revision", "resuelto", "descartado", name="estadosolicitud"), nullable=False, server_default="abierto"),
        sa.Column("pagina_origen", sa.String(256), nullable=True),
        sa.Column("creado_por", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("respuesta", sa.Text, nullable=True),
        sa.Column("resuelto_por", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("resuelto_en", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("solicitudes")
