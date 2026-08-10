"""apps/tours/api/tests/test_traslados.py

D-34 — traslados como segunda línea de negocio sobre la misma tabla de ventas:
- POST /traslados postea el asiento en cuentas propias y guarda los campos
  operativos, incluidas las dos fechas (cobro vs servicio).
- El margen queda para la casa: el hotel somos nosotros, no un tercero.
- Proveedores de transporte y agencias de tours son listas que no se mezclan.
- Los traslados no entran en las liquidaciones (no comisionan al vendedor).
"""
from datetime import datetime, timezone

import jwt
import pytest
from sqlalchemy import select

from app.config import settings


pytestmark = pytest.mark.asyncio


def _token(role: str = "admin", user_id: int = 1) -> str:
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


def _headers() -> dict:
    return {"Authorization": f"Bearer {_token()}"}


async def _crear_transportista(client, nombre: str = "Transportes Andean") -> int:
    r = await client.post(
        "/catalogos/agencias",
        json={"codigo": f"TR-{nombre[:6].upper().replace(' ', '')}", "nombre": nombre, "tipo": "proveedor_transporte"},
        headers=_headers(),
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _payload(agencia_id: int, **over) -> dict:
    base = {
        "vendedor_id": 1,
        "agencia_id": agencia_id,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": 100,
        "costo": 60,
        "fecha": "2026-07-04",
        "fecha_servicio": "2026-07-06",
        "hora": "08:30",
        "destino": "Aeropuerto",
        "nombre_huesped": "Ana Pérez",
        "numero_habitacion": "204",
        "observaciones": "Vuelo LA2043",
    }
    base.update(over)
    return base


async def _saldos(client) -> dict:
    r = await client.get(
        "/dashboard/saldos",
        params={"fecha_desde": "2000-01-01", "fecha_hasta": "2100-01-01"},
        headers=_headers(),
    )
    assert r.status_code == 200, r.text
    return {c["codigo"]: c["saldo"] for c in r.json()}


async def test_traslado_postea_asiento_completo(client, async_engine):
    """Es una venta simple: caja/ingreso por el precio y costo/deuda con el proveedor.

    El margen (100 − 60 = 40) no se le acredita a nadie — queda como resultado.
    """
    agencia_id = await _crear_transportista(client)
    r = await client.post("/traslados", json=_payload(agencia_id), headers=_headers())
    assert r.status_code == 201, r.text

    saldos = await _saldos(client)
    assert saldos["101-CAJA-PEN"] == 100.0
    assert saldos["401-INGRESOS-TRASLADOS-PEN"] == -100.0  # ingreso: saldo acreedor
    assert saldos["501-COSTOS-TRASLADOS-PEN"] == 60.0
    assert saldos["203-TRANSPORTE-POR-PAGAR-PEN"] == -60.0

    # Margen para la casa: ingresos - costos = 40, no hay pasivo por ese monto.
    assert -saldos["401-INGRESOS-TRASLADOS-PEN"] - saldos["501-COSTOS-TRASLADOS-PEN"] == 40.0

    # No toca las cuentas de tours — cada línea de negocio queda separada.
    assert saldos.get("401-INGRESOS-TOURS-PEN", 0) == 0
    assert saldos.get("202-AGENCIAS-POR-PAGAR-PEN", 0) == 0


async def test_traslado_guarda_campos_operativos_y_ambas_fechas(client):
    agencia_id = await _crear_transportista(client)
    await client.post("/traslados", json=_payload(agencia_id), headers=_headers())

    row = (await client.get("/ventas", headers=_headers())).json()[0]
    assert row["tipo_servicio"] == "traslado"
    assert row["destino"] == "Aeropuerto"
    assert row["nombre_huesped"] == "Ana Pérez"
    assert row["numero_habitacion"] == "204"
    assert row["hora"] == "08:30"
    assert row["observaciones"] == "Vuelo LA2043"
    # Las dos fechas son distintas y cada una guarda lo suyo.
    assert row["fecha"] == "2026-07-04"          # cobro
    assert row["fecha_servicio"] == "2026-07-06"  # traslado


async def test_fecha_servicio_cae_en_la_de_cobro_si_no_se_manda(client):
    """El caso habitual es que coincidan; no obligamos a repetir el dato."""
    agencia_id = await _crear_transportista(client)
    payload = _payload(agencia_id)
    del payload["fecha_servicio"]
    assert (await client.post("/traslados", json=payload, headers=_headers())).status_code == 201

    row = (await client.get("/ventas", headers=_headers())).json()[0]
    assert row["fecha_servicio"] == row["fecha"] == "2026-07-04"


async def test_el_asiento_usa_la_fecha_de_cobro(client):
    """La contabilidad se mueve cuando entra la plata, no cuando se presta el servicio."""
    agencia_id = await _crear_transportista(client)
    await client.post("/traslados", json=_payload(agencia_id), headers=_headers())

    # Filtrando hasta el día del cobro, el asiento ya aparece.
    r = await client.get(
        "/dashboard/saldos",
        params={"fecha_desde": "2026-07-04", "fecha_hasta": "2026-07-04"},
        headers=_headers(),
    )
    saldos = {c["codigo"]: c["saldo"] for c in r.json()}
    assert saldos["101-CAJA-PEN"] == 100.0


async def test_traslado_rechaza_costo_mayor_al_precio(client):
    agencia_id = await _crear_transportista(client)
    r = await client.post("/traslados", json=_payload(agencia_id, monto=50, costo=80), headers=_headers())
    assert r.status_code == 422, r.text
    assert "no puede superar" in r.json()["detail"]


async def test_traslado_exige_campos_operativos(client):
    agencia_id = await _crear_transportista(client)
    for campo in ("destino", "nombre_huesped", "numero_habitacion"):
        r = await client.post("/traslados", json=_payload(agencia_id, **{campo: "  "}), headers=_headers())
        assert r.status_code == 422, f"{campo} vacío debería rechazarse"

    r = await client.post("/traslados", json=_payload(agencia_id, hora="25:00"), headers=_headers())
    assert r.status_code == 422


async def test_las_dos_listas_de_proveedores_no_se_mezclan(client):
    """Una agencia de tours no puede hacer un traslado, ni al revés."""
    r = await client.post("/traslados", json=_payload(agencia_id=1), headers=_headers())
    assert r.status_code == 422, r.text
    assert "no es un proveedor de transporte" in r.json()["detail"]

    transportista_id = await _crear_transportista(client)
    r = await client.post(
        "/ventas",
        json={
            "tour_id": 1, "vendedor_id": 1, "agencia_id": transportista_id, "forma_pago_id": 1,
            "moneda": "PEN", "monto": 100, "costo": 60, "fecha": "2026-07-04",
        },
        headers=_headers(),
    )
    assert r.status_code == 422, r.text
    assert "no es una agencia de tours" in r.json()["detail"]


async def test_saldo_transportista_acumula_costo_y_se_cancela_con_pago(client):
    agencia_id = await _crear_transportista(client)
    await client.post("/traslados", json=_payload(agencia_id), headers=_headers())

    r = await client.get(f"/agencias/{agencia_id}/saldo", headers=_headers())
    assert r.json()["PEN"] == 60.0, "al transportista se le debe el costo del servicio"

    r = await client.post(
        "/agencia-pagos",
        json={"agencia_id": agencia_id, "fecha": "2026-07-10", "monto": 60, "moneda": "PEN", "metodo": "deposito"},
        headers=_headers(),
    )
    assert r.status_code == 201, r.text

    assert (await client.get(f"/agencias/{agencia_id}/saldo", headers=_headers())).json()["PEN"] == 0.0
    # El pago cancela el pasivo de transporte (203), no el de agencias de tours (202).
    saldos = await _saldos(client)
    assert saldos["203-TRANSPORTE-POR-PAGAR-PEN"] == 0.0
    assert saldos.get("202-AGENCIAS-POR-PAGAR-PEN", 0) == 0


async def test_traslados_no_entran_en_liquidaciones(client):
    """No comisionan al vendedor, así que la liquidación sólo debe tomar tours."""
    agencia_id = await _crear_transportista(client)
    r_traslado = await client.post("/traslados", json=_payload(agencia_id), headers=_headers())
    traslado_ts_id = r_traslado.json()["tour_servicio_id"]
    r_tour = await client.post(
        "/ventas",
        json={
            "tour_id": 1, "vendedor_id": 1, "agencia_id": 1, "forma_pago_id": 1,
            "moneda": "PEN", "monto": 200, "costo": 120, "fecha": "2026-07-05",
        },
        headers=_headers(),
    )
    tour_ts_id = r_tour.json()["tour_servicio_id"]

    # D-35 — selección manual: mandar el id del traslado se rechaza explícitamente.
    r_rechazado = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31", "tour_servicio_ids": [traslado_ts_id]},
        headers=_headers(),
    )
    assert r_rechazado.status_code == 422, r_rechazado.text

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31", "tour_servicio_ids": [tour_ts_id]},
        headers=_headers(),
    )
    assert r.status_code == 201, r.text
    liq_id = r.json()["id"]

    ventas = (await client.get("/ventas", headers=_headers())).json()
    por_tipo = {v["tipo_servicio"]: v for v in ventas}
    assert por_tipo["tour"]["liquidacion_id"] == liq_id
    assert por_tipo["traslado"]["liquidacion_id"] is None, "el traslado no debe quedar bloqueado por la liquidación"


