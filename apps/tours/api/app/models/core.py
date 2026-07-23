"""apps/tours/api/app/models/core.py

Core contable models — shared by every future module. Separated from
`models/tours.py` so adding a new module never touches these tables
(D-22 listado: usuarios, contactos, cuentas, asientos, asiento_lineas,
audit_log, modulos).
"""
from datetime import date, datetime
from enum import Enum as _Enum
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.audit import Auditable
from app.database import Base


class Rol(_Enum):
    admin = "admin"
    vendedor = "vendedor"
    contabilidad = "contabilidad"


class TipoCuenta(_Enum):
    activo = "activo"
    pasivo = "pasivo"
    ingreso = "ingreso"
    costo = "costo"
    gasto = "gasto"
    patrimonio = "patrimonio"


class MonedaCodigo(_Enum):
    PEN = "PEN"
    USD = "USD"


class Modulos(Base, Auditable):
    __tablename__ = "modulos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Contactos(Base, Auditable):
    """Mini-tabla de contacto — usada por agencias y vendedores (herencia polimórfica por tipo)."""
    __tablename__ = "contactos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo: Mapped[str] = mapped_column(String(16), nullable=False)  # agencia|vendedor|cliente|proveedor
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    ruc: Mapped[str | None] = mapped_column(String(32), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)


class Usuarios(Base, Auditable):
    __tablename__ = "usuarios"
    __sensitive_fields__ = {"password_hash"}  # D-26

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    rol: Mapped[Rol] = mapped_column(Enum(Rol), nullable=False, default=Rol.vendedor)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Cuentas(Base, Auditable):
    __tablename__ = "cuentas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    tipo: Mapped[TipoCuenta] = mapped_column(Enum(TipoCuenta), nullable=False)
    moneda: Mapped[MonedaCodigo] = mapped_column(Enum(MonedaCodigo), nullable=False)  # D-08
    padre_id: Mapped[int | None] = mapped_column(ForeignKey("cuentas.id"), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Asientos(Base, Auditable):
    __tablename__ = "asientos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    concepto: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    modulos_id: Mapped[int | None] = mapped_column(ForeignKey("modulos.id"), nullable=True)
    creacion_usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)


class AsientoLineas(Base, Auditable):
    __tablename__ = "asiento_lineas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asiento_id: Mapped[int] = mapped_column(ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False)
    cuenta_id: Mapped[int] = mapped_column(ForeignKey("cuentas.id"), nullable=False)
    debe: Mapped[float] = mapped_column(nullable=False, default=0)
    haber: Mapped[float] = mapped_column(nullable=False, default=0)
    # NO `moneda` column — inferred from cuentas.moneda (D-08).


class AuditLog(Base):
    """NOT Auditable — never written to audit_log about itself (D-22)."""
    __tablename__ = "audit_log"
    __auditable__ = False

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tabla: Mapped[str] = mapped_column(String(64), nullable=False)
    registro_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    operacion: Mapped[str] = mapped_column(String(1), nullable=False)  # I|U|D
    datos_antes: Mapped[str | None] = mapped_column(Text, nullable=True)
    datos_despues: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_audit_log_tabla_registro_ts", "tabla", "registro_id", "timestamp"),
    )