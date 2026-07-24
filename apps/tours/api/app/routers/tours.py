"""apps/tours/api/app/routers/tours.py

POST /ventas (asiento balanceado + tours_servicios en misma tx — D-15),
GET /ventas (filtros + auto-filter vendedor — T-02.1-08),
GET /simular (commission preview),
/comision-reglas CRUD (DELETE default global blocked — D-10),
/liquidaciones skeleton (no close/reopen — Plan 02).
"""
import json
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import current_user_id
from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.core import AsientoLineas, Asientos
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
    DuplicadoCheckOut,
    LiquidacionIn,
    LiquidacionOut,
    SimularOut,
    TourSearchOut,
    VentaIn,
    VentaOut,
    VentaRow,
)
from app.services.accounting import post_venta_tour
from app.services.commission import resolve_comision, simular_comision
from app.services.liquidaciones import LiquidacionPrecheckError as _LiquidacionPrecheckError, close_liquidacion, reopen_liquidacion
from app.services.venta_resolver import tour_search as _resolve_tour_search

router = APIRouter(tags=["tours"])

# D-33 — DELETE /ventas/{id} undo window: only allowed within this many
# seconds of creation, and only when the venta never made it into a
# liquidación (see delete_venta below).
_UNDO_WINDOW_SECONDS = 10


