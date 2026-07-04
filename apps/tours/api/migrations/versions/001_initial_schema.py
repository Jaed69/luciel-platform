"""initial schema — core contable + módulo Tours

Revision ID: 001
Revises:
Create Date: 2026-07-04

Creates all tables for Plan 02.1-01. Schema separates core (usuarios, contactos,
cuentas, asientos, asiento_lineas, audit_log, modulos) from módulo Tours
(agencias, vendedores, tours_catalogo, formas_pago, monedas, comision_reglas,
liquidaciones, tours_servicios).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Core
    op.create_table(
        "modulos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(64), unique=True, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "contactos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tipo", sa.String(16), nullable=False),
        sa.Column("nombre", sa.String(128), nullable=False),
        sa.Column("ruc", sa.String(32), nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.Column("metadata", sa.JSON, nullable=True),
    )
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(128), unique=True, nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("rol", sa.Enum("admin", "vendedor", "contabilidad", name="rol"), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("ultimo_acceso", sa.DateTime, nullable=True),
    )
    op.create_table(
        "cuentas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(32), unique=True, nullable=False),
        sa.Column("nombre", sa.String(128), nullable=False),
        sa.Column("tipo", sa.Enum("activo", "pasivo", "ingreso", "costo", "gasto", "patrimonio", name="tipocuenta"), nullable=False),
        sa.Column("moneda", sa.Enum("PEN", "USD", name="monedacodigo"), nullable=False),
        sa.Column("padre_id", sa.Integer, sa.ForeignKey("cuentas.id"), nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "asientos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("concepto", sa.Text, nullable=False),
        sa.Column("metadata", sa.JSON, nullable=True),
        sa.Column("modulos_id", sa.Integer, sa.ForeignKey("modulos.id"), nullable=True),
        sa.Column("creacion_usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=True),
    )
    op.create_table(
        "asiento_lineas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("asiento_id", sa.Integer, sa.ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cuenta_id", sa.Integer, sa.ForeignKey("cuentas.id"), nullable=False),
        sa.Column("debe", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("haber", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tabla", sa.String(64), nullable=False),
        sa.Column("registro_id", sa.Integer, nullable=True),
        sa.Column("operacion", sa.String(1), nullable=False),
        sa.Column("datos_antes", sa.Text, nullable=True),
        sa.Column("datos_despues", sa.Text, nullable=True),
        sa.Column("usuario_id", sa.Integer, nullable=True),
        sa.Column("timestamp", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_log_tabla_registro_ts", "audit_log", ["tabla", "registro_id", "timestamp"])

    # Tours module
    op.create_table(
        "agencias",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(32), unique=True, nullable=False),
        sa.Column("nombre", sa.String(128), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "vendedores",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(32), unique=True, nullable=False),
        sa.Column("nombre", sa.String(128), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "tours_catalogo",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(32), unique=True, nullable=False),
        sa.Column("nombre", sa.String(128), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("precio_default", sa.Numeric(12, 2), nullable=True),
        sa.Column("precio_default_usd", sa.Numeric(12, 2), nullable=True),
        sa.Column("moneda_default", sa.Enum("PEN", "USD", name="monedacodigo2"), nullable=False, server_default="PEN"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "formas_pago",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(64), unique=True, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "monedas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(8), unique=True, nullable=False),
        sa.Column("nombre", sa.String(32), nullable=False),
        sa.Column("simbolo", sa.String(4), nullable=False),
    )
    op.create_table(
        "comision_reglas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("vendedor_id", sa.Integer, sa.ForeignKey("vendedores.id"), nullable=True),
        sa.Column("tour_id", sa.Integer, sa.ForeignKey("tours_catalogo.id"), nullable=True),
        sa.Column("porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("1")),
        sa.UniqueConstraint("vendedor_id", "tour_id", name="uq_comision_reglas_vendedor_tour"),
    )
    op.create_table(
        "liquidaciones",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(32), unique=True, nullable=True),
        sa.Column("fecha_desde", sa.Date, nullable=False),
        sa.Column("fecha_hasta", sa.Date, nullable=False),
        sa.Column("estado", sa.Enum("abierta", "cerrada", "revertida", name="estadoliquidacion"), nullable=False, server_default="abierta"),
        sa.Column("vendedor_id", sa.Integer, sa.ForeignKey("vendedores.id"), nullable=True),
        sa.Column("agencia_id", sa.Integer, sa.ForeignKey("agencias.id"), nullable=True),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("cerrada_en", sa.DateTime, nullable=True),
        sa.Column("reopen_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "tours_servicios",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tour_id", sa.Integer, sa.ForeignKey("tours_catalogo.id"), nullable=False),
        sa.Column("vendedor_id", sa.Integer, sa.ForeignKey("vendedores.id"), nullable=False),
        sa.Column("agencia_id", sa.Integer, sa.ForeignKey("agencias.id"), nullable=False),
        sa.Column("forma_pago_id", sa.Integer, sa.ForeignKey("formas_pago.id"), nullable=False),
        sa.Column("moneda", sa.Enum("PEN", "USD", name="monedacodigo3"), nullable=False),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("costo", sa.Numeric(12, 2), nullable=True),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("asiento_id", sa.Integer, sa.ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("liquidacion_id", sa.Integer, sa.ForeignKey("liquidaciones.id"), nullable=True),
        sa.Column("metadata", sa.Text, nullable=True),
    )


def downgrade() -> None:
    for table in (
        "tours_servicios", "liquidaciones", "comision_reglas", "monedas", "formas_pago",
        "tours_catalogo", "vendedores", "agencias",
        "audit_log", "asiento_lineas", "asientos", "cuentas", "usuarios", "contactos", "modulos",
    ):
        op.drop_table(table)
    op.drop_index("ix_audit_log_tabla_registro_ts", table_name="audit_log")