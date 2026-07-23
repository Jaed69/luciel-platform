"""apps/tours/api/app/routers/tipos_tour.py

/tours — dedicated CRUD for tipos de tour (D-29). Split out of the generic
/catalogos/{entidad} dispatcher because that one only ever touches
codigo/nombre; tipos de tour need descripcion/tiempo/precio to be real,
editable fields end-to-end. RBAC mirrors the rest of the catalog endpoints
(admin+contabilidad mutate, D-13; any authed reads).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.tours import ToursCatalogo
from app.schemas.tours import TipoTourCreateIn, TipoTourOut, TipoTourUpdateIn

router = APIRouter(tags=["tipos-tour"])

# D-19-style referential integrity — same shape as core.py::_REFERENCED_BY["tours"].
_REFERENCED_BY: list[tuple[str, str, str, bool]] = [
    ("tours_servicios", "tour_id", "id", False),
    ("comision_reglas", "tour_id", "id", True),
]


@router.get("/tours", response_model=list[TipoTourOut])
async def list_tours(
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[ToursCatalogo]:
    return list((await session.execute(select(ToursCatalogo).order_by(ToursCatalogo.id))).scalars().all())


@router.post("/tours", response_model=TipoTourOut, status_code=201)
async def create_tour(
    body: TipoTourCreateIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> ToursCatalogo:
    row = ToursCatalogo(**body.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.put("/tours/{tour_id}", response_model=TipoTourOut)
async def update_tour(
    tour_id: int,
    body: TipoTourUpdateIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> ToursCatalogo:
    row = (await session.execute(select(ToursCatalogo).where(ToursCatalogo.id == tour_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Tipo de tour no encontrado")
    for field, value in body.model_dump().items():
        setattr(row, field, value)
    # Do NOT touch row.activo — D-03.
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/tours/{tour_id}")
async def delete_tour(
    tour_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> dict:
    row = (await session.execute(select(ToursCatalogo).where(ToursCatalogo.id == tour_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Tipo de tour no encontrado")

    refs: list[dict] = []
    for tabla, columna, bind_name, uses_activo in _REFERENCED_BY:
        predicate = f"{tabla}.{columna} = :{bind_name}"
        if uses_activo:
            predicate += f" AND {tabla}.activo = 1"
        count = (await session.execute(
            select(func.count()).select_from(text(tabla)).where(text(predicate).bindparams(**{bind_name: tour_id}))
        )).scalar_one()
        if count and int(count) > 0:
            refs.append({"tabla": tabla, "count": int(count)})

    if refs:
        total = sum(r["count"] for r in refs)
        raise HTTPException(
            status_code=409,
            detail={"mensaje": f"No se puede desactivar — {total} registros lo referencian", "referencias": refs},
        )

    row.activo = False  # soft delete
    await session.commit()
    return {"ok": True}


@router.post("/tours/{tour_id}/restore")
async def restore_tour(
    tour_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin", "contabilidad")),
) -> dict:
    row = (await session.execute(select(ToursCatalogo).where(ToursCatalogo.id == tour_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Tipo de tour no encontrado")
    row.activo = True
    await session.commit()
    return {"ok": True}
