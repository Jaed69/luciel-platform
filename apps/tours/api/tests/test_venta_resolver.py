"""apps/tours/api/tests/test_venta_resolver.py

D-33 #3 — unit tests for app.services.venta_resolver (single-agencia
auto-resolve, 2+ agencia price tie-break, es_reciente top-5/30-day logic, q
filtering). Uses async_session directly (no HTTP) per the module's own
"unit-testable" design goal.
"""
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.core import Cuentas
from app.models.tours import Agencias, AgenciaTourPrecio, FormasPago, ToursCatalogo, ToursServicios, Vendedores
from app.services.venta_resolver import (
    active_agencia_tour_ids,
    recent_tour_ids_for_vendedor,
    resolve_agencia_para_tour,
    tour_search,
)

pytestmark = pytest.mark.asyncio


async def _seed_base(session):
    """Minimal catalog rows independent of app.seed (keeps ids predictable)."""
    ag1 = Agencias(codigo="AG-1", nombre="Agencia Uno")
    ag2 = Agencias(codigo="AG-2", nombre="Agencia Dos")
    tour_a = ToursCatalogo(codigo="T-A", nombre="Alpha Tour", moneda_default="PEN")
    tour_b = ToursCatalogo(codigo="T-B", nombre="Beta Tour", moneda_default="PEN")
    tour_c = ToursCatalogo(codigo="T-C", nombre="Cerro Tour", moneda_default="PEN")  # never vinculado
    vend = Vendedores(codigo="V-1", nombre="Vendedor Uno")
    forma = FormasPago(nombre="Efectivo")
    session.add_all([ag1, ag2, tour_a, tour_b, tour_c, vend, forma])
    await session.flush()
    return ag1, ag2, tour_a, tour_b, tour_c, vend, forma


async def test_resolve_agencia_para_tour_single_active_price(async_session):
    ag1, ag2, tour_a, *_ = await _seed_base(async_session)
    precio = AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100)
    async_session.add(precio)
    await async_session.flush()

    resolved = await resolve_agencia_para_tour(async_session, tour_a)
    assert resolved is not None
    assert resolved.agencia_id == ag1.id


async def test_resolve_agencia_para_tour_no_active_price_returns_none(async_session):
    _, _, tour_a, *_ = await _seed_base(async_session)
    resolved = await resolve_agencia_para_tour(async_session, tour_a)
    assert resolved is None


async def test_resolve_agencia_para_tour_ignores_inactive_price(async_session):
    ag1, _, tour_a, *_ = await _seed_base(async_session)
    precio = AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100, activo=False)
    async_session.add(precio)
    await async_session.flush()
    resolved = await resolve_agencia_para_tour(async_session, tour_a)
    assert resolved is None


async def test_resolve_agencia_para_tour_two_prices_picks_lowest_in_default_currency(async_session):
    ag1, ag2, tour_a, *_ = await _seed_base(async_session)  # moneda_default=PEN
    cara = AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=150)
    barata = AgenciaTourPrecio(agencia_id=ag2.id, tour_id=tour_a.id, precio=90)
    async_session.add_all([cara, barata])
    await async_session.flush()

    resolved = await resolve_agencia_para_tour(async_session, tour_a)
    assert resolved.agencia_id == ag2.id
    assert float(resolved.precio) == 90


async def test_resolve_agencia_para_tour_tie_breaks_by_most_recent_creado_en(async_session):
    ag1, ag2, tour_a, *_ = await _seed_base(async_session)
    older = AgenciaTourPrecio(
        agencia_id=ag1.id, tour_id=tour_a.id, precio=100,
        creado_en=datetime(2026, 1, 1),
    )
    newer = AgenciaTourPrecio(
        agencia_id=ag2.id, tour_id=tour_a.id, precio=100,
        creado_en=datetime(2026, 6, 1),
    )
    async_session.add_all([older, newer])
    await async_session.flush()

    resolved = await resolve_agencia_para_tour(async_session, tour_a)
    assert resolved.agencia_id == ag2.id  # newer wins the tie


async def test_active_agencia_tour_ids(async_session):
    ag1, ag2, tour_a, tour_b, *_ = await _seed_base(async_session)
    async_session.add(AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100))
    await async_session.flush()

    agencia_ids, tour_ids = await active_agencia_tour_ids(async_session)
    assert agencia_ids == {ag1.id}
    assert tour_ids == {tour_a.id}


