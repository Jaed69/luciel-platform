"""apps/tours/api/app/models/tours.py

Módulo Tours schema. Catálogos (agencias, vendedores, tours, formas_pago,
monedas) + comision_reglas (con default global 50/50 non-deletable, D-10) +
liquidaciones (skeleton — close/reopen en Plan 02) + tours_servicios (con FK
asiento_id al asiento balanceado, D-15).

Agencias/Vendedores are standalone (no Contactos FK) per plan note: más simple,
menos joins, YAGNI hasta que herencia polimórfica sea necesaria.
"""
from datetime import date, datetime
from enum import Enum as _Enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.audit import Auditable
from app.database import Base
from app.models.core import MonedaCodigo


class EstadoLiquidacion(_Enum):
    abierta = "abierta"
    cerrada = "cerrada"
    revertida = "revertida"


class Agencias(Base, Auditable):
    __tablename__ = "agencias"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Vendedores(Base, Auditable):
    __tablename__ = "vendedores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ToursCatalogo(Base, Auditable):
    __tablename__ = "tours_catalogo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    precio_default: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # PEN
    precio_default_usd: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    moneda_default: Mapped[MonedaCodigo] = mapped_column(Enum(MonedaCodigo), nullable=False, default=MonedaCodigo.PEN)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class FormasPago(Base, Auditable):
    __tablename__ = "formas_pago"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Monedas(Base, Auditable):
    __tablename__ = "monedas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)  # PEN|USD
    nombre: Mapped[str] = mapped_column(String(32), nullable=False)
    simbolo: Mapped[str] = mapped_column(String(4), nullable=False)


class ComisionReglas(Base, Auditable):
    __tablename__ = "comision_reglas"
    __table_args__ = (
        # NULLs-distinct in SQLite — UNIQUE allows multiple NULL rows (Pitfall 5).
        UniqueConstraint("vendedor_id", "tour_id", name="uq_comision_reglas_vendedor_tour"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendedor_id: Mapped[int | None] = mapped_column(ForeignKey("vendedores.id"), nullable=True)
    tour_id: Mapped[int | None] = mapped_column(ForeignKey("tours_catalogo.id"), nullable=True)
    porcentaje: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Liquidaciones(Base, Auditable):
    __tablename__ = "liquidaciones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)  # LIQ-AAAA-NNN
    fecha_desde: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[EstadoLiquidacion] = mapped_column(Enum(EstadoLiquidacion), nullable=False, default=EstadoLiquidacion.abierta)
    vendedor_id: Mapped[int | None] = mapped_column(ForeignKey("vendedores.id"), nullable=True)
    agencia_id: Mapped[int | None] = mapped_column(ForeignKey("agencias.id"), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    cerrada_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reopen_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ToursServicios(Base, Auditable):
    __tablename__ = "tours_servicios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours_catalogo.id"), nullable=False)
    vendedor_id: Mapped[int] = mapped_column(ForeignKey("vendedores.id"), nullable=False)
    agencia_id: Mapped[int] = mapped_column(ForeignKey("agencias.id"), nullable=False)
    forma_pago_id: Mapped[int] = mapped_column(ForeignKey("formas_pago.id"), nullable=False)
    moneda: Mapped[MonedaCodigo] = mapped_column(Enum(MonedaCodigo), nullable=False)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    costo: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    asiento_id: Mapped[int] = mapped_column(ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False)  # D-15
    liquidacion_id: Mapped[int | None] = mapped_column(ForeignKey("liquidaciones.id"), nullable=True)
    metadata_: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)  # JSON serialized


class LiquidacionAsientos(Base):
    """Pivote liquidación ↔ asiento, distingue cierre vs reversiones.

    NO es `Auditable` — es puramente bookkeeping (no genera audit_log propio),
    el asiento referenciado ya es auditable.
    """
    __tablename__ = "liquidacion_asientos"
    __auditable__ = False

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    liquidacion_id: Mapped[int] = mapped_column(ForeignKey("liquidaciones.id", ondelete="RESTRICT"), nullable=False)
    asiento_id: Mapped[int] = mapped_column(ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(16), nullable=False)  # cierre | reversion