async def test_editar_traslado_reajusta_su_asiento(client):
    """Subir el precio reescribe el asiento sobre las cuentas de traslados."""
    agencia_id = await _crear_transportista(client)
    r = await client.post("/traslados", json=_payload(agencia_id), headers=_headers())
    ts_id = r.json()["tour_servicio_id"]

    r = await client.put(f"/tours_servicios/{ts_id}", json={"monto": 150}, headers=_headers())
    assert r.status_code == 200, r.text

    saldos = await _saldos(client)
    assert saldos["101-CAJA-PEN"] == 150.0
    assert saldos["401-INGRESOS-TRASLADOS-PEN"] == -150.0
    assert saldos["203-TRANSPORTE-POR-PAGAR-PEN"] == -60.0  # el costo no cambió


async def test_eliminar_traslado_revierte_todo_el_asiento(client):
    agencia_id = await _crear_transportista(client)
    r = await client.post("/traslados", json=_payload(agencia_id), headers=_headers())
    ts_id = r.json()["tour_servicio_id"]

    assert (await client.delete(f"/tours_servicios/{ts_id}", headers=_headers())).status_code == 200

    saldos = await _saldos(client)
    for codigo in (
        "101-CAJA-PEN", "401-INGRESOS-TRASLADOS-PEN",
        "501-COSTOS-TRASLADOS-PEN", "203-TRANSPORTE-POR-PAGAR-PEN",
    ):
        assert saldos.get(codigo, 0) == 0.0, f"{codigo} debería quedar en cero tras la reversión"


async def test_vendedor_no_registra_traslado_de_otro(client):
    agencia_id = await _crear_transportista(client)
    token = jwt.encode(
        {
            "sub": "9", "email": "v@x.pe", "role": "vendedor", "vendedor_id": 99,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        },
        settings.NEXTAUTH_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    r = await client.post(
        "/traslados", json=_payload(agencia_id, vendedor_id=1), headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403
