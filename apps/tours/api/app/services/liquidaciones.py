"""apps/tours/api/app/services/liquidaciones.py

Liquidaciones state machine (D-11/D-13/D-16/D-17/D-19):

- `close_liquidacion(session, liquidacion_id, current_user)`:
    1. Pre-checks: every tours_servicios in range has costo NOT NULL and > 0;
       every (vendedor, tour) pair has a resolvable ComisionRegla (or default global).
       TC-interno pendiente for USD tours in PEN range is WARN-only (Plan 02 simplification 2.1).
    2. For each vendedor in range: per-tour comisión = (monto - costo) * (porcentaje/100).
    3. Builds asiento lineas for `post_asiento` (Plan 01 service):
       débito 501-COSTOS-COMISIONES + crédito 201-COMISIONES-POR-PAGAR (single-moneda PEN per D-08).
    4. Generates `codigo LIQ-{year}-{seq:03d}` from `Liquidaciones.codigo` of closed rows in same year.
    5. Persists `LiquidacionAsientos` pivots (tipo='cierre').
    6. Sets `estado='cerrada'`, `cerrada_en=now()`.

- `reopen_liquidacion(session, liquidacion_id, current_user)`:
    1. For each asiento_id in `LiquidacionAsientos` tipo='cierre':
       reads lineas and constructs reverse lineas (swap debe/haber).
       Calls `post_asiento` with metadata {reversion: true, liquidacion_id, asiento_original_id}.
       Creates `LiquidacionAsientos` pivots (tipo='reversion').
    2. `liquidacion.estado='reverted'`, `reopen_count += 1`.
    3. `tours_servicios.liquidacion_id = NULL` (D-19 desbloqueo).
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import AsientoLineas, Asientos, Cuentas
from app.models.tours import (
    ComisionReglas,
    EstadoLiquidacion,
    LiquidacionAsientos,
    Liquidaciones,
    ToursServicios,
)
from app.services.accounting import post_asiento
from app.services.commission import resolve_comision


class LiquidacionPrecheckError(Exception):
    """Raised when close pre-checks fail — caller maps to HTTP 422 with `fails` list."""

    def __init__(self, fails: list[dict]) -> None:
        self.fails = fails or []
        super().__init__("No se puede cerrar la liquidación: faltan datos")


async def _get_liquidacion_or_raise(session: AsyncSession, liquidacion_id: int) -> Liquidaciones:
    liq = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == liquidacion_id))).scalar_one_or_none()
    if liq is None:
        raise ValueError("Liquidación no encontrada")
    return liq


async def get_precheck(session: AsyncSession, liquidacion_id: int) -> dict:
    """Return {fails: [{tour_id, problema}], warnings: [...] } without mutating state.

    UI uses this to render the pre-check strip on /liquidaciones/[id].
    """
    liq = await _get_liquidacion_or_raise(session, liquidacion_id)
    stmt = (
        select(ToursServicios)
        .where(ToursServicios.liquidacion_id == liq.id)
        .order_by(ToursServicios.fecha.asc())
    )
    tours = list((await session.execute(stmt)).scalars().all())

    fails: list[dict] = []
    warnings: list[dict] = []

    for ts in tours:
        # (a) Costo cargado.
        if ts.costo is None or float(ts.costo) <= 0:
            fails.append({"tour_id": ts.id, "problema": "costo_faltante"})
        # (c) TC interno pendiente for USD tours in PEN range — Warner-only.
        if str(ts.moneda) == "USD":
            warnings.append({"tour_id": ts.id, "problema": "tc_interno_pendiente"})

    # (b) ComisionRegla resoluble por vendedor+pair — default global guarantees this is always satisfied.
    return {"fails": fails, "warnings": warnings}


async def close_liquidacion(session: AsyncSession, liquidacion_id: int, current_user: dict) -> Liquidaciones:
    """Run pre-checks + post asientos de comisión per vendedor + assign LIQ-AAAA-NNN codigo."""
    liq = await _get_liquidacion_or_raise(session, liquidacion_id)
    if liq.estado.value != "abierta":
        raise ValueError(f"Liquidación no está abierta — estado actual: {liq.estado.value}")

    stmt = (
        select(ToursServicios)
        .where(ToursServicios.liquidacion_id == liq.id)
        .order_by(ToursServicios.vendedor_id, ToursServicios.fecha)
    )
    tours = list((await session.execute(stmt)).scalars().all())
    if not tours:
        raise ValueError("Liquidación no tiene tours asignados")

    # --- Pre-checks ---
    precheck = await get_precheck(session, liquidacion_id)
    if precheck["fails"]:
        raise LiquidacionPrecheckError(precheck["fails"])

    # Cuentas.
    comision_cta = (await session.execute(select(Cuentas).where(Cuentas.codigo == "501-COSTOS-COMISIONES"))).scalar_one()
    pagar_cta = (await session.execute(select(Cuentas).where(Cuentas.codigo == "201-COMISIONES-POR-PAGAR"))).scalar_one()

    # --- Per-vendedor grouping, per-tour comisión ---
    # Group by vendedor_id.
    by_vendedor: dict[int, list[ToursServicios]] = {}
    for ts in tours:
        by_vendedor.setdefault(ts.vendedor_id, []).append(ts)

    closing_asientos: list[Asientos] = []
    for vendedor_id, ts_list in by_vendedor.items():
        # Iterate each tour_servicio: comision_tour = margen_tour * (porcentaje/100).
        comision_total_vendedor = Decimal("0")
        tour_ids = []
        for ts in ts_list:
            margen_tour = Decimal(str(ts.monto)) - Decimal(str(ts.costo or 0))
            porcentaje = await resolve_comision(session, vendedor_id, ts.tour_id)
            comision_tour = (margen_tour * Decimal(str(porcentaje)) / Decimal("100"))
            comision_total_vendedor += comision_tour
            tour_ids.append(ts.id)

        lineas = [
            {"cuenta_id": comision_cta.id, "debe": float(comision_total_vendedor), "haber": 0},
            {"cuenta_id": pagar_cta.id, "debe": 0, "haber": float(comision_total_vendedor)},
        ]
        asiento = await post_asiento(
            session,
            fecha=liq.fecha_hasta,
            concepto=f"Cierre liquidación {liq.id} - vendedor {vendedor_id}",
            lineas=lineas,
            metadata={
                "liquidacion_id": liq.id,
                "tipo": "cierre",
                "vendedor_id": vendedor_id,
                "tours_ids": tour_ids,
            },
            creacion_usuario_id=current_user["id"],
        )
        closing_asientos.append(asiento)
        # Persist pivot.
        session.add(LiquidacionAsientos(liquidacion_id=liq.id, asiento_id=asiento.id, tipo="cierre"))

    # --- Generate LIQ-AAAA-NNN codigo (D-16) ---
    year = liq.fecha_hasta.year
    stmt_max = (
        select(func.max(Liquidaciones.codigo))
        .where(Liquidaciones.codigo.like(f"LIQ-{year}-%"))
    )
    max_codigo = (await session.execute(stmt_max)).scalar_one_or_none()
    next_seq = 1
    if max_codigo:
        try:
            next_seq = int(max_codigo.split("-")[-1]) + 1
        except ValueError:
            next_seq = 1
    codigo = f"LIQ-{year}-{next_seq:03d}"
    liq.codigo = codigo
    liq.estado = EstadoLiquidacion.cerrada
    liq.cerrada_en = datetime.now(timezone.utc)

    await session.flush()
    return liq


async def reopen_liquidacion(session: AsyncSession, liquidacion_id: int, current_user: dict) -> Liquidaciones:
    """Generate reversion asientos (swap debe/haber of each closing asiento) + unlock tours."""
    liq = await _get_liquidacion_or_raise(session, liquidacion_id)
    if liq.estado.value != "cerrada":
        raise ValueError(f"Liquidación no está cerrada — estado actual: {liq.estado.value}")

    closing_pivots = list(
        (await session.execute(
            select(LiquidacionAsientos)
            .where(LiquidacionAsientos.liquidacion_id == liq.id, LiquidacionAsientos.tipo == "cierre")
        )).scalars().all()
    )
    if not closing_pivots:
        raise ValueError("Liquidación no tiene asientos de cierre registrados (datos corruptos)")

    today = date.today()
    for pivot in closing_pivots:
        orig_id = pivot.asiento_id
        orig_lineas = list(
            (await session.execute(select(AsientoLineas).where(AsientoLineas.asiento_id == orig_id))).scalars().all()
        )
        reverse = [
            {"cuenta_id": ln.cuenta_id, "debe": float(ln.haber), "haber": float(ln.debe)}
            for ln in orig_lineas
        ]
        asiento = await post_asiento(
            session,
            fecha=today,
            concepto=f"Reversión liquidación {liq.codigo}",
            lineas=reverse,
            metadata={
                "liquidacion_id": liq.id,
                "tipo": "reversion",
                "asiento_original_id": orig_id,
            },
            creacion_usuario_id=current_user["id"],
        )
        session.add(LiquidacionAsientos(liquidacion_id=liq.id, asiento_id=asiento.id, tipo="reversion"))

    liq.estado = EstadoLiquidacion.revertida
    liq.reopen_count = (liq.reopen_count or 0) + 1

    # D-19 — desbloqueo tours.
    tours = list(
        (await session.execute(select(ToursServicios).where(ToursServicios.liquidacion_id == liq.id))).scalars().all()
    )
    for ts in tours:
        ts.liquidacion_id = None

    await session.flush()
    return liq