# --------------------------------------------------------------------------- #
# /ventas
# --------------------------------------------------------------------------- #
@router.post("/ventas", response_model=VentaOut, status_code=201)
async def create_venta(
    body: VentaIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> VentaOut:
    # Role guard — vendedor solo crea ventas para sí mismo (T-02.1-08, D-32 —
    # compares against the JWT's vendedor_id claim, not usuarios.id).
    if user["role"] == "vendedor" and body.vendedor_id != user["vendedor_id"]:
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
        # D-33 — motivo_costo/motivo_monto (edit-exception reasons) merge into
        # the same metadata dict as notas, on tours_servicios.metadata_ (Text,
        # JSON-serialized) rather than overwriting it.
        ts_metadata: dict[str, Any] = dict(body.metadata or {})
        if body.motivo_costo is not None:
            ts_metadata["motivo_costo"] = body.motivo_costo
        if body.motivo_monto is not None:
            ts_metadata["motivo_monto"] = body.motivo_monto
        tour_servicio.metadata_ = json.dumps(ts_metadata) if ts_metadata else None
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
    # Vendedor solo ve propias (T-02.1-08, D-32).
    if user["role"] == "vendedor":
        stmt = stmt.where(ToursServicios.vendedor_id == user["vendedor_id"])
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
# GET /ventas/tour-search — D-33 venta modal quick-pick (tour → default agencia/precio)
# --------------------------------------------------------------------------- #
@router.get("/ventas/tour-search", response_model=list[TourSearchOut])
async def ventas_tour_search(
    q: str = Query(""),
    vendedor_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    # A vendedor can only see their own "recientes" ranking — never another
    # vendedor's sales-volume-derived personalization (matches list_ventas'
    # and check-duplicado's ownership scoping).
    if user["role"] == "vendedor":
        vendedor_id = user["vendedor_id"]
    return await _resolve_tour_search(session, q or None, vendedor_id)


# --------------------------------------------------------------------------- #
# GET /ventas/check-duplicado — D-33 warn before double-registering a venta
# --------------------------------------------------------------------------- #
@router.get("/ventas/check-duplicado", response_model=DuplicadoCheckOut)
async def ventas_check_duplicado(
    tour_id: int = Query(...),
    agencia_id: int = Query(...),
    monto: float = Query(...),
    fecha: date = Query(...),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> dict:
    """True if an existing tours_servicios row matches all 4 values exactly.
    Vendedor role scopes the check to their own ventas (matches list_ventas);
    any other role checks across all vendedores."""
    stmt = select(ToursServicios).where(
        ToursServicios.tour_id == tour_id,
        ToursServicios.agencia_id == agencia_id,
        ToursServicios.monto == monto,
        ToursServicios.fecha == fecha,
    )
    if user["role"] == "vendedor":
        stmt = stmt.where(ToursServicios.vendedor_id == user["vendedor_id"])
    row = (await session.execute(stmt)).scalars().first()
    return {"duplicado": row is not None, "venta_id": row.id if row is not None else None}


# --------------------------------------------------------------------------- #
# DELETE /ventas/{id} — D-33 undo within a short window (hard delete, not a reversal)
# --------------------------------------------------------------------------- #
@router.delete("/ventas/{tour_servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venta(
    tour_servicio_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> None:
    """Hard-deletes a venta registered <=10s ago, before it ever consolidated
    into the books (not a reversal/reversion asiento — see D-33 spec)."""
    ts = (await session.execute(
        select(ToursServicios).where(ToursServicios.id == tour_servicio_id)
    )).scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if user["role"] == "vendedor" and ts.vendedor_id != user["vendedor_id"]:
        raise HTTPException(status_code=403, detail="No puedes deshacer una venta de otro vendedor")
    if ts.liquidacion_id is not None:
        raise HTTPException(status_code=409, detail="Venta ya liquidada, no se puede deshacer")

    creado_en = ts.creado_en if ts.creado_en.tzinfo is not None else ts.creado_en.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - creado_en).total_seconds()
    if elapsed > _UNDO_WINDOW_SECONDS:
        raise HTTPException(status_code=409, detail="Han pasado más de 10 segundos, ya no se puede deshacer")

    # ORM session.delete() (not raw Core .delete()) for every row here — the
    # audit_before_flush hook only inspects session.deleted, so a Core-level
    # DELETE would silently skip the audit_log entry for these rows.
    asiento_id = ts.asiento_id
    lineas = (await session.execute(
        select(AsientoLineas).where(AsientoLineas.asiento_id == asiento_id)
    )).scalars().all()
    for linea in lineas:
        await session.delete(linea)
    await session.delete(ts)
    await session.flush()  # tours_servicios + lineas gone before we drop their asiento (FK ondelete=RESTRICT)
    asiento = (await session.execute(
        select(Asientos).where(Asientos.id == asiento_id)
    )).scalar_one_or_none()
    if asiento is not None:
        await session.delete(asiento)
    await session.commit()


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
    """Create an `abierta` liquidación and auto-assign all tours_servicios in range with liquidacion_id IS NULL."""
    if body.fecha_hasta < body.fecha_desde:
        raise HTTPException(status_code=422, detail="fecha_hasta debe ser posterior a fecha_desde")
    liq = Liquidaciones(
        fecha_desde=body.fecha_desde,
        fecha_hasta=body.fecha_hasta,
        vendedor_id=body.vendedor_id,
        agencia_id=body.agencia_id,
    )
    session.add(liq)
    await session.flush()  # populate liq.id

    # Auto-assign tours_servicios with liquidacion_id IS NULL within range (Plan 02).
    stmt = select(ToursServicios).where(
        ToursServicios.fecha >= body.fecha_desde,
        ToursServicios.fecha <= body.fecha_hasta,
        ToursServicios.liquidacion_id.is_(None),
    )
    if body.vendedor_id is not None:
        stmt = stmt.where(ToursServicios.vendedor_id == body.vendedor_id)
    if body.agencia_id is not None:
        stmt = stmt.where(ToursServicios.agencia_id == body.agencia_id)

    tours = list((await session.execute(stmt)).scalars().all())
    for ts in tours:
        ts.liquidacion_id = liq.id

    await session.commit()
    await session.refresh(liq)
    return liq


@router.get("/liquidaciones", response_model=list[LiquidacionOut])
async def list_liquidaciones(
    estado: str | None = Query(None),
    vendedor_id: int | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[Liquidaciones]:
    stmt = select(Liquidaciones).order_by(Liquidaciones.id.desc())
    # Vendedor solo ve propias (D-32).
    if user["role"] == "vendedor":
        stmt = stmt.where(Liquidaciones.vendedor_id == user["vendedor_id"])
    if estado is not None:
        stmt = stmt.where(Liquidaciones.estado == estado)
    if vendedor_id is not None and user["role"] != "vendedor":
        stmt = stmt.where(Liquidaciones.vendedor_id == vendedor_id)
    if fecha_desde is not None:
        stmt = stmt.where(Liquidaciones.fecha_desde >= fecha_desde)
    if fecha_hasta is not None:
        stmt = stmt.where(Liquidaciones.fecha_hasta <= fecha_hasta)
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
    if user["role"] == "vendedor" and liq.vendedor_id != user["vendedor_id"]:
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
        raise HTTPException(
            status_code=422,
            detail={"message": "No se puede cerrar la liquidación: faltan datos", "errors": exc.fails},
        )
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
@router.get("/liquidaciones/{liquidacion_id}/precheck")
async def liquidacion_precheck(
    liquidacion_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin", "contabilidad", "vendedor")),
) -> dict:
    from app.services.liquidaciones import get_precheck as _precheck
    try:
        return await _precheck(session, liquidacion_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


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
    if user["role"] == "vendedor" and ts.vendedor_id != user["vendedor_id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este tour")
    # D-14 — if liquidación cerrada, refuse.
    if ts.liquidacion_id is not None:
        liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == ts.liquidacion_id))).scalar_one_or_none()
        if liq is not None and liq.estado.value == "cerrada":
            raise HTTPException(status_code=409, detail="Tour en liquidación cerrada, reabre primero")
    # Apply partial updates — only monto/costo/agencia/forma_pago allowed (Plan 02 simplification).
    if "monto" in body:
        ts.monto = body["monto"]
    if "costo" in body:
        ts.costo = body["costo"]
    if "agencia_id" in body:
        ts.agencia_id = body["agencia_id"]
    if "forma_pago_id" in body:
        ts.forma_pago_id = body["forma_pago_id"]
    await session.commit()
    return {"ok": True, "tour_servicio_id": ts.id}


@router.delete("/tours_servicios/{tour_servicio_id}")
async def delete_tour_servicio(
    tour_servicio_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> dict:
    ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Tour servicio no encontrado")
    if user["role"] == "vendedor" and ts.vendedor_id != user["vendedor_id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este tour")
    # Must not already be inside a cerrada liquidación.
    if ts.liquidacion_id is not None:
        liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == ts.liquidacion_id))).scalar_one_or_none()
        if liq is not None and liq.estado.value == "cerrada":
            raise HTTPException(status_code=409, detail="Tour en liquidación cerrada, reabre primero")
    # Soft-delete via activo=0 on tours_servicios is not applicable (no `activo` column here).
    # Hard delete — Plan 02 simplification: only allowed when liquidacion_id IS NULL or `abierta`.
    # NOTE: asiento_id FK ondelete=RESTRICT prevents real cascade — we leave the asiento intact (it remains for audit),
    # simply remove the tours_servicios row. Future plan would emit a reversal asiento.
    await session.delete(ts)
    await session.commit()
    return {"ok": True, "tour_servicio_id": tour_servicio_id}


