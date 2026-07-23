"""apps/tours/api/app/schemas/core.py — Pydantic request/response shapes for core endpoints."""
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.core import Rol


class LoginRequest(BaseModel):
    identifier: str  # email or username
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


# --------------------------------------------------------------------------- #
# Usuarios (Phase 02.1.1-01)
# --------------------------------------------------------------------------- #
class UsuarioCreateIn(BaseModel):
    email: str
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)
    rol: Rol


class UsuarioUpdateIn(BaseModel):
    """Extra='forbid' so a `password` field returns 422 (D-06 — password never edited here)."""
    model_config = ConfigDict(extra="forbid")
    email: str | None = None
    username: str | None = None
    rol: Rol | None = None
    activo: bool | None = None


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class AdminPasswordResetIn(BaseModel):
    new_password: str = Field(min_length=8)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    username: str
    rol: Rol
    activo: bool
    creado_en: datetime
    ultimo_acceso: datetime | None