async def test_recent_tour_ids_for_vendedor_none_vendedor_returns_empty(async_session):
    assert await recent_tour_ids_for_vendedor(async_session, None) == set()


async def _make_asiento(session, codigo_suffix="TEST"):
    cuenta = Cuentas(codigo=f"999-TEST-{codigo_suffix}", nombre="test", tipo="activo", moneda="PEN")
    session.add(cuenta)
    await session.flush()
    from app.models.core import Asientos
    asiento = Asientos(fecha=date.today(), concepto="test")
    session.add(asiento)
    await session.flush()
    return asiento


async def test_recent_tour_ids_for_vendedor_top5_last_30_days(async_session):
    ag1, _, tour_a, tour_b, tour_c, vend, forma = await _seed_base(async_session)
    asiento = await _make_asiento(async_session)
    hoy = date.today()

    # tour_a sold 3x within 30 days, tour_b sold 1x within 30 days,
    # tour_c sold 5x but 40 days ago (outside window) -> excluded.
    for _ in range(3):
        async_session.add(ToursServicios(
            tour_id=tour_a.id, vendedor_id=vend.id, agencia_id=ag1.id, forma_pago_id=forma.id,
            moneda="PEN", monto=100, fecha=hoy - timedelta(days=1), asiento_id=asiento.id,
        ))
    async_session.add(ToursServicios(
        tour_id=tour_b.id, vendedor_id=vend.id, agencia_id=ag1.id, forma_pago_id=forma.id,
        moneda="PEN", monto=100, fecha=hoy - timedelta(days=2), asiento_id=asiento.id,
    ))
    for _ in range(5):
        async_session.add(ToursServicios(
            tour_id=tour_c.id, vendedor_id=vend.id, agencia_id=ag1.id, forma_pago_id=forma.id,
            moneda="PEN", monto=100, fecha=hoy - timedelta(days=40), asiento_id=asiento.id,
        ))
    await async_session.flush()

    recientes = await recent_tour_ids_for_vendedor(async_session, vend.id, dias=30, top=5)
    assert recientes == {tour_a.id, tour_b.id}


async def test_tour_search_q_filters_case_insensitive(async_session):
    ag1, _, tour_a, tour_b, *_ = await _seed_base(async_session)
    async_session.add_all([
        AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100),
        AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_b.id, precio=100),
    ])
    await async_session.flush()

    resultados = await tour_search(async_session, q="alpha", vendedor_id=None)
    assert [r["tour_id"] for r in resultados] == [tour_a.id]

    resultados_vacio = await tour_search(async_session, q=None, vendedor_id=None)
    assert {r["tour_id"] for r in resultados_vacio} == {tour_a.id, tour_b.id}


async def test_tour_search_excludes_tours_without_active_price(async_session):
    ag1, _, tour_a, tour_b, tour_c, *_ = await _seed_base(async_session)
    async_session.add(AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100))
    await async_session.flush()

    resultados = await tour_search(async_session, q=None, vendedor_id=None)
    ids = {r["tour_id"] for r in resultados}
    assert tour_a.id in ids
    assert tour_b.id not in ids and tour_c.id not in ids


async def test_tour_search_orders_recientes_first_then_alfabetico(async_session):
    ag1, _, tour_a, tour_b, *_ = await _seed_base(async_session)
    vend = (await async_session.execute(select(Vendedores))).scalars().first()
    forma = (await async_session.execute(select(FormasPago))).scalars().first()
    async_session.add_all([
        AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_a.id, precio=100),
        AgenciaTourPrecio(agencia_id=ag1.id, tour_id=tour_b.id, precio=100),
    ])
    asiento = await _make_asiento(async_session)
    # tour_b is "reciente" for vendedor 1, tour_a is not -> tour_b sorts first
    # even though "Alpha" < "Beta" alphabetically.
    async_session.add(ToursServicios(
        tour_id=tour_b.id, vendedor_id=vend.id, agencia_id=ag1.id, forma_pago_id=forma.id,
        moneda="PEN", monto=100, fecha=date.today(), asiento_id=asiento.id,
    ))
    await async_session.flush()

    resultados = await tour_search(async_session, q=None, vendedor_id=vend.id)
    assert [r["tour_id"] for r in resultados] == [tour_b.id, tour_a.id]
    assert resultados[0]["es_reciente"] is True
    assert resultados[1]["es_reciente"] is False
