"""apps/tours/api/tests/test_partida_doble.py

Double-entry balance + single-moneda validation (D-05/D-08).
"""
import json
from datetime import date
from decimal import Decimal

import pytest

from app.services.accounting import _to_cents, post_asiento


pytestmark = pytest.mark.asyncio


async def _seed(async_session):
    from app.seed import run_if_empty
    await run_if_empty(async_session)
    await async_session.commit()


async def test_post_venta_produces_balanced_asiento(authed, async_session):
    """A venta produces an asiento where sum(debe)==sum(haber)."""
    await _seed(async_session)
    from app.models.core import Cuentas
    from sqlalchemy import select
    caja = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "101-CAJA-PEN"))).scalar_one()
    ingreso = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "401-INGRESOS-TOURS-PEN"))).scalar_one()

    asiento = await post_asiento(
        async_session,
        fecha=date(2026, 7, 4),
        concepto="Venta test",
        lineas=[
            {"cuenta_id": caja.id, "debe": 100, "haber": 0},
            {"cuenta_id": ingreso.id, "debe": 0, "haber": 100},
        ],
    )
    await async_session.commit()
    assert asiento.id is not None
    assert _to_cents(100) == _to_cents(100)


async def test_unbalanced_asiento_raises_and_rolls_back(authed, async_session):
    """Forcing an unbalanced asiento raises ValueError; no lines persist."""
    await _seed(async_session)
    from app.models.core import Cuentas, AsientoLineas
    from sqlalchemy import select
    caja = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "101-CAJA-PEN"))).scalar_one()
    ingreso = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "401-INGRESOS-TOURS-PEN"))).scalar_one()

    with pytest.raises(ValueError, match="no cuadra"):
        await post_asiento(
            async_session,
            fecha=date(2026, 7, 4),
            concepto="unbalanced",
            lineas=[
                {"cuenta_id": caja.id, "debe": 100, "haber": 0},
                {"cuenta_id": ingreso.id, "debe": 0, "haber": 99},
            ],
        )
    await async_session.rollback()
    rows = (await async_session.execute(select(AsientoLineas))).scalars().all()
    assert len(rows) == 0


async def test_single_moneda_enforced(authed, async_session):
    """Mixing PEN and USD accounts in one asiento raises ValueError (D-08)."""
    await _seed(async_session)
    from app.models.core import Cuentas
    from sqlalchemy import select
    caja_pen = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "101-CAJA-PEN"))).scalar_one()
    caja_usd = (await async_session.execute(select(Cuentas).where(Cuentas.codigo == "101-CAJA-USD"))).scalar_one()

    with pytest.raises(ValueError, match="mezcla monedas"):
        await post_asiento(
            async_session,
            fecha=date(2026, 7, 4),
            concepto="mixed",
            lineas=[
                {"cuenta_id": caja_pen.id, "debe": 100, "haber": 0},
                {"cuenta_id": caja_usd.id, "debe": 0, "haber": 100},
            ],
        )
    await async_session.rollback()