"""apps/tours/api/app/routers/tours.py

POST /ventas (asiento balanceado + tours_servicios en misma tx — D-15),
GET /ventas (filtros + auto-filter vendedor — T-02.1-08),
GET /simular (commission preview),
/comision-reglas CRUD (DELETE default global blocked — D-10),
/liquidaciones skeleton (no close/reopen — Plan 02).
"""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import current_user_id
from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.tours import (
    Agencias,
    ComisionReglas,
    FormasPago,
    Liquidaciones,
    ToursCatalogo,
    ToursServicios,
    Vendedores,
)
from app.schemas.tours import (
    ComisionReglaIn,
    ComisionReglaOut,
    LiquidacionIn,
    LiquidacionOut,
    SimularOut,
    VentaIn,
    VentaOut,
    VentaRow,
)
from app.services.accounting import post_venta_tour
from app.services.commission import resolve_comision, simular_comision
from app.services.liquidaciones import LiquidacionPrecheckError as _LiquidacionPrecheckError, close_liquidacion, reopen_liquidacion

router = APIRouter(tags=["tours"])


# --------------------------------------------------------------------------- #
# /ventas
# --------------------------------------------------------------------------- #
@router.post("/ventas", response_model=VentaOut, status_code=201)
async def create_venta(
    body: VentaIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> VentaOut:
    # Role guard — vendedor solo crea ventas para sí mismo (T-02.1-08).
    if user["role"] == "vendedor" and body.vendedor_id != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes registrar ventas para otro vendedor")

    # Validate foreign keys exist + active.
    tour = (await session.execute(select(ToursCatalogo).where(ToursCatalogo.id == body.tour_id))).scalar_one_or_none()
    if tour is None or not tour.activo:
        raise HTTPException(status_code=422, detail="Tour no existe o está inactivo")
    agencia = (await session.execute(select(Agencias).where(Agencias.id == body.agencia_id))).scalar_one_or_none()
    if agencia is None or not agencia.activo:
        raise HTTPException(status_code=422, detail="Agencia no existe o está inactiva")
    forma = (await session.execute(select(FormasPago).where(FormasPago.id == body.forma_pago_id))).scalar_one_or_none()
    if forma is None or not forma.activo:
        raise HTTPException(status_code=422, detail="Forma de pago no existe o está inactiva")
    if body.moneda not in ("PEN", "USD"):
        raise HTTPException(status_code=422, detail="Moneda debe ser PEN o USD")
    if body.monto <= 0:
        raise HTTPException(status_code=422, detail="Monto debe ser positivo")

    try:
        asiento, tour_servicio = await post_venta_tour(
            session,
            tour_id=body.tour_id,
            vendedor_id=body.vendedor_id,
            agencia_id=body.agencia_id,
            forma_pago_id=body.forma_pago_id,
            moneda=body.moneda,
            monto=body.monto,
            costo=body.costo,
            fecha=body.fecha,
            metadata=body.metadata,
            creacion_usuario_id=user["id"],
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return VentaOut(asiento_id=asiento.id, tour_servicio_id=tour_servicio.id)


@router.get("/ventas", response_model=list[VentaRow])
async def list_ventas(
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    agencia_id: int | None = Query(None),
    vendedor_id: int | None = Query(None),
    tour_id: int | None = Query(None),
    moneda: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[ToursServicios]:
    stmt = select(ToursServicios).order_by(ToursServicios.fecha.desc())
    # Vendedor solo ve propias (T-02.1-08).
    if user["role"] == "vendedor":
        stmt = stmt.where(ToursServicios.vendedor_id == user["id"])
    if fecha_desde is not None:
        stmt = stmt.where(ToursServicios.fecha >= fecha_desde)
    if fecha_hasta is not None:
        stmt = stmt.where(ToursServicios.fecha <= fecha_hasta)
    if agencia_id is not None:
        stmt = stmt.where(ToursServicios.agencia_id == agencia_id)
    if vendedor_id is not None:
        stmt = stmt.where(ToursServicios.vendedor_id == vendedor_id)
    if tour_id is not None:
        stmt = stmt.where(ToursServicios.tour_id == tour_id)
    if moneda is not None:
        stmt = stmt.where(ToursServicios.moneda == moneda)
    return list((await session.execute(stmt)).scalars().all())


# --------------------------------------------------------------------------- #
# /simular
# --------------------------------------------------------------------------- #
@router.get("/simular", response_model=SimularOut)
async def simular(
    vendedor_id: int | None = Query(None),
    tour_id: int | None = Query(None),
    monto: float = Query(...),
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> dict:
    return await simular_comision(session, vendedor_id, tour_id, monto)


# --------------------------------------------------------------------------- #
# /comision-reglas
# --------------------------------------------------------------------------- #
@router.get("/comision-reglas", response_model=list[ComisionReglaOut])
async def list_comision_reglas(
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[ComisionReglas]:
    return list((await session.execute(select(ComisionReglas).order_by(ComisionReglas.id))).scalars().all())


@router.post("/comision-reglas", response_model=ComisionReglaOut, status_code=201)
async def create_comision_regla(
    body: ComisionReglaIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> ComisionReglas:
    regla = ComisionReglas(
        vendedor_id=body.vendedor_id,
        tour_id=body.tour_id,
        porcentaje=body.porcentaje,
        descripcion=body.descripcion,
    )
    session.add(regla)
    await session.commit()
    await session.refresh(regla)
    return regla


@router.put("/comision-reglas/{regla_id}", response_model=ComisionReglaOut)
async def update_comision_regla(
    regla_id: int,
    body: ComisionReglaIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> ComisionReglas:
    regla = (await session.execute(select(ComisionReglas).where(ComisionReglas.id == regla_id))).scalar_one_or_none()
    if regla is None:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    regla.vendedor_id = body.vendedor_id
    regla.tour_id = body.tour_id
    regla.porcentaje = body.porcentaje
    regla.descripcion = body.descripcion
    await session.commit()
    await session.refresh(regla)
    return regla


@router.delete("/comision-reglas/{regla_id}")
async def delete_comision_regla(
    regla_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> dict:
    regla = (await session.execute(select(ComisionReglas).where(ComisionReglas.id == regla_id))).scalar_one_or_none()
    if regla is None:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    # D-10 — default global is non-deletable.
    if regla.vendedor_id is None and regla.tour_id is None:
        raise HTTPException(status_code=400, detail="No se puede eliminar la regla global por defecto")
    await session.delete(regla)
    await session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
# /liquidaciones — skeleton (no close/reopen — Plan 02)
# --------------------------------------------------------------------------- #
@router.post("/liquidaciones", response_model=LiquidacionOut, status_code=201)
async def create_liquidacion(
    body: LiquidacionIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> Liquidaciones:
    liq = Liquidaciones(
        fecha_desde=body.fecha_desde,
        fecha_hasta=body.fecha_hasta,
        vendedor_id=body.vendedor_id,
        agencia_id=body.agencia_id,
    )
    session.add(liq)
    await session.commit()
    await session.refresh(liq)
    return liq


@router.get("/liquidaciones", response_model=list[LiquidacionOut])
async def list_liquidaciones(
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[Liquidaciones]:
    stmt = select(Liquidaciones).order_by(Liquidaciones.id.desc())
    # Vendedor solo ve propias.
    if user["role"] == "vendedor":
        stmt = stmt.where(Liquidaciones.vendedor_id == user["id"])
    return list((await session.execute(stmt)).scalars().all())


@router.get("/liquidaciones/{liquidacion_id}", response_model=LiquidacionOut)
async def get_liquidacion(
    liquidacion_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> Liquidaciones:
    liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == liquidacion_id))).scalar_one_or_none()
    if liq is None:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    if user["role"] == "vendedor" and liq.vendedor_id != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta liquidación")
    return liq


# --------------------------------------------------------------------------- #
# /liquidaciones/{id}/close | /reopen | /precheck — Plan 02 (RED stub)
# --------------------------------------------------------------------------- #
@router.post("/liquidaciones/{liquidacion_id}/close", response_model=LiquidacionOut)
async def close_liquidacion_endpoint(
    liquidacion_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin", "contabilidad")),
) -> Liquidaciones:
    try:
        liq = await close_liquidacion(session, liquidacion_id, current_user=user)
        await session.commit()
        await session.refresh(liq)
        return liq
    except _LiquidacionPrecheckError as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail="No se puede cerrar la liquidación: faltan datos", headers={"X-Errors": str(exc.fails)})
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/liquidaciones/{liquidacion_id}/reopen", response_model=LiquidacionOut)
async def reopen_liquidacion_endpoint(
    liquidacion_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin", "contabilidad")),
) -> Liquidaciones:
    try:
        liq = await reopen_liquidacion(session, liquidacion_id, current_user=user)
        await session.commit()
        await session.refresh(liq)
        return liq
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


# --------------------------------------------------------------------------- #
# PUT / DELETE /tours_servicios/{id} — D-14 lock on cerrada (Plan 02)
# --------------------------------------------------------------------------- #
@router.put("/tours_servicios/{tour_servicio_id}")
async def update_tour_servicio(
    tour_servicio_id: int,
    body: dict,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> dict:
    ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Tour servicio no encontrado")
    if user["role"] == "vendedor" and ts.vendedor_id != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este tour")
    # D-14 — if liquidación cerrada, refuse.
    if ts.liquidacion_id is not None:
        liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == ts.liquidacion_id))).scalar_one_or_none()
        if liq is not None and liq.estado.value == "cerrada":
            raise HTTPException(status_code=409, detail="Tour en liquidación cerrada, reabre primero")
    raise HTTPException(status_code=501, detail="PUT /tours_servicios still unimplemented (RED-phase stub)")


@router.delete("/tours_servicios/{tour_servicio_id}")
async def delete_tour_servicio(
    tour_servicio_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> dict:
    ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Tour servicio no encontrado")
    if user["role"] == "vendedor" and ts.vendedor_id != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este tour")
    if ts.liquidacion_id is not None:
        liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == ts.liquidacion_id))).scalar_one_or_none()
        if liq is not None and liq.estado.value == "cerrada":
            raise HTTPException(status_code=409, detail="Tour en liquidación cerrada, reabre primero")
    raise HTTPException(status_code=501, detail="DELETE /tours_servicios still unimplemented (RED-phase stub)")


# --------------------------------------------------------------------------- #
# /dashboard/saldos | /dashboard/tours_pendientes — Plan 02 (RED stub)
# --------------------------------------------------------------------------- #
@router.get("/dashboard/saldos")
async def dashboard_saldos(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agencia_id: int | None = Query(None),
    vendedor_id: int | None = Query(None),
    moneda: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    # RBAC role-forcing — vendedor can only see own (T-02.1-14).
    if user["role"] == "vendedor":
        vendedor_id = int(user["id"])
    raise HTTPException(status_code=501, detail="dashboard/saldos not implemented (RED-phase stub)")


@router.get("/dashboard/tours_pendientes")
async def dashboard_tours_pendientes(
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    vendedor_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    if user["role"] == "vendedor":
        vendedor_id = int(user["id"])
    raise HTTPException(status_code=501, detail="dashboard/tours_pendientes not implemented (RED-phase stub)")