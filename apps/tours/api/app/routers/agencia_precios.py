"""apps/tours/api/app/routers/agencia_precios.py

/agencia-precios — precio de lista por agencia×tour (D-30). Small dedicated
CRUD (3 agencias × 9 tours), no referential-integrity guard on DELETE since
nothing else FKs into this table — it's purely a price list.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.tours import AgenciaTourPrecio
from app.schemas.tours import AgenciaTourPrecioIn, AgenciaTourPrecioOut

router = APIRouter(tags=["agencia-precios"])


@router.get("/agencia-precios", response_model=list[AgenciaTourPrecioOut])
async def list_agencia_precios(
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[AgenciaTourPrecio]:
    return list((await session.execute(select(AgenciaTourPrecio).order_by(AgenciaTourPrecio.id))).scalars().all())


@router.post("/agencia-precios", response_model=AgenciaTourPrecioOut, status_code=201)
async def create_agencia_precio(
    body: AgenciaTourPrecioIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> AgenciaTourPrecio:
    row = AgenciaTourPrecio(**body.model_dump())
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un precio para esta agencia y tour")
    await session.refresh(row)
    return row


@router.put("/agencia-precios/{precio_id}", response_model=AgenciaTourPrecioOut)
async def update_agencia_precio(
    precio_id: int,
    body: AgenciaTourPrecioIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> AgenciaTourPrecio:
    row = (await session.execute(select(AgenciaTourPrecio).where(AgenciaTourPrecio.id == precio_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    for field, value in body.model_dump().items():
        setattr(row, field, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un precio para esta agencia y tour")
    await session.refresh(row)
    return row


@router.delete("/agencia-precios/{precio_id}")
async def delete_agencia_precio(
    precio_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> dict:
    row = (await session.execute(select(AgenciaTourPrecio).where(AgenciaTourPrecio.id == precio_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    await session.delete(row)
    await session.commit()
    return {"ok": True}
