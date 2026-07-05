"""apps/tours/api/app/routers/core.py

Catálogos CRUD + /audit-log + POST /asientos (D-06 admin TC interno tool).
Soft-delete (activo=0) on catalog rows. /audit-log and POST /asientos require
admin role (D-24, D-06).
"""
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
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

# D-19 — referential integrity map for DELETE /catalogos/{entidad}/{row_id}.
# Each entry: list of (tabla, columna, bind_name, uses_activo).
#   bind_name="id"  → bind :id = row_id (FK is integer pointing at catalog PK).
#   bind_name="val" → bind :val = row.codigo (FK column stores codigo string,
#                     e.g. tours_servicios.moneda == "PEN" matches Monedas.codigo).
#   uses_activo=True → predicate also filters `<tabla>.activo = 1` (active refs only).
# Derived from models/tours.py + models/core.py FK definitions.
_REFERENCED_BY: dict[str, list[tuple[str, str, str, bool]]] = {
    "agencias": [
        ("tours_servicios", "agencia_id", "id", False),
        ("liquidaciones", "agencia_id", "id", False),
    ],
    "vendedores": [
        ("tours_servicios", "vendedor_id", "id", False),
        ("comision_reglas", "vendedor_id", "id", True),
        ("liquidaciones", "vendedor_id", "id", False),
    ],
    "tours": [
        ("tours_servicios", "tour_id", "id", False),
        ("comision_reglas", "tour_id", "id", True),
    ],
    "formas-pago": [
        ("tours_servicios", "forma_pago_id", "id", False),
    ],
    "monedas": [
        ("tours_servicios", "moneda", "val", False),
        ("cuentas", "moneda", "val", True),
    ],
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
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> Any:
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    row = model(codigo=body.codigo, nombre=body.nombre)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.put("/catalogos/{entidad}/{row_id}", response_model=CatalogoOut)
async def update_catalog(
    entidad: str,
    row_id: int,
    body: CatalogoIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> Any:
    """PUT updates codigo/nombre only — activo is preserved (D-03)."""
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    row = (await session.execute(select(model).where(model.id == row_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    row.codigo = body.codigo
    row.nombre = body.nombre
    # Do NOT touch row.activo — D-03.
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/catalogos/{entidad}/{row_id}")
async def delete_catalog(
    entidad: str,
    row_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> dict:
    """Soft-delete (activo=false) if no FK references; 409 with detail.referencias otherwise."""
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    row = (await session.execute(select(model).where(model.id == row_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    # Referential integrity check (D-19) — before any mutation. For monedas
    # (no activo column), the 409 path MUST short-circuit before row.activo=False.
    refs: list[dict] = []
    for tabla, columna, bind_name, uses_activo in _REFERENCED_BY.get(entidad, []):
        bind_value = row.codigo if bind_name == "val" else row_id
        predicate = f"{tabla}.{columna} = :{bind_name}"
        if uses_activo:
            predicate += f" AND {tabla}.activo = 1"
        count = (await session.execute(
            select(func.count()).select_from(text(tabla)).where(text(predicate).bindparams(**{bind_name: bind_value}))
        )).scalar_one()
        if count and int(count) > 0:
            refs.append({"tabla": tabla, "count": int(count)})

    if refs:
        total = sum(r["count"] for r in refs)
        raise HTTPException(
            status_code=409,
            detail={
                "mensaje": f"No se puede desactivar — {total} registros lo referencian",
                "referencias": refs,
            },
        )

    row.activo = False  # soft delete
    await session.commit()
    return {"ok": True}


@router.post("/catalogos/{entidad}/{row_id}/restore")
async def restore_catalog(
    entidad: str,
    row_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> dict:
    """D-03 corollary — reactivate a soft-deleted row (activo=true).
    Monedas has no activo column → 422 (cannot restore a row that's not soft-deletable)."""
    model = _CATALOG_MODELS.get(entidad)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Catálogo '{entidad}' no existe")
    if not hasattr(model, "activo"):
        raise HTTPException(status_code=422, detail=f"'{entidad}' no se puede restaurar (no tiene campo activo)")
    row = (await session.execute(select(model).where(model.id == row_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    row.activo = True
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