"""apps/tours/api/app/schemas/tours.py — request/response shapes for tours endpoints."""
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.tours import EstadoSolicitud, PrioridadSolicitud, TipoSolicitud


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