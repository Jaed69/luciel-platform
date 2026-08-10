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


async def build_venta_lineas(
    session: AsyncSession,
    *,
    moneda: str,
    monto: float,
    costo: float | None,
) -> list[dict[str, Any]]:
    """Resolve the chart accounts for a tour venta and return its asiento lineas.

    Shared by `post_venta_tour` (initial posting) and `resync_venta_asiento`
    (PUT /tours_servicios/{id}) so an edited venta lands on exactly the same
    account layout it was originally booked with.
    """
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

    return lineas


async def build_traslado_lineas(
    session: AsyncSession,
    *,
    moneda: str,
    monto: float,
    costo: float | None,
) -> list[dict[str, Any]]:
    """Asiento de un traslado (D-34) — es una venta simple:

        D 101-CAJA                     monto cobrado al huésped
        H 401-INGRESOS-TRASLADOS       monto
        D 501-COSTOS-TRASLADOS         costo del proveedor de transporte
        H 203-TRANSPORTE-POR-PAGAR     costo  → deuda con el proveedor

    El margen (monto − costo) no se le acredita a nadie: el hotel somos
    nosotros, así que queda como resultado de la casa. Ingresos, costos y deuda
    van en cuentas separadas de las de tours a propósito — es lo que permite
    leer la rentabilidad de cada línea de negocio por su lado.
    """
    codigo_caja = f"101-CAJA-{moneda}"
    codigo_ingreso = f"401-INGRESOS-TRASLADOS-{moneda}"
    codigo_costo = f"501-COSTOS-TRASLADOS-{moneda}"
    codigo_transporte_por_pagar = f"203-TRANSPORTE-POR-PAGAR-{moneda}"

    async def _cuenta(codigo: str) -> Cuentas:
        cta = (await session.execute(select(Cuentas).where(Cuentas.codigo == codigo))).scalar_one_or_none()
        if cta is None:
            raise ValueError(f"Cuenta {codigo} no encontrada en chart de cuentas")
        return cta

    caja = await _cuenta(codigo_caja)
    ingreso = await _cuenta(codigo_ingreso)

    lineas: list[dict[str, Any]] = [
        {"cuenta_id": caja.id, "debe": monto, "haber": 0},
        {"cuenta_id": ingreso.id, "debe": 0, "haber": monto},
    ]

    costo_val = costo or 0
    if _to_cents(costo_val) > 0:
        costo_cta = await _cuenta(codigo_costo)
        transporte_por_pagar = await _cuenta(codigo_transporte_por_pagar)
        lineas.append({"cuenta_id": costo_cta.id, "debe": costo_val, "haber": 0})
        lineas.append({"cuenta_id": transporte_por_pagar.id, "debe": 0, "haber": costo_val})

    return lineas


async def resync_venta_asiento(
    session: AsyncSession,
    *,
    asiento_id: int,
    moneda: str,
    monto: float,
    costo: float | None,
    tipo_servicio: str = "tour",
) -> None:
    """Rewrite an existing venta asiento's lineas from the venta's current values.

    PUT /tours_servicios/{id} can change monto/costo; without this the ledger
    would keep the amounts the venta was first booked with and the dashboard
    saldos would drift away from the ventas table. Balance + single-moneda are
    revalidated on the new set, so an invalid edit raises before anything is
    committed.

    Un traslado usa sus propias cuentas (D-34), así que el tipo decide qué
    juego de líneas se reescribe.
    """
    if tipo_servicio == "traslado":
        lineas = await build_traslado_lineas(session, moneda=moneda, monto=monto, costo=costo)
    else:
        lineas = await build_venta_lineas(session, moneda=moneda, monto=monto, costo=costo)

    # ORM delete (not Core) so the audit before_flush hook sees the removals (D-23).
    existing = (await session.execute(
        select(AsientoLineas).where(AsientoLineas.asiento_id == asiento_id)
    )).scalars().all()
    for linea in existing:
        await session.delete(linea)
    await session.flush()

    total_debe_cents = 0
    total_haber_cents = 0
    monedas_seen: set[str] = set()
    for linea in lineas:
        total_debe_cents += _to_cents(linea.get("debe", 0))
        total_haber_cents += _to_cents(linea.get("haber", 0))
        cuenta = (await session.execute(select(Cuentas).where(Cuentas.id == linea["cuenta_id"]))).scalar_one()
        monedas_seen.add(cuenta.moneda.value if hasattr(cuenta.moneda, "value") else str(cuenta.moneda))
        session.add(AsientoLineas(
            asiento_id=asiento_id,
            cuenta_id=linea["cuenta_id"],
            debe=linea.get("debe", 0) or 0,
            haber=linea.get("haber", 0) or 0,
        ))

    if total_debe_cents != total_haber_cents:
        raise ValueError(f"Asiento no cuadra: debe={total_debe_cents / 100:.2f} haber={total_haber_cents / 100:.2f}")
    if len(monedas_seen) > 1:
        raise ValueError(f"Asiento mezcla monedas: {sorted(monedas_seen)} — use una sola moneda por asiento (D-08)")

    await session.flush()


