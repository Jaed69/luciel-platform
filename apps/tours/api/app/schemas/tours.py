"""apps/tours/api/app/schemas/tours.py — request/response shapes for tours endpoints."""
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.tours import EstadoSolicitud, MetodoPagoAgencia, PrioridadSolicitud, TipoSolicitud

# D-33 — closed set of reasons a vendedor may give when overriding costo/monto
# away from the agencia's list price. Anything else is a 422.
MotivoEdicion = Literal["convenio_desactualizado", "descuento_especial", "error_de_carga", "otro"]


class TipoTourCreateIn(BaseModel):
    codigo: str
    nombre: str
    descripcion: str | None = None
    tiempo: str | None = None
    precio_default: float | None = None
    precio_default_usd: float | None = None
    moneda_default: str = "PEN"


class TipoTourUpdateIn(BaseModel):
    codigo: str
    nombre: str
    descripcion: str | None = None
    tiempo: str | None = None
    precio_default: float | None = None
    precio_default_usd: float | None = None
    moneda_default: str = "PEN"


class TipoTourOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nombre: str
    descripcion: str | None
    tiempo: str | None
    precio_default: float | None
    precio_default_usd: float | None
    moneda_default: str
    activo: bool
    # D-33 — computed at query time (never persisted): "disponible_para_venta"
    # if >=1 active AgenciaTourPrecio links this tour, else "sin_agencia_vinculada".
    estado: str = "sin_agencia_vinculada"


class AgenciaTourPrecioIn(BaseModel):
    agencia_id: int
    tour_id: int
    costo: float | None = None  # PEN
    costo_usd: float | None = None

    @model_validator(mode="after")
    def _al_menos_una_moneda(self) -> "AgenciaTourPrecioIn":
        if self.costo is None and self.costo_usd is None:
            raise ValueError("Debe indicar costo en PEN o en USD (al menos uno)")
        return self


class AgenciaTourPrecioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agencia_id: int
    tour_id: int
    costo: float | None
    costo_usd: float | None
    activo: bool
    creado_en: datetime


class AgenciaPagoIn(BaseModel):
    agencia_id: int
    fecha: date
    monto: float
    moneda: str
    metodo: MetodoPagoAgencia
    referencia: str | None = None
    nota: str | None = None


class AgenciaPagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agencia_id: int
    fecha: date
    monto: float
    moneda: str
    metodo: MetodoPagoAgencia
    referencia: str | None
    nota: str | None
    creado_por: int
    creado_en: datetime
    asiento_id: int


class AgenciaSaldoOut(BaseModel):
    agencia_id: int
    PEN: float
    USD: float


class VentaIn(BaseModel):
    tour_id: int
    vendedor_id: int
    agencia_id: int
    forma_pago_id: int
    moneda: str  # PEN | USD
    monto: float
    costo: float | None = 0
    fecha: date
    metadata: dict[str, Any] | None = None
    observaciones: str | None = None
    # D-35 — precio_default/costo del tour son por pasajero; monto/costo de
    # arriba ya vienen multiplicados por cantidad_pasajeros (el frontend hace
    # la cuenta, el backend solo persiste).
    cantidad_pasajeros: int = Field(default=1, ge=1)
    nombre_pasajero: str | None = None
    # D-33 — required only when the vendedor overrides costo/monto away from
    # the agencia's list price; Pydantic 422s on any value outside MotivoEdicion.
    motivo_costo: MotivoEdicion | None = None
    motivo_monto: MotivoEdicion | None = None


class TrasladoIn(BaseModel):
    """POST /traslados — D-34.

    No lleva `tour_id`: lo resuelve el backend contra la fila de catálogo
    SRV-TRASLADO. `agencia_id` es el proveedor de transporte.

    Dos fechas distintas y ambas explícitas: `fecha` es cuándo se cobra (la que
    fecha el asiento) y `fecha_servicio` cuándo se hace el traslado. Si no se
    manda la segunda se asume que coinciden, que es el caso habitual.
    """
    vendedor_id: int
    agencia_id: int
    forma_pago_id: int
    moneda: str  # PEN | USD
    monto: float  # precio cobrado al huésped
    costo: float | None = 0  # costo del proveedor de transporte
    fecha: date  # fecha de cobro — fecha contable
    fecha_servicio: date | None = None  # fecha en que se realiza el traslado
    hora: str
    destino: str
    nombre_huesped: str
    numero_habitacion: str
    observaciones: str | None = None
    metadata: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _campos_operativos(self) -> "TrasladoIn":
        for campo in ("destino", "nombre_huesped", "numero_habitacion", "hora"):
            if not (getattr(self, campo) or "").strip():
                raise ValueError(f"{campo} es obligatorio en un traslado")
        # HH:MM — el input type=time del formulario ya lo entrega así; validarlo
        # acá evita que un cliente distinto meta basura en la columna.
        partes = self.hora.split(":")
        if len(partes) != 2 or not all(p.isdigit() for p in partes):
            raise ValueError("hora debe tener formato HH:MM")
        if not (0 <= int(partes[0]) <= 23 and 0 <= int(partes[1]) <= 59):
            raise ValueError("hora fuera de rango")
        return self