# --------------------------------------------------------------------------- #
# /dashboard/saldos | /dashboard/tours_pendientes — Plan 02 (T-02.1-14 role-forcing)
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
    """Saldos por cuenta filtrados por fecha/agencia/vendedor/moneda.

    RBAC role-forcing (T-02.1-14): non-admins (vendedor) are forced to `vendedor_id = user.id`
    so they cannot read another vendedor's data via direct curl `?vendedor_id=99`.
    Contabilidad is treated same as admin for READ-only on dashboard — SC#2 only restricts audit_log.
    """
    if user["role"] == "vendedor":
        vendedor_id = int(user["id"])

    from app.models.core import AsientoLineas, Asientos, Cuentas

    stmt = (
        select(
            Cuentas.id,
            Cuentas.codigo,
            Cuentas.nombre,
            Cuentas.moneda,
            func.sum(AsientoLineas.debe).label("total_debe"),
            func.sum(AsientoLineas.haber).label("total_haber"),
        )
        .join(AsientoLineas, AsientoLineas.cuenta_id == Cuentas.id)
        .join(Asientos, Asientos.id == AsientoLineas.asiento_id)
        .outerjoin(ToursServicios, ToursServicios.asiento_id == Asientos.id)
        .where(Asientos.fecha >= fecha_desde, Asientos.fecha <= fecha_hasta)
        .group_by(Cuentas.id, Cuentas.codigo, Cuentas.nombre, Cuentas.moneda)
    )
    if agencia_id is not None:
        stmt = stmt.where(ToursServicios.agencia_id == agencia_id)
    if vendedor_id is not None:
        stmt = stmt.where(ToursServicios.vendedor_id == vendedor_id)
    if moneda is not None:
        stmt = stmt.where(Cuentas.moneda == moneda)
    rows = (await session.execute(stmt)).all()
    out: list[dict] = []
    for r in rows:
        debe = float(r.total_debe or 0)
        haber = float(r.total_haber or 0)
        moneda_val = r.moneda.value if hasattr(r.moneda, "value") else str(r.moneda)
        out.append({
            "id": r.id,
            "codigo": r.codigo,
            "nombre": r.nombre,
            "moneda": moneda_val,
            "total_debe": debe,
            "total_haber": haber,
            "saldo": debe - haber,
        })
    return out


@router.get("/dashboard/tours_pendientes")
async def dashboard_tours_pendientes(
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    vendedor_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    """Tours_servicios with liquidacion_id IS NULL ordered by fecha asc.
    Field `dias_desde_venta` = (today - fecha).days (D-20).

    RBAC role-forcing (T-02.1-14): non-admin vendedor forced to `vendedor_id = user.id`.
    """
    if user["role"] == "vendedor":
        vendedor_id = int(user["id"])

    stmt = (
        select(ToursServicios)
        .where(ToursServicios.liquidacion_id.is_(None))
        .order_by(ToursServicios.fecha.asc())
    )
    if fecha_desde is not None:
        stmt = stmt.where(ToursServicios.fecha >= fecha_desde)
    if fecha_hasta is not None:
        stmt = stmt.where(ToursServicios.fecha <= fecha_hasta)
    if vendedor_id is not None:
        stmt = stmt.where(ToursServicios.vendedor_id == vendedor_id)
    rows = list((await session.execute(stmt)).scalars().all())
    today = date.today()
    out: list[dict] = []
    for ts in rows:
        delta = (today - ts.fecha).days
        out.append({
            "id": ts.id,
            "tour_id": ts.tour_id,
            "vendedor_id": ts.vendedor_id,
            "agencia_id": ts.agencia_id,
            "moneda": str(ts.moneda.value if hasattr(ts.moneda, "value") else ts.moneda),
            "monto": float(ts.monto),
            "costo": float(ts.costo) if ts.costo is not None else None,
            "fecha": ts.fecha.isoformat(),
            "dias_desde_venta": delta,
        })
    return out