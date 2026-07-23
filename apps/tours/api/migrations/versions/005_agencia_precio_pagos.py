"""precio por agencia + cuentas y pagos por pagar a agencias (D-30)

Revision ID: 005
Revises: 004
Create Date: 2026-07-23

Adds the 202-AGENCIAS-POR-PAGAR-PEN/USD liability accounts, the
agencia_tour_precios price list table, the agencia_pagos ledger table, and
upserts the 3 real agencias (Cusco Top, Andean, Guty) by codigo — leaves any
existing agencia row alone (same upsert-by-codigo pattern as 004_tipos_tour).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AGENCIAS = [
    ("AG-CUSCOTOP", "Cusco Top"),
    ("AG-ANDEAN", "Andean"),
    ("AG-GUTY", "Guty"),
]

CUENTAS = [
    ("202-AGENCIAS-POR-PAGAR-PEN", "Agencias por pagar (PEN)", "pasivo", "PEN"),
    ("202-AGENCIAS-POR-PAGAR-USD", "Agencias por pagar (USD)", "pasivo", "USD"),
]


def upgrade() -> None:
    conn = op.get_bind()

    cuentas = sa.table(
        "cuentas",
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        sa.column("tipo", sa.Enum("activo", "pasivo", "ingreso", "costo", "gasto", "patrimonio", name="tipocuenta")),
        sa.column("moneda", sa.Enum("PEN", "USD", name="monedacodigo")),
        sa.column("activo", sa.Boolean),
    )
    existing_cuentas = {row[0] for row in conn.execute(sa.text("SELECT codigo FROM cuentas"))}
    cuentas_to_insert = [
        {"codigo": codigo, "nombre": nombre, "tipo": tipo, "moneda": moneda, "activo": True}
        for codigo, nombre, tipo, moneda in CUENTAS
        if codigo not in existing_cuentas
    ]
    if cuentas_to_insert:
        op.bulk_insert(cuentas, cuentas_to_insert)

    agencias = sa.table(
        "agencias",
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        sa.column("activo", sa.Boolean),
    )
    existing_agencias = {row[0] for row in conn.execute(sa.text("SELECT codigo FROM agencias"))}
    agencias_to_insert = [
        {"codigo": codigo, "nombre": nombre, "activo": True}
        for codigo, nombre in AGENCIAS
        if codigo not in existing_agencias
    ]
    if agencias_to_insert:
        op.bulk_insert(agencias, agencias_to_insert)

    op.create_table(
        "agencia_tour_precios",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agencia_id", sa.Integer, sa.ForeignKey("agencias.id"), nullable=False),
        sa.Column("tour_id", sa.Integer, sa.ForeignKey("tours_catalogo.id"), nullable=False),
        sa.Column("precio", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_usd", sa.Numeric(12, 2), nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.UniqueConstraint("agencia_id", "tour_id", name="uq_agencia_tour_precios_agencia_tour"),
    )
    op.create_table(
        "agencia_pagos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agencia_id", sa.Integer, sa.ForeignKey("agencias.id"), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("moneda", sa.Enum("PEN", "USD", name="monedacodigo5"), nullable=False),
        sa.Column("metodo", sa.Enum("deposito", "comprobante", name="metodopagoagencia"), nullable=False),
        sa.Column("referencia", sa.String(128), nullable=True),
        sa.Column("nota", sa.Text, nullable=True),
        sa.Column("creado_por", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("asiento_id", sa.Integer, sa.ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("agencia_pagos")
    op.drop_table("agencia_tour_precios")
    conn = op.get_bind()
    codigos_agencias = tuple(c for c, _ in AGENCIAS)
    conn.execute(
        sa.text("DELETE FROM agencias WHERE codigo IN :codigos").bindparams(sa.bindparam("codigos", expanding=True)),
        {"codigos": list(codigos_agencias)},
    )
    codigos_cuentas = tuple(c for c, _, _, _ in CUENTAS)
    conn.execute(
        sa.text("DELETE FROM cuentas WHERE codigo IN :codigos").bindparams(sa.bindparam("codigos", expanding=True)),
        {"codigos": list(codigos_cuentas)},
    )
