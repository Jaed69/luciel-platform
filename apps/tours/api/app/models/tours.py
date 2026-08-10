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


class TipoServicio(_Enum):
    """Qué se vendió en una fila de `tours_servicios` (D-34).

    `traslado` comparte toda la maquinaria contable del tour (asiento
    balanceado, edición, borrado con reversión). Se diferencia en que lo presta
    un proveedor de transporte, lleva los datos operativos del huésped y no
    entra en las liquidaciones de comisión.
    """
    tour = "tour"
    traslado = "traslado"


class TipoAgencia(_Enum):
    """Con qué línea de negocio trabaja el proveedor (D-34).

    Son listas que no se mezclan: quien opera un tour no es quien hace un
    traslado, y el formulario de cada uno sólo ofrece los suyos. El hotel no es
    una entidad acá — el hotel somos nosotros, y el margen del traslado es
    nuestro, no una deuda con un tercero.
    """
    proveedor_tour = "proveedor_tour"
    proveedor_transporte = "proveedor_transporte"


class TipoSolicitud(_Enum):
    bug = "bug"
    mejora = "mejora"
    solicitud = "solicitud"


class PrioridadSolicitud(_Enum):
    baja = "baja"
    media = "media"
    alta = "alta"


class EstadoSolicitud(_Enum):
    abierto = "abierto"
    en_revision = "en_revision"
    resuelto = "resuelto"
    descartado = "descartado"


class MetodoPagoAgencia(_Enum):
    deposito = "deposito"
    comprobante = "comprobante"


class Agencias(Base, Auditable):
    __tablename__ = "agencias"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # D-34 — las filas previas a traslados son todas agencias de tour.
    tipo: Mapped[TipoAgencia] = mapped_column(
        Enum(TipoAgencia), nullable=False, default=TipoAgencia.proveedor_tour, server_default="proveedor_tour"
    )


class Vendedores(Base, Auditable):
    __tablename__ = "vendedores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # D-32 — link to the Usuarios row that owns this vendedor identity. Nullable:
    # legacy rows predating this link (e.g. seeded V-001) stay unlinked on purpose,
    # never auto-matched by name heuristics.
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), unique=True, nullable=True)


class ToursCatalogo(Base, Auditable):
    __tablename__ = "tours_catalogo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(128), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiempo: Mapped[str | None] = mapped_column(String(64), nullable=True)  # texto libre, ej. "3 horas", "Full day"
    precio_default: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # PEN
    precio_default_usd: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    moneda_default: Mapped[MonedaCodigo] = mapped_column(Enum(MonedaCodigo), nullable=False, default=MonedaCodigo.PEN)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AgenciaTourPrecio(Base, Auditable):
    """Precio de lista que cada agencia pone para cada tipo de tour (D-30) —
    es lo que le debemos cuando vendemos ese tour para esa agencia."""
    __tablename__ = "agencia_tour_precios"
    __table_args__ = (
        UniqueConstraint("agencia_id", "tour_id", name="uq_agencia_tour_precios_agencia_tour"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agencia_id: Mapped[int] = mapped_column(ForeignKey("agencias.id"), nullable=False)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours_catalogo.id"), nullable=False)
    # D-32 — costo en una sola moneda es válido (no obliga a cargar ambas);
    # AgenciaTourPrecioIn exige que al menos una de las dos esté presente.
    costo: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # PEN
    costo_usd: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # D-33 — used to tie-break "which agencia should the venta modal default
    # to" when a tour has 2+ active price agreements (most recent wins).
    # `default` (not only `server_default`): on deployed DBs this column was
    # added by schema_sync's ALTER TABLE, which SQLite cannot give a
    # CURRENT_TIMESTAMP default, so the INSERT itself must carry the value.
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )


class AgenciaPagos(Base, Auditable):
    """Pago registrado a una agencia, reduce la deuda acumulada vía `ToursServicios.costo` (D-30)."""
    __tablename__ = "agencia_pagos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agencia_id: Mapped[int] = mapped_column(ForeignKey("agencias.id"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    moneda: Mapped[MonedaCodigo] = mapped_column(Enum(MonedaCodigo), nullable=False)
    metodo: Mapped[MetodoPagoAgencia] = mapped_column(Enum(MetodoPagoAgencia), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(128), nullable=True)
    nota: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_por: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    asiento_id: Mapped[int] = mapped_column(ForeignKey("asientos.id", ondelete="RESTRICT"), nullable=False)


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
    # D-33 — needed for the DELETE /ventas/{id} undo window (only allowed
    # within 10s of creation). Same ALTER-added-column caveat as
    # AgenciaTourPrecio.creado_en: the INSERT must carry the value itself.
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )

    # ----------------------------------------------------------------- #
    # D-34 — traslados. Todas nullable: son campos operativos que sólo
    # aplican cuando tipo_servicio == 'traslado'; TrasladoIn los exige a
    # nivel API. `tour_id` sigue apuntando a la fila de catálogo genérica
    # SRV-TRASLADO (el destino real es texto libre acá) — así no hay que
    # reconstruir tours_servicios para relajar su NOT NULL.
    # ----------------------------------------------------------------- #
    tipo_servicio: Mapped[TipoServicio] = mapped_column(
        Enum(TipoServicio), nullable=False, default=TipoServicio.tour, server_default="tour"
    )
    # Cuándo se presta el servicio, que no es cuándo se cobra (D-34): `fecha` es
    # la fecha contable — el día que entra la plata y que fecha el asiento— y
    # ésta es la operativa, el día del traslado. Suelen coincidir, por eso el
    # formulario la arrastra por defecto, pero no siempre.
    fecha_servicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    destino: Mapped[str | None] = mapped_column(String(128), nullable=True)
    nombre_huesped: Mapped[str | None] = mapped_column(String(128), nullable=True)
    numero_habitacion: Mapped[str | None] = mapped_column(String(16), nullable=True)
    hora: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    # D-35 — precio_default/costo de un tour son por pasajero, no un monto
    # plano por reserva; monto/costo de la venta = unitario × cantidad
    # (calculado en el frontend, el backend solo persiste lo que llega).
    cantidad_pasajeros: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    nombre_pasajero: Mapped[str | None] = mapped_column(String(128), nullable=True)


class Solicitudes(Base, Auditable):
    """Tickets de feedback/mejora/bug reportados desde el panel (D-28)."""
    __tablename__ = "solicitudes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[TipoSolicitud] = mapped_column(Enum(TipoSolicitud), nullable=False)
    prioridad: Mapped[PrioridadSolicitud] = mapped_column(Enum(PrioridadSolicitud), nullable=False, default=PrioridadSolicitud.media)
    estado: Mapped[EstadoSolicitud] = mapped_column(Enum(EstadoSolicitud), nullable=False, default=EstadoSolicitud.abierto)
    pagina_origen: Mapped[str | None] = mapped_column(String(256), nullable=True)
    creado_por: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    respuesta: Mapped[str | None] = mapped_column(Text, nullable=True)
    resuelto_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    resuelto_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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