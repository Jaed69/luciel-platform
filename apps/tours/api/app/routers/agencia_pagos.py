"""apps/tours/api/app/routers/agencia_pagos.py

/agencia-pagos + /agencias/{id}/saldo — pagos a agencia y deuda acumulada
(D-30). Cada pago postea débito 202-AGENCIAS-POR-PAGAR-{moneda} / crédito
101-CAJA-{moneda}, reduciendo el pasivo acumulado por costo de ventas.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.core import Cuentas
from app.models.tours import AgenciaPagos, ToursServicios
from app.schemas.tours import AgenciaPagoIn, AgenciaPagoOut, AgenciaSaldoOut
from app.services.accounting import post_asiento

router = APIRouter(tags=["agencia-pagos"])


@router.get("/agencias/{agencia_id}/saldo", response_model=AgenciaSaldoOut)
async def get_agencia_saldo(
    agencia_id: int,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> AgenciaSaldoOut:
    saldos: dict[str, float] = {"PEN": 0.0, "USD": 0.0}
    costo_rows = (await session.execute(
        select(ToursServicios.moneda, func.coalesce(func.sum(ToursServicios.costo), 0))
        .where(ToursServicios.agencia_id == agencia_id)
        .group_by(ToursServicios.moneda)
    )).all()
    for moneda, total in costo_rows:
        codigo = moneda.value if hasattr(moneda, "value") else str(moneda)
        saldos[codigo] = saldos.get(codigo, 0.0) + float(total)

    pago_rows = (await session.execute(
        select(AgenciaPagos.moneda, func.coalesce(func.sum(AgenciaPagos.monto), 0))
        .where(AgenciaPagos.agencia_id == agencia_id)
        .group_by(AgenciaPagos.moneda)
    )).all()
    for moneda, total in pago_rows:
        codigo = moneda.value if hasattr(moneda, "value") else str(moneda)
        saldos[codigo] = saldos.get(codigo, 0.0) - float(total)

    return AgenciaSaldoOut(agencia_id=agencia_id, PEN=saldos["PEN"], USD=saldos["USD"])


@router.get("/agencia-pagos", response_model=list[AgenciaPagoOut])
async def list_agencia_pagos(
    agencia_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(get_current_user),
) -> list[AgenciaPagos]:
    stmt = select(AgenciaPagos).order_by(AgenciaPagos.id.desc())
    if agencia_id is not None:
        stmt = stmt.where(AgenciaPagos.agencia_id == agencia_id)
    return list((await session.execute(stmt)).scalars().all())


@router.post("/agencia-pagos", response_model=AgenciaPagoOut, status_code=201)
async def create_agencia_pago(
    body: AgenciaPagoIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin", "contabilidad")),
) -> AgenciaPagos:
    codigo_agencias_por_pagar = f"202-AGENCIAS-POR-PAGAR-{body.moneda}"
    codigo_caja = f"101-CAJA-{body.moneda}"

    agencias_por_pagar = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo_agencias_por_pagar))).scalar_one_or_none()
    if agencias_por_pagar is None:
        raise HTTPException(status_code=422, detail=f"Cuenta {codigo_agencias_por_pagar} no encontrada")
    caja = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo_caja))).scalar_one_or_none()
    if caja is None:
        raise HTTPException(status_code=422, detail=f"Cuenta {codigo_caja} no encontrada")

    asiento = await post_asiento(
        session,
        fecha=body.fecha,
        concepto=f"Pago a agencia {body.agencia_id}",
        lineas=[
            {"cuenta_id": agencias_por_pagar.id, "debe": body.monto, "haber": 0},
            {"cuenta_id": caja.id, "debe": 0, "haber": body.monto},
        ],
        metadata={"agencia_id": body.agencia_id, "metodo": body.metodo.value},
        creacion_usuario_id=user["id"],
    )

    pago = AgenciaPagos(
        agencia_id=body.agencia_id,
        fecha=body.fecha,
        monto=body.monto,
        moneda=body.moneda,
        metodo=body.metodo,
        referencia=body.referencia,
        nota=body.nota,
        creado_por=int(user["id"]),
        asiento_id=asiento.id,
    )
    session.add(pago)
    await session.commit()
    await session.refresh(pago)
    return pago
