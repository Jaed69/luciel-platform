"""apps/tours/api/app/routers/core.py

Catálogos CRUD + /audit-log + POST /asientos (D-06 admin TC interno tool).
Soft-delete (activo=0) on catalog rows. /audit-log and POST /asientos require
admin role (D-24, D-06).
"""
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.core import (
    AsientoLineas,
    Asientos,
    AuditLog,
    Cuentas,
)
from app.models.tours import Agencias, FormasPago, Monedas, ToursCatalogo, Vendedores
from app.schemas.core import (
    AsientoIn,
    AsientoLineaOut,
    AsientoOut,
    AuditLogOut,
    CatalogoIn,
    CatalogoOut,
    CuentaIn,
    CuentaOut,
)
from app.services.accounting import post_asiento

router = APIRouter(tags=["core"])


# --------------------------------------------------------------------------- #
# Cuentas
# --------------------------------------------------------------------------- #
@router.get("/cuentas", response_model=list[CuentaOut])
async def list_cuentas(
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[Cuentas]:
    rows = (await session.execute(select(Cuentas).order_by(Cuentas.codigo))).scalars().all()
    return list(rows)


@router.post("/cuentas", response_model=CuentaOut, status_code=201)
async def create_cuenta(
    body: CuentaIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> Cuentas:
    cuenta = Cuentas(codigo=body.codigo, nombre=body.nombre, tipo=body.tipo, moneda=body.moneda)
    session.add(cuenta)
    await session.commit()
    await session.refresh(cuenta)
    return cuenta


@router.put("/cuentas/{cuenta_id}", response_model=CuentaOut)
async def update_cuenta(
    cuenta_id: int,
    body: CuentaIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> Cuentas:
    cuenta = (await session.execute(select(Cuentas).where(Cuentas.id == cuenta_id))).scalar_one_or_none()
    if cuenta is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta.codigo = body.codigo
    cuenta.nombre = body.nombre
    cuenta.tipo = body.tipo
    cuenta.moneda = body.moneda
    await session.commit()
    await session.refresh(cuenta)
    return cuenta


@router.delete("/cuentas/{cuenta_id}")
async def delete_cuenta(
    cuenta_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> dict:
    cuenta = (await session.execute(select(Cuentas).where(Cuentas.id == cuenta_id))).scalar_one_or_none()
    if cuenta is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta.activo = False  # soft delete
    await session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Catalog CRUD helpers — agencias, vendedores, tours, formas-pago, monedas
# --------------------------------------------------------------------------- #
_CATALOG_MODELS = {
    "agencias": Agencias,
    "vendedores": Vendedores,
    "tours": ToursCatalogo,
    "formas-pago": FormasPago,
    "monedas": Monedas,
}


@router.get("/catalogos/{entidad}", response_model=list[CatalogoOut])
async def list_catalog(
    entidad: str,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[Any]:
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    rows = (await session.execute(select(model).order_by(model.id))).scalars().all()
    return list(rows)


@router.post("/catalogos/{entidad}", response_model=CatalogoOut, status_code=201)
async def create_catalog(
    entidad: str,
    body: CatalogoIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> Any:
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    row = model(codigo=body.codigo, nombre=body.nombre)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/catalogos/{entidad}/{row_id}")
async def delete_catalog(
    entidad: str,
    row_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> dict:
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    row = (await session.execute(select(model).where(model.id == row_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    row.activo = False  # soft delete
    await session.commit()
    return {"ok": True}


# Short aliases used by the UI (UI-SPEC S5): /agencias, /vendedores, /tours, /formas-pago, /monedas
@router.get("/agencias", response_model=list[CatalogoOut])
async def list_agencias(session: AsyncSession = Depends(get_session), _user: dict = Depends(get_current_user)) -> list[Agencias]:
    return list((await session.execute(select(Agencias).order_by(Agencias.id))).scalars().all())


@router.get("/vendedores", response_model=list[CatalogoOut])
async def list_vendedores(session: AsyncSession = Depends(get_session), _user: dict = Depends(get_current_user)) -> list[Vendedores]:
    return list((await session.execute(select(Vendedores).order_by(Vendedores.id))).scalars().all())


@router.get("/tours", response_model=list[CatalogoOut])
async def list_tours(session: AsyncSession = Depends(get_session), _user: dict = Depends(get_current_user)) -> list[ToursCatalogo]:
    return list((await session.execute(select(ToursCatalogo).order_by(ToursCatalogo.id))).scalars().all())


@router.get("/formas-pago", response_model=list[CatalogoOut])
async def list_formas_pago(session: AsyncSession = Depends(get_session), _user: dict = Depends(get_current_user)) -> list[FormasPago]:
    return list((await session.execute(select(FormasPago).order_by(FormasPago.id))).scalars().all())


@router.get("/monedas", response_model=list[CatalogoOut])
async def list_monedas(session: AsyncSession = Depends(get_session), _user: dict = Depends(get_current_user)) -> list[Monedas]:
    return list((await session.execute(select(Monedas).order_by(Monedas.id))).scalars().all())


# --------------------------------------------------------------------------- #
# /audit-log — admin only (D-24)
# --------------------------------------------------------------------------- #
@router.get("/audit-log", response_model=list[AuditLogOut])
async def list_audit_log(
    usuario_id: int | None = Query(None),
    tabla: str | None = Query(None),
    operacion: str | None = Query(None),
    _user: dict = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(50)
    if usuario_id is not None:
        stmt = stmt.where(AuditLog.usuario_id == usuario_id)
    if tabla is not None:
        stmt = stmt.where(AuditLog.tabla == tabla)
    if operacion is not None:
        stmt = stmt.where(AuditLog.operacion == operacion)
    return list((await session.execute(stmt)).scalars().all())


# --------------------------------------------------------------------------- #
# POST /asientos — admin only, D-06 (TC interno tool reusing post_asiento)
# --------------------------------------------------------------------------- #
@router.post("/asientos", response_model=AsientoOut, status_code=201)
async def create_asiento(
    body: AsientoIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin")),
) -> AsientoOut:
    """Admin-only manual asiento. metadata carries TC-interno fields when applicable:
    {tipo: "tc_interno", tc_elegido: <float>, justificacion: <str>}."""
    try:
        asiento = await post_asiento(
            session,
            fecha=body.fecha,
            concepto=body.concepto,
            lineas=[ln.model_dump() for ln in body.lineas],
            metadata=body.metadata,
            creacion_usuario_id=user["id"],
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    # Build response with cuenta codigo for display
    lineas_out: list[AsientoLineaOut] = []
    for ln in body.lineas:
        cuenta = (await session.execute(select(Cuentas).where(Cuentas.id == ln.cuenta_id))).scalar_one()
        lineas_out.append(AsientoLineaOut(cuenta_id=ln.cuenta_id, codigo=cuenta.codigo, debe=ln.debe, haber=ln.haber))
    return AsientoOut(asiento_id=asiento.id, concepto=asiento.concepto, lineas=lineas_out)