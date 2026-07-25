"""apps/tours/api/app/services/venta_resolver.py

D-33 — resolution logic backing the venta-creation UX:
  - which agencia×tour links are "active" (shared with the estado calculado
    on /catalogos, /agencias, /tours — computed at query time, never persisted);
  - which agencia a tour should default to when it has 2+ active price
    agreements (lowest price in the tour's moneda_default, ties broken by the
    most recently created price row);
  - which tours a given vendedor sold most in the last 30 days, to surface as
    "recientes" quick-picks in GET /ventas/tour-search.

Kept out of routers/tours.py so it's unit-testable without going through HTTP.
"""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tours import Agencias, AgenciaTourPrecio, ToursCatalogo, ToursServicios


async def active_agencia_tour_ids(session: AsyncSession) -> tuple[set[int], set[int]]:
    """Distinct (agencia_id set, tour_id set) with >=1 active AgenciaTourPrecio.

    Shared by the estado-calculado on /catalogos, /agencias, /tours (D-33 #2)
    and by tour_search below (D-33 #3) — single source of truth for "vinculado".
    """
    rows = (await session.execute(
        select(AgenciaTourPrecio.agencia_id, AgenciaTourPrecio.tour_id).where(AgenciaTourPrecio.activo.is_(True))
    )).all()
    agencia_ids = {r[0] for r in rows}
    tour_ids = {r[1] for r in rows}
    return agencia_ids, tour_ids


async def resolve_agencia_para_tour(
    session: AsyncSession, tour: ToursCatalogo
) -> tuple[AgenciaTourPrecio | None, dict[str, list[AgenciaTourPrecio]] | None]:
    """Pick the AgenciaTourPrecio a venta for this tour should default to.

    Returns (resolved, grouped):
    - No active price → (None, None) — tour is not disponible_para_venta.
    - All candidates quote in a single currency → (resolved, None): lowest
      price wins, ties broken by the most recently created price row
      (creado_en desc). Auto-select with 1 candidate, preselect with 2+.
    - Candidates span 2+ currencies → (None, grouped): no auto/preselect,
      caller must let the vendedor pick manually. A row carrying both precio
      and precio_usd is grouped by the tour's own moneda_default only (not
      both groups).
    """
    rows = list((await session.execute(
        select(AgenciaTourPrecio).where(
            AgenciaTourPrecio.tour_id == tour.id,
            AgenciaTourPrecio.activo.is_(True),
        )
    )).scalars().all())
    if not rows:
        return None, None

    moneda_default = tour.moneda_default.value if hasattr(tour.moneda_default, "value") else str(tour.moneda_default)

    grouped: dict[str, list[AgenciaTourPrecio]] = {}
    for r in rows:
        if r.precio is not None and r.precio_usd is not None:
            # Dual-currency row — resolved by the tour's own moneda_default,
            # counts only in that one group.
            moneda = moneda_default
        elif r.precio is not None:
            moneda = "PEN"
        else:
            moneda = "USD"
        grouped.setdefault(moneda, []).append(r)

    if len(grouped) > 1:
        return None, grouped

    candidatos = rows
    campo = "precio" if next(iter(grouped)) == "PEN" else "precio_usd"

    def _key(r: AgenciaTourPrecio):
        return (float(getattr(r, campo)), -r.creado_en.timestamp())

    candidatos = sorted(candidatos, key=_key)
    return candidatos[0], None


async def recent_tour_ids_for_vendedor(
    session: AsyncSession, vendedor_id: int | None, dias: int = 30, top: int = 5
) -> set[int]:
    """Top-`top` tour_ids by sale count for `vendedor_id` in the last `dias`
    days. Empty set (never "reciente") when vendedor_id is not provided."""
    if vendedor_id is None:
        return set()
    desde = date.today() - timedelta(days=dias)
    stmt = (
        select(ToursServicios.tour_id, func.count().label("n"))
        .where(ToursServicios.vendedor_id == vendedor_id, ToursServicios.fecha >= desde)
        .group_by(ToursServicios.tour_id)
        .order_by(func.count().desc())
        .limit(top)
    )
    rows = (await session.execute(stmt)).all()
    return {r[0] for r in rows}


async def tour_search(session: AsyncSession, q: str | None, vendedor_id: int | None) -> list[dict]:
    """GET /ventas/tour-search resolution — see routers/tours.py for the route.

    Returns rows for every active tour with estado=disponible_para_venta whose
    nombre contains `q` (case-insensitive, empty/None = all), each resolved to
    a default agencia + precio + es_reciente flag. Ordered: recientes first,
    then alphabetical by nombre.
    """
    _, active_tour_ids = await active_agencia_tour_ids(session)
    if not active_tour_ids:
        return []

    stmt = select(ToursCatalogo).where(
        ToursCatalogo.activo.is_(True),
        ToursCatalogo.id.in_(active_tour_ids),
    )
    if q:
        stmt = stmt.where(func.lower(ToursCatalogo.nombre).contains(q.lower()))
    tours = list((await session.execute(stmt)).scalars().all())

    recientes = await recent_tour_ids_for_vendedor(session, vendedor_id)

    resultados: list[dict] = []
    for tour in tours:
        precio_row, grouped = await resolve_agencia_para_tour(session, tour)
        if precio_row is None and grouped is None:
            continue  # no agencia at all — shouldn't happen given active_tour_ids, but stay defensive

        if precio_row is not None:
            agencia = (await session.execute(
                select(Agencias).where(Agencias.id == precio_row.agencia_id)
            )).scalar_one_or_none()
            resultados.append({
                "tour_id": tour.id,
                "nombre": tour.nombre,
                "agencia_id": precio_row.agencia_id,
                "agencia_nombre": agencia.nombre if agencia is not None else None,
                "precio": float(precio_row.precio) if precio_row.precio is not None else None,
                "precio_usd": float(precio_row.precio_usd) if precio_row.precio_usd is not None else None,
                "es_reciente": tour.id in recientes,
                "requires_manual_selection": False,
                "candidatos": None,
            })
            continue

        # Mixed-currency case — surface every candidate, let the vendedor pick.
        candidatos_rows = [r for rows in grouped.values() for r in rows]
        agencia_ids = {r.agencia_id for r in candidatos_rows}
        agencias_by_id = {
            a.id: a.nombre
            for a in (await session.execute(
                select(Agencias).where(Agencias.id.in_(agencia_ids))
            )).scalars().all()
        }
        candidatos = [
            {
                "agencia_id": r.agencia_id,
                "agencia_nombre": agencias_by_id.get(r.agencia_id),
                "precio": float(r.precio) if r.precio is not None else None,
                "precio_usd": float(r.precio_usd) if r.precio_usd is not None else None,
                "moneda": moneda,
            }
            for moneda, rows in grouped.items()
            for r in rows
        ]
        resultados.append({
            "tour_id": tour.id,
            "nombre": tour.nombre,
            "agencia_id": None,
            "agencia_nombre": None,
            "precio": None,
            "precio_usd": None,
            "es_reciente": tour.id in recientes,
            "requires_manual_selection": True,
            "candidatos": candidatos,
        })

    resultados.sort(key=lambda r: (not r["es_reciente"], r["nombre"].lower()))
    return resultados
