"""apps/tours/api/app/schemas/core.py — Pydantic request/response shapes for core endpoints."""
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str


class CuentaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nombre: str
    tipo: str
    moneda: str
    activo: bool


class CuentaIn(BaseModel):
    codigo: str
    nombre: str
    tipo: str
    moneda: str  # PEN | USD


class AsientoLineaIn(BaseModel):
    cuenta_id: int
    debe: float = 0
    haber: float = 0


class AsientoIn(BaseModel):
    fecha: date
    concepto: str
    lineas: list[AsientoLineaIn]
    metadata: dict[str, Any] | None = None


class AsientoLineaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cuenta_id: int
    codigo: str | None = None
    debe: float
    haber: float


class AsientoOut(BaseModel):
    asiento_id: int
    concepto: str
    lineas: list[AsientoLineaOut]


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tabla: str
    registro_id: int | None
    operacion: str
    datos_antes: str | None
    datos_despues: str | None
    usuario_id: int | None
    timestamp: datetime


class CatalogoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str | None = None
    nombre: str
    activo: bool = True


class CatalogoIn(BaseModel):
    codigo: str | None = None
    nombre: str