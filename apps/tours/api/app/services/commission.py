"""apps/tours/api/app/services/commission.py

Commission precedence resolution (Pattern 3, Pitfall 5).
Order: vendedor+tour > vendedor > tour > default global (NULL/NULL).
`simular_comision` wraps resolve + computes the comision amount for /simular.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tours import ComisionReglas


async def resolve_comision(session: AsyncSession, vendedor_id: int | None, tour_id: int | None) -> float:
    """Return the porcentaje applying 4-level precedence. Default global is guaranteed seeded (D-10)."""
    # 1: vendedor+tour
    if vendedor_id is not None and tour_id is not None:
        stmt = select(ComisionReglas).where(
            ComisionReglas.vendedor_id == vendedor_id,
            ComisionReglas.tour_id == tour_id,
            ComisionReglas.activo.is_(True),
        )
        regla = (await session.execute(stmt)).scalar_one_or_none()
        if regla is not None:
            return float(regla.porcentaje)

    # 2: vendedor only
    if vendedor_id is not None:
        stmt = select(ComisionReglas).where(
            ComisionReglas.vendedor_id == vendedor_id,
            ComisionReglas.tour_id.is_(None),  # Pitfall 5 — .is_(None) not == None
            ComisionReglas.activo.is_(True),
        )
        regla = (await session.execute(stmt)).scalar_one_or_none()
        if regla is not None:
            return float(regla.porcentaje)

    # 3: tour only
    if tour_id is not None:
        stmt = select(ComisionReglas).where(
            ComisionReglas.vendedor_id.is_(None),
            ComisionReglas.tour_id == tour_id,
            ComisionReglas.activo.is_(True),
        )
        regla = (await session.execute(stmt)).scalar_one_or_none()
        if regla is not None:
            return float(regla.porcentaje)

    # 4: default global (NULL/NULL) — must exist
    stmt = select(ComisionReglas).where(
        ComisionReglas.vendedor_id.is_(None),
        ComisionReglas.tour_id.is_(None),
    )
    regla = (await session.execute(stmt)).scalar_one()
    return float(regla.porcentaje)


async def simular_comision(session: AsyncSession, vendedor_id: int | None, tour_id: int | None, monto: float) -> dict:
    """Return {vendedor_id, tour_id, monto, porcentaje, comision} for /simular preview."""
    porcentaje = await resolve_comision(session, vendedor_id, tour_id)
    comision = float(monto) * (porcentaje / 100)
    return {
        "vendedor_id": vendedor_id,
        "tour_id": tour_id,
        "monto": monto,
        "porcentaje": porcentaje,
        "comision": comision,
    }