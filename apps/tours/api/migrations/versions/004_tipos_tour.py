"""tipos de tour — tiempo column + 9 real tour types (D-29)

Revision ID: 004
Revises: 003
Create Date: 2026-07-23

Adds `tiempo` (free-text duration) to tours_catalogo, then upserts the 9 real
tour types by codigo. Upsert = insert only if the codigo doesn't already
exist, so this is safe to run against a DB that already had the old demo
seed row ("T-001" / City Tour Cusco) — that row is left alone (not deleted),
just no longer the only one.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TIPOS_TOUR = [
    ("T-7LAGUNAS", "7 Lagunas"),
    ("T-CTMANANA", "City Tour / T. Mañana"),
    ("T-CTTARDE", "City Tour / T. Tarde"),
    ("T-HUMANTAY", "Laguna Humantay"),
    ("T-VSVIP", "Valle Sagrado VIP"),
    ("T-VSTRAD", "Valle Sagrado Tradicional"),
    ("T-MOTOCROSS", "Motocross"),
    ("T-VSUR", "Valle Sur"),
    ("T-MACHUPICCHU", "Machu Picchu"),
]


def upgrade() -> None:
    op.add_column("tours_catalogo", sa.Column("tiempo", sa.String(64), nullable=True))

    conn = op.get_bind()
    tours_catalogo = sa.table(
        "tours_catalogo",
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        sa.column("moneda_default", sa.Enum("PEN", "USD", name="monedacodigo")),
        sa.column("activo", sa.Boolean),
    )
    existing = {row[0] for row in conn.execute(sa.text("SELECT codigo FROM tours_catalogo"))}
    to_insert = [
        {"codigo": codigo, "nombre": nombre, "moneda_default": "PEN", "activo": True}
        for codigo, nombre in TIPOS_TOUR
        if codigo not in existing
    ]
    if to_insert:
        op.bulk_insert(tours_catalogo, to_insert)


def downgrade() -> None:
    conn = op.get_bind()
    codigos = tuple(c for c, _ in TIPOS_TOUR)
    conn.execute(sa.text("DELETE FROM tours_catalogo WHERE codigo IN :codigos").bindparams(sa.bindparam("codigos", expanding=True)), {"codigos": list(codigos)})
    with op.batch_alter_table("tours_catalogo") as batch_op:
        batch_op.drop_column("tiempo")
