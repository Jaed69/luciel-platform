"""apps/tours/api/app/services/accounting.py

Double-entry posting with Python-level balance validation (D-05/D-08) and
single-moneda enforcement. Caller opens the transaction; this service inserts
the Asientos + AsientoLineas rows and validates. On imbalance or moneda mix,
raises ValueError — caller's transaction rolls back.
"""
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import AsientoLineas, Asientos, Cuentas

# Integer-cents balance comparison avoids float drift (D-05).
_CENTS = Decimal("0.01")


def _to_cents(value: float | Decimal | int | None) -> int:
    if value is None:
        return 0
    return int((Decimal(str(value)).quantize(_CENTS) * 100).to_integral_value())


async def post_asiento(
    session: AsyncSession,
    fecha: date,
    concepto: str,
    lineas: list[dict[str, Any]],
    metadata: dict[str, Any] | None = None,
    modulo_id: int | None = None,
    creacion_usuario_id: int | None = None,
) -> Asientos:
    """Insert Asientos + AsientoLineas and validate balance + single-moneda.

    Caller must open the transaction (so it can compose with tours_servicios
    insert in POST /ventas — D-15). On ValueError the caller's rollback fires.
    """
    asiento = Asientos(
        fecha=fecha,
        concepto=concepto,
        metadata_=metadata,
        modulos_id=modulo_id,
        creacion_usuario_id=creacion_usuario_id,
    )
    session.add(asiento)
    await session.flush()  # populate asiento.id

    total_debe_cents = 0
    total_haber_cents = 0
    monedas_seen: set[str] = set()

    for linea in lineas:
        cuenta_id = linea["cuenta_id"]
        debe = linea.get("debe", 0) or 0
        haber = linea.get("haber", 0) or 0
        total_debe_cents += _to_cents(debe)
        total_haber_cents += _to_cents(haber)

        cuenta = (await session.execute(select(Cuentas).where(Cuentas.id == cuenta_id))).scalar_one_or_none()
        if cuenta is None:
            raise ValueError(f"Cuenta {cuenta_id} no encontrada")
        monedas_seen.add(cuenta.moneda.value if hasattr(cuenta.moneda, "value") else str(cuenta.moneda))

        session.add(AsientoLineas(
            asiento_id=asiento.id,
            cuenta_id=cuenta_id,
            debe=debe,
            haber=haber,
        ))

    if total_debe_cents != total_haber_cents:
        raise ValueError(f"Asiento no cuadra: debe={total_debe_cents / 100:.2f} haber={total_haber_cents / 100:.2f}")

    if len(monedas_seen) > 1:
        raise ValueError(f"Asiento mezcla monedas: {sorted(monedas_seen)} — use una sola moneda por asiento (D-08)")

    await session.flush()
    return asiento


async def post_venta_tour(
    session: AsyncSession,
    *,
    tour_id: int,
    vendedor_id: int,
    agencia_id: int,
    forma_pago_id: int,
    moneda: str,
    monto: float,
    costo: float | None,
    fecha: date,
    metadata: dict[str, Any] | None = None,
    creacion_usuario_id: int | None = None,
) -> tuple[Asientos, "ToursServicios"]:
    """Build the asiento for a tour venta and insert tours_servicios in the same tx (D-15)."""
    from app.models.tours import ToursServicios

    codigo_caja = f"101-CAJA-{moneda}"
    codigo_ingreso = f"401-INGRESOS-TOURS-{moneda}"
    codigo_costo = f"501-COSTOS-TOURS-{moneda}"
    codigo_agencias_por_pagar = f"202-AGENCIAS-POR-PAGAR-{moneda}"

    caja = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo_caja))).scalar_one_or_none()
    if caja is None:
        raise ValueError(f"Cuenta {codigo_caja} no encontrada en chart de cuentas")
    ingreso = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo_ingreso))).scalar_one_or_none()
    if ingreso is None:
        raise ValueError(f"Cuenta {codigo_ingreso} no encontrada")
    costo_cta = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo_costo))).scalar_one_or_none()
    if costo_cta is None:
        raise ValueError(f"Cuenta {codigo_costo} no encontrada")

    lineas: list[dict[str, Any]] = [
        {"cuenta_id": caja.id, "debe": monto, "haber": 0},
        {"cuenta_id": ingreso.id, "debe": 0, "haber": monto},
    ]
    costo_val = costo or 0
    if _to_cents(costo_val) > 0:
        # D-30 — costo es deuda acumulada con la agencia (pasivo), no salida de caja
        # inmediata. Se paga después vía /agencia-pagos (débito de esta misma cuenta).
        agencias_por_pagar = (await session.execute(
            select(Cuentas).where(Cuentas.codigo == codigo_agencias_por_pagar)
        )).scalar_one_or_none()
        if agencias_por_pagar is None:
            raise ValueError(f"Cuenta {codigo_agencias_por_pagar} no encontrada")
        lineas.append({"cuenta_id": costo_cta.id, "debe": costo_val, "haber": 0})
        lineas.append({"cuenta_id": agencias_por_pagar.id, "debe": 0, "haber": costo_val})

    asiento = await post_asiento(
        session,
        fecha=fecha,
        concepto=f"Venta tour {tour_id} - vendedor {vendedor_id}",
        lineas=lineas,
        metadata=metadata,
        modulo_id=None,
        creacion_usuario_id=creacion_usuario_id,
    )

    tour_servicio = ToursServicios(
        tour_id=tour_id,
        vendedor_id=vendedor_id,
        agencia_id=agencia_id,
        forma_pago_id=forma_pago_id,
        moneda=moneda,
        monto=monto,
        costo=costo_val,
        fecha=fecha,
        asiento_id=asiento.id,
        liquidacion_id=None,
        metadata_=None,
    )
    session.add(tour_servicio)
    await session.flush()
    return asiento, tour_servicio