async def post_reversion_asiento(
    session: AsyncSession,
    *,
    asiento_id: int,
    fecha: date,
    concepto: str,
    metadata: dict[str, Any] | None = None,
    creacion_usuario_id: int | None = None,
) -> Asientos:
    """Post the mirror image (debe↔haber swapped) of an existing asiento.

    Used when a venta already consolidated in the books is removed: the original
    asiento stays for audit and this one nets it to zero, instead of leaving the
    ledger carrying a venta that no longer exists.
    """
    orig_lineas = (await session.execute(
        select(AsientoLineas).where(AsientoLineas.asiento_id == asiento_id)
    )).scalars().all()
    reverse = [
        {"cuenta_id": ln.cuenta_id, "debe": float(ln.haber), "haber": float(ln.debe)}
        for ln in orig_lineas
    ]
    return await post_asiento(
        session,
        fecha=fecha,
        concepto=concepto,
        lineas=reverse,
        metadata=metadata,
        creacion_usuario_id=creacion_usuario_id,
    )


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
    observaciones: str | None = None,
    cantidad_pasajeros: int = 1,
    nombre_pasajero: str | None = None,
    creacion_usuario_id: int | None = None,
) -> tuple[Asientos, "ToursServicios"]:
    """Build the asiento for a tour venta and insert tours_servicios in the same tx (D-15)."""
    from app.models.tours import ToursServicios

    lineas = await build_venta_lineas(session, moneda=moneda, monto=monto, costo=costo)
    costo_val = costo or 0

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
        observaciones=observaciones,
        cantidad_pasajeros=cantidad_pasajeros,
        nombre_pasajero=nombre_pasajero,
    )
    session.add(tour_servicio)
    await session.flush()
    return asiento, tour_servicio


async def post_venta_traslado(
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
    fecha_servicio: date | None,
    destino: str,
    nombre_huesped: str,
    numero_habitacion: str,
    hora: str,
    observaciones: str | None = None,
    metadata: dict[str, Any] | None = None,
    creacion_usuario_id: int | None = None,
) -> tuple[Asientos, "ToursServicios"]:
    """Asiento del traslado + fila tours_servicios en la misma tx (D-34, igual que D-15).

    `tour_id` es la fila de catálogo genérica SRV-TRASLADO; el destino real va
    como texto libre en su propia columna.
    """
    from app.models.tours import ToursServicios, TipoServicio

    costo_val = costo or 0
    lineas = await build_traslado_lineas(session, moneda=moneda, monto=monto, costo=costo_val)

    asiento = await post_asiento(
        session,
        fecha=fecha,
        concepto=f"Traslado {destino} - {nombre_huesped}",
        lineas=lineas,
        metadata=metadata,
        modulo_id=None,
        creacion_usuario_id=creacion_usuario_id,
    )

    tour_servicio = ToursServicios(
        tipo_servicio=TipoServicio.traslado,
        tour_id=tour_id,
        vendedor_id=vendedor_id,
        agencia_id=agencia_id,
        forma_pago_id=forma_pago_id,
        moneda=moneda,
        monto=monto,
        costo=costo_val,
        fecha=fecha,
        fecha_servicio=fecha_servicio,
        destino=destino,
        nombre_huesped=nombre_huesped,
        numero_habitacion=numero_habitacion,
        hora=hora,
        observaciones=observaciones,
        asiento_id=asiento.id,
        liquidacion_id=None,
        metadata_=None,
    )
    session.add(tour_servicio)
    await session.flush()
    return asiento, tour_servicio