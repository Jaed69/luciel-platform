"""apps/tours/api/app/routers/solicitudes.py

/solicitudes — feedback/mejora/bug tickets reported from anywhere in the panel
(D-28). Any authed role can create; non-admin sees only their own; admin sees
all (optional ?estado= filter) and is the only one who can resolve a ticket.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.tours import EstadoSolicitud, Solicitudes
from app.schemas.tours import SolicitudCreateIn, SolicitudOut, SolicitudUpdateIn

router = APIRouter(tags=["solicitudes"])


@router.post("/solicitudes", response_model=SolicitudOut, status_code=201)
async def create_solicitud(
    body: SolicitudCreateIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> Solicitudes:
    solicitud = Solicitudes(
        titulo=body.titulo,
        descripcion=body.descripcion,
        tipo=body.tipo,
        prioridad=body.prioridad,
        pagina_origen=body.pagina_origen,
        creado_por=int(user["id"]),
    )
    session.add(solicitud)
    await session.commit()
    await session.refresh(solicitud)
    return solicitud


@router.get("/solicitudes", response_model=list[SolicitudOut])
async def list_solicitudes(
    estado: EstadoSolicitud | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> list[Solicitudes]:
    stmt = select(Solicitudes).order_by(Solicitudes.id.desc())
    if user["role"] != "admin":
        stmt = stmt.where(Solicitudes.creado_por == int(user["id"]))
    if estado is not None:
        stmt = stmt.where(Solicitudes.estado == estado)
    return list((await session.execute(stmt)).scalars().all())


@router.put("/solicitudes/{solicitud_id}", response_model=SolicitudOut)
async def update_solicitud(
    solicitud_id: int,
    body: SolicitudUpdateIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin")),
) -> Solicitudes:
    solicitud = (await session.execute(select(Solicitudes).where(Solicitudes.id == solicitud_id))).scalar_one_or_none()
    if solicitud is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    solicitud.estado = body.estado
    solicitud.respuesta = body.respuesta
    if body.estado in (EstadoSolicitud.resuelto, EstadoSolicitud.descartado):
        solicitud.resuelto_por = int(user["id"])
        solicitud.resuelto_en = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(solicitud)
    return solicitud