class VentaOut(BaseModel):
    asiento_id: int
    tour_servicio_id: int


class VentaRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    vendedor_id: int
    agencia_id: int
    forma_pago_id: int
    moneda: str
    monto: float
    costo: float | None
    fecha: date
    asiento_id: int
    liquidacion_id: int | None
    # Estado de la liquidación que contiene esta venta (None si no está en
    # ninguna). La UI necesita distinguir `abierta` — editable/eliminable — de
    # `cerrada`, que sí bloquea la edición (D-14); `liquidacion_id` a secas no
    # alcanza para decidirlo.
    liquidacion_estado: str | None = None
    liquidacion_codigo: str | None = None
    # D-34 — campos de traslado; None en las filas de tipo tour.
    tipo_servicio: str = "tour"
    fecha_servicio: date | None = None
    destino: str | None = None
    nombre_huesped: str | None = None
    numero_habitacion: str | None = None
    hora: str | None = None
    observaciones: str | None = None
    # D-35 — presentes en filas de tipo tour; 1/None por defecto en traslados.
    cantidad_pasajeros: int = 1
    nombre_pasajero: str | None = None


class AgenciaCandidatoOut(BaseModel):
    """One agencia×tour price candidate — surfaced on TourSearchOut when the
    tour's active prices span 2+ currencies and can't be auto-resolved.

    `costo`/`costo_usd` is what we owe this agencia (AgenciaTourPrecio, D-30) —
    not a sale price."""
    agencia_id: int
    agencia_nombre: str | None
    costo: float | None
    costo_usd: float | None
    moneda: str  # "PEN" | "USD" — which currency this candidate is grouped under


class TourSearchOut(BaseModel):
    """GET /ventas/tour-search row — D-33.

    `costo`/`costo_usd` is the resolved agencia's cost (AgenciaTourPrecio).
    `precio_venta`/`precio_venta_usd` is the tour's own default sale price
    (ToursCatalogo.precio_default) — independent of which agencia is
    providing it. Both are surfaced so the venta form can prefill costo
    proveedor and monto a cobrar from their own distinct sources instead of
    reusing the agencia's cost for both."""
    tour_id: int
    nombre: str
    agencia_id: int | None
    agencia_nombre: str | None
    costo: float | None
    costo_usd: float | None
    precio_venta: float | None = None
    precio_venta_usd: float | None = None
    es_reciente: bool
    # Mixed-currency active prices (2+ groups) — no auto/preselect possible,
    # vendedor must pick manually from candidatos.
    requires_manual_selection: bool = False
    candidatos: list[AgenciaCandidatoOut] | None = None


class DuplicadoCheckOut(BaseModel):
    """GET /ventas/check-duplicado — D-33."""
    duplicado: bool
    venta_id: int | None


class SimularOut(BaseModel):
    vendedor_id: int | None
    tour_id: int | None
    monto: float
    porcentaje: float
    comision: float


class ComisionReglaIn(BaseModel):
    vendedor_id: int | None = None
    tour_id: int | None = None
    porcentaje: float
    descripcion: str | None = None


class ComisionReglaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendedor_id: int | None
    tour_id: int | None
    porcentaje: float
    descripcion: str | None
    activo: bool


class LiquidacionIn(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    vendedor_id: int | None = None
    agencia_id: int | None = None
    # Selección manual (D-35) — el usuario revisa el detalle del depósito y
    # elige qué ventas liquida; el rango de fechas queda como filtro/metadata
    # descriptiva, no como criterio de auto-asignación.
    tour_servicio_ids: list[int] = Field(min_length=1)


class LiquidacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str | None
    fecha_desde: date
    fecha_hasta: date
    estado: str
    vendedor_id: int | None
    agencia_id: int | None
    cerrada_en: Any | None = None


class SolicitudCreateIn(BaseModel):
    titulo: str
    descripcion: str
    tipo: TipoSolicitud
    prioridad: PrioridadSolicitud = PrioridadSolicitud.media
    pagina_origen: str | None = None


class SolicitudUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: EstadoSolicitud
    respuesta: str | None = None


class SolicitudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    titulo: str
    descripcion: str
    tipo: TipoSolicitud
    prioridad: PrioridadSolicitud
    estado: EstadoSolicitud
    pagina_origen: str | None
    creado_por: int
    creado_en: datetime
    respuesta: str | None
    resuelto_por: int | None
    resuelto_en: datetime | None