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
    TipoAgencia,
    TipoServicio,
    ToursCatalogo,
    ToursServicios,
    Vendedores,
)
from app.seed import CODIGO_CATALOGO_TRASLADO
from app.schemas.tours import (
    ComisionReglaIn,
    ComisionReglaOut,
    DuplicadoCheckOut,
    LiquidacionIn,
    LiquidacionOut,
    SimularOut,
    TourSearchOut,
    TrasladoIn,
    VentaIn,
    VentaOut,
    VentaRow,
)
from app.services.accounting import (
    post_reversion_asiento,
    post_venta_tour,
    post_venta_traslado,
    resync_venta_asiento,
)
from app.services.commission import resolve_comision, simular_comision
from app.services.liquidaciones import (
    LiquidacionPrecheckError as _LiquidacionPrecheckError,
    cancel_liquidacion,
    close_liquidacion,
    reopen_liquidacion,
)
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
    # D-34 — las dos listas de proveedores no se mezclan: quien hace traslados
    # no opera tours.
    if agencia.tipo != TipoAgencia.proveedor_tour:
        raise HTTPException(status_code=422, detail=f"'{agencia.nombre}' no es una agencia de tours")
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
            observaciones=(body.observaciones or "").strip() or None,
            cantidad_pasajeros=body.cantidad_pasajeros,
            nombre_pasajero=(body.nombre_pasajero or "").strip() or None,
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
    tipo_servicio: str | None = Query(None),
    solo_no_liquidadas: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[VentaRow]:
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
    if tipo_servicio is not None:
        stmt = stmt.where(ToursServicios.tipo_servicio == tipo_servicio)
    # D-35 — picker de "Nueva liquidación": solo candidatas sin asignar.
    if solo_no_liquidadas:
        stmt = stmt.where(ToursServicios.liquidacion_id.is_(None))
    rows = list((await session.execute(stmt)).scalars().all())

    # Resolve the containing liquidación's estado in one extra query so the UI can
    # tell "en liquidación abierta" (still editable) from "cerrada" (locked, D-14).
    liq_ids = {ts.liquidacion_id for ts in rows if ts.liquidacion_id is not None}
    liqs: dict[int, Liquidaciones] = {}
    if liq_ids:
        liqs = {
            liq.id: liq
            for liq in (await session.execute(select(Liquidaciones).where(Liquidaciones.id.in_(liq_ids)))).scalars().all()
        }

    out: list[VentaRow] = []
    for ts in rows:
        liq = liqs.get(ts.liquidacion_id) if ts.liquidacion_id is not None else None
        out.append(
            VentaRow(
                id=ts.id,
                tour_id=ts.tour_id,
                vendedor_id=ts.vendedor_id,
                agencia_id=ts.agencia_id,
                forma_pago_id=ts.forma_pago_id,
                moneda=str(ts.moneda.value if hasattr(ts.moneda, "value") else ts.moneda),
                monto=float(ts.monto),
                costo=float(ts.costo) if ts.costo is not None else None,
                fecha=ts.fecha,
                asiento_id=ts.asiento_id,
                liquidacion_id=ts.liquidacion_id,
                liquidacion_estado=(liq.estado.value if liq is not None else None),
                liquidacion_codigo=(liq.codigo if liq is not None else None),
                tipo_servicio=str(ts.tipo_servicio.value if hasattr(ts.tipo_servicio, "value") else ts.tipo_servicio),
                fecha_servicio=ts.fecha_servicio,
                destino=ts.destino,
                nombre_huesped=ts.nombre_huesped,
                numero_habitacion=ts.numero_habitacion,
                hora=ts.hora,
                observaciones=ts.observaciones,
                cantidad_pasajeros=ts.cantidad_pasajeros,
                nombre_pasajero=ts.nombre_pasajero,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# POST /traslados — D-34
# --------------------------------------------------------------------------- #
@router.post("/traslados", response_model=VentaOut, status_code=201)
async def create_traslado(
    body: TrasladoIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> VentaOut:
    """Registra un traslado: mismo circuito que una venta de tour, con su propio
    proveedor de transporte y sus cuentas propias (D-34).

    El margen queda para la casa — el hotel somos nosotros —, así que no hay
    ningún tercero al que acreditárselo.
    """
    if user["role"] == "vendedor" and body.vendedor_id != user["vendedor_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes registrar traslados para otro vendedor")

    proveedor = (await session.execute(select(Agencias).where(Agencias.id == body.agencia_id))).scalar_one_or_none()
    if proveedor is None or not proveedor.activo:
        raise HTTPException(status_code=422, detail="Proveedor no existe o está inactivo")
    if proveedor.tipo != TipoAgencia.proveedor_transporte:
        raise HTTPException(
            status_code=422,
            detail=f"'{proveedor.nombre}' no es un proveedor de transporte",
        )
    forma = (await session.execute(select(FormasPago).where(FormasPago.id == body.forma_pago_id))).scalar_one_or_none()
    if forma is None or not forma.activo:
        raise HTTPException(status_code=422, detail="Forma de pago no existe o está inactiva")
    if body.moneda not in ("PEN", "USD"):
        raise HTTPException(status_code=422, detail="Moneda debe ser PEN o USD")
    if body.monto <= 0:
        raise HTTPException(status_code=422, detail="Monto debe ser positivo")
    if (body.costo or 0) > body.monto:
        raise HTTPException(status_code=422, detail="El costo del proveedor no puede superar el precio cobrado al huésped")

    # tour_id apunta siempre a la fila de catálogo genérica (el destino real es
    # texto libre): tours_servicios.tour_id es NOT NULL con FK a tours_catalogo.
    catalogo = (await session.execute(
        select(ToursCatalogo).where(ToursCatalogo.codigo == CODIGO_CATALOGO_TRASLADO)
    )).scalar_one_or_none()
    if catalogo is None:
        raise HTTPException(status_code=422, detail=f"Falta la fila de catálogo {CODIGO_CATALOGO_TRASLADO}")

    try:
        asiento, tour_servicio = await post_venta_traslado(
            session,
            tour_id=catalogo.id,
            vendedor_id=body.vendedor_id,
            agencia_id=body.agencia_id,
            forma_pago_id=body.forma_pago_id,
            moneda=body.moneda,
            monto=body.monto,
            costo=body.costo,
            fecha=body.fecha,
            fecha_servicio=body.fecha_servicio or body.fecha,
            destino=body.destino.strip(),
            nombre_huesped=body.nombre_huesped.strip(),
            numero_habitacion=body.numero_habitacion.strip(),
            hora=body.hora,
            observaciones=(body.observaciones or "").strip() or None,
            metadata=body.metadata,
            creacion_usuario_id=user["id"],
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return VentaOut(asiento_id=asiento.id, tour_servicio_id=tour_servicio.id)


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
    """Create an `abierta` liquidación with the tours_servicios the user picked by hand (D-35).

    `fecha_desde`/`fecha_hasta`/`vendedor_id`/`agencia_id` stay as descriptive
    metadata of the batch (and as the filter the picker UI used) — they no
    longer drive auto-assignment. Assignment is exactly `tour_servicio_ids`.
    """
    if body.fecha_hasta < body.fecha_desde:
        raise HTTPException(status_code=422, detail="fecha_hasta debe ser posterior a fecha_desde")

    ids = set(body.tour_servicio_ids)
    stmt = select(ToursServicios).where(ToursServicios.id.in_(ids))
    tours = list((await session.execute(stmt)).scalars().all())
    found_ids = {ts.id for ts in tours}
    missing = ids - found_ids
    if missing:
        raise HTTPException(status_code=422, detail=f"Ventas no encontradas: {sorted(missing)}")

    # D-36 — el tipo de la liquidación se infiere de lo seleccionado, no se
    # manda aparte: una liquidación de traslados es solo seguimiento (no
    # comisionan, D-34), close_liquidacion la bifurca para no postear nada.
    for ts in tours:
        if ts.liquidacion_id is not None:
            raise HTTPException(status_code=422, detail=f"Venta #{ts.id} ya está asignada a otra liquidación")
        if not (body.fecha_desde <= ts.fecha <= body.fecha_hasta):
            raise HTTPException(status_code=422, detail=f"Venta #{ts.id} tiene fecha fuera del rango declarado")
        if user["role"] == "vendedor" and ts.vendedor_id != user["vendedor_id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"No puedes liquidar la venta #{ts.id} de otro vendedor")

    tipos = {ts.tipo_servicio for ts in tours}
    if len(tipos) > 1:
        raise HTTPException(status_code=422, detail="No se puede mezclar tours y traslados en la misma liquidación")
    tipo_servicio = tipos.pop() if tipos else TipoServicio.tour

    liq = Liquidaciones(
        fecha_desde=body.fecha_desde,
        fecha_hasta=body.fecha_hasta,
        vendedor_id=body.vendedor_id,
        agencia_id=body.agencia_id,
        tipo_servicio=tipo_servicio,
    )
    session.add(liq)
    await session.flush()  # populate liq.id

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
    tipo_servicio: str | None = Query(None),
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
    if tipo_servicio is not None:
        stmt = stmt.where(Liquidaciones.tipo_servicio == tipo_servicio)
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


@router.delete("/liquidaciones/{liquidacion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_liquidacion_endpoint(
    liquidacion_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin", "contabilidad")),
) -> None:
    """Anula una liquidación `abierta`: libera sus tours y borra la fila.

    Es la salida para una liquidación creada por error o de prueba — sin esto una
    `abierta` queda atrapada para siempre, porque `reopen` sólo acepta `cerrada` y
    cerrar exige que el pre-check pase. Una `cerrada` ya movió los libros, así que
    se rechaza acá y debe pasar por `/reopen`.
    """
    try:
        await cancel_liquidacion(session, liquidacion_id)
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        msg = str(exc)
        if msg == "Liquidación no encontrada":
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=409, detail=msg)


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

    # Keep the books in step with the edit — otherwise the asiento keeps the
    # amounts the venta was first booked with and /dashboard/saldos drifts away
    # from the ventas table (D-05: the ledger is the source of truth).
    if "monto" in body or "costo" in body:
        if ts.monto is None or float(ts.monto) <= 0:
            await session.rollback()
            raise HTTPException(status_code=422, detail="Monto debe ser positivo")
        try:
            tipo = str(ts.tipo_servicio.value if hasattr(ts.tipo_servicio, "value") else ts.tipo_servicio)
            await resync_venta_asiento(
                session,
                asiento_id=ts.asiento_id,
                moneda=str(ts.moneda.value if hasattr(ts.moneda, "value") else ts.moneda),
                monto=float(ts.monto),
                costo=float(ts.costo) if ts.costo is not None else None,
                tipo_servicio=tipo,
            )
        except ValueError as exc:
            await session.rollback()
            raise HTTPException(status_code=422, detail=str(exc))

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
    # asiento_id FK ondelete=RESTRICT prevents a cascade, and the original asiento
    # stays for audit — so we post its mirror image first, otherwise the caja /
    # ingresos saldos would keep counting a venta that no longer exists.
    asiento_id = ts.asiento_id
    try:
        await post_reversion_asiento(
            session,
            asiento_id=asiento_id,
            fecha=date.today(),
            concepto=f"Reversión venta {tour_servicio_id}",
            metadata={"tipo": "reversion_venta", "tour_servicio_id": tour_servicio_id, "asiento_original_id": asiento_id},
            creacion_usuario_id=user["id"],
        )
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(exc))
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
    # D-32 — force the JWT's vendedor_id claim, not usuarios.id: they are
    # different sequences, and using the user id here filtered the dashboard by
    # someone else's vendedor (or by nobody at all).
    if user["role"] == "vendedor":
        vendedor_id = user["vendedor_id"]

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

    RBAC role-forcing (T-02.1-14): non-admin vendedor forced to their own vendedor_id claim (D-32).
    """
    if user["role"] == "vendedor":
        vendedor_id = user["vendedor_id"]

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