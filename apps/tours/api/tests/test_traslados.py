"""apps/tours/api/tests/test_traslados.py

D-34 — traslados como segunda línea de negocio sobre la misma tabla de ventas:
- POST /traslados postea el asiento de 6 líneas (caja/ingreso, costo/proveedor,
  comisión/hotel) y guarda los campos operativos.
- La comisión del hotel es derivada (monto - costo), no un dato del body.
- El hotel acumula deuda y se cancela contra 203-HOTELES-POR-PAGAR.
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


async def _crear_hotel(client, nombre: str = "Hotel Plaza") -> int:
    r = await client.post(
        "/catalogos/agencias",
        json={"codigo": f"HT-{nombre[:6].upper().replace(' ', '')}", "nombre": nombre, "tipo": "hotel"},
        headers=_headers(),
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _payload(hotel_id: int, **over) -> dict:
    base = {
        "vendedor_id": 1,
        "agencia_id": 1,
        "hotel_id": hotel_id,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": 100,
        "costo": 60,
        "fecha": "2026-07-04",
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
    """Caja/ingreso por el precio, costo/proveedor, y el margen acreditado al hotel."""
    hotel_id = await _crear_hotel(client)
    r = await client.post("/traslados", json=_payload(hotel_id), headers=_headers())
    assert r.status_code == 201, r.text

    saldos = await _saldos(client)
    assert saldos["101-CAJA-PEN"] == 100.0
    assert saldos["401-INGRESOS-TRASLADOS-PEN"] == -100.0  # ingreso: saldo acreedor
    assert saldos["501-COSTOS-TRASLADOS-PEN"] == 60.0
    assert saldos["202-AGENCIAS-POR-PAGAR-PEN"] == -60.0
    # La comisión del hotel es el margen: 100 - 60.
    assert saldos["502-COMISION-HOTEL-PEN"] == 40.0
    assert saldos["203-HOTELES-POR-PAGAR-PEN"] == -40.0

    # No toca las cuentas de tours — cada línea de negocio queda separada.
    assert saldos.get("401-INGRESOS-TOURS-PEN", 0) == 0


async def test_traslado_guarda_campos_operativos(client):
    hotel_id = await _crear_hotel(client)
    await client.post("/traslados", json=_payload(hotel_id), headers=_headers())

    row = (await client.get("/ventas", headers=_headers())).json()[0]
    assert row["tipo_servicio"] == "traslado"
    assert row["destino"] == "Aeropuerto"
    assert row["nombre_huesped"] == "Ana Pérez"
    assert row["numero_habitacion"] == "204"
    assert row["hora"] == "08:30"
    assert row["observaciones"] == "Vuelo LA2043"
    assert row["hotel_id"] == hotel_id
    assert row["comision_hotel"] == 40.0


async def test_comision_hotel_es_derivada_no_del_body(client):
    """Aunque el cliente mande comision_hotel, manda el margen real."""
    hotel_id = await _crear_hotel(client)
    r = await client.post(
        "/traslados",
        json=_payload(hotel_id, monto=150, costo=50, comision_hotel=999),
        headers=_headers(),
    )
    assert r.status_code == 201, r.text
    row = (await client.get("/ventas", headers=_headers())).json()[0]
    assert row["comision_hotel"] == 100.0


async def test_traslado_rechaza_costo_mayor_al_precio(client):
    hotel_id = await _crear_hotel(client)
    r = await client.post("/traslados", json=_payload(hotel_id, monto=50, costo=80), headers=_headers())
    assert r.status_code == 422, r.text
    assert "no puede superar" in r.json()["detail"]


async def test_traslado_exige_campos_operativos(client):
    hotel_id = await _crear_hotel(client)
    for campo in ("destino", "nombre_huesped", "numero_habitacion"):
        r = await client.post("/traslados", json=_payload(hotel_id, **{campo: "  "}), headers=_headers())
        assert r.status_code == 422, f"{campo} vacío debería rechazarse"

    r = await client.post("/traslados", json=_payload(hotel_id, hora="25:00"), headers=_headers())
    assert r.status_code == 422


async def test_traslado_exige_que_el_hotel_sea_hotel(client):
    """Apuntar hotel_id a una agencia proveedora es un error de carga, no un traslado válido."""
    r = await client.post("/traslados", json=_payload(hotel_id=1), headers=_headers())
    assert r.status_code == 422, r.text
    assert "no está registrada como hotel" in r.json()["detail"]


async def test_saldo_hotel_acumula_comision_y_se_cancela_con_pago(client):
    hotel_id = await _crear_hotel(client)
    await client.post("/traslados", json=_payload(hotel_id), headers=_headers())

    r = await client.get(f"/agencias/{hotel_id}/saldo", headers=_headers())
    assert r.json()["PEN"] == 40.0, "el hotel acumula la comisión, no el costo del proveedor"

    r = await client.post(
        "/agencia-pagos",
        json={"agencia_id": hotel_id, "fecha": "2026-07-10", "monto": 40, "moneda": "PEN", "metodo": "deposito"},
        headers=_headers(),
    )
    assert r.status_code == 201, r.text

    assert (await client.get(f"/agencias/{hotel_id}/saldo", headers=_headers())).json()["PEN"] == 0.0
    # El pago cancela el pasivo de comisiones (203), no el de costos (202).
    saldos = await _saldos(client)
    assert saldos["203-HOTELES-POR-PAGAR-PEN"] == 0.0
    assert saldos["202-AGENCIAS-POR-PAGAR-PEN"] == -60.0


async def test_traslados_no_entran_en_liquidaciones(client):
    """No comisionan al vendedor, así que la liquidación sólo debe tomar tours."""
    hotel_id = await _crear_hotel(client)
    await client.post("/traslados", json=_payload(hotel_id), headers=_headers())
    await client.post(
        "/ventas",
        json={
            "tour_id": 1, "vendedor_id": 1, "agencia_id": 1, "forma_pago_id": 1,
            "moneda": "PEN", "monto": 200, "costo": 120, "fecha": "2026-07-05",
        },
        headers=_headers(),
    )

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers=_headers(),
    )
    liq_id = r.json()["id"]

    ventas = (await client.get("/ventas", headers=_headers())).json()
    por_tipo = {v["tipo_servicio"]: v for v in ventas}
    assert por_tipo["tour"]["liquidacion_id"] == liq_id
    assert por_tipo["traslado"]["liquidacion_id"] is None, "el traslado no debe quedar bloqueado por la liquidación"


async def test_editar_traslado_reajusta_comision_y_asiento(client):
    """Subir el precio sube el margen, y con él lo que se le debe al hotel."""
    hotel_id = await _crear_hotel(client)
    r = await client.post("/traslados", json=_payload(hotel_id), headers=_headers())
    ts_id = r.json()["tour_servicio_id"]

    r = await client.put(f"/tours_servicios/{ts_id}", json={"monto": 150}, headers=_headers())
    assert r.status_code == 200, r.text

    row = (await client.get("/ventas", headers=_headers())).json()[0]
    assert row["comision_hotel"] == 90.0  # 150 - 60

    saldos = await _saldos(client)
    assert saldos["101-CAJA-PEN"] == 150.0
    assert saldos["203-HOTELES-POR-PAGAR-PEN"] == -90.0
    assert (await client.get(f"/agencias/{hotel_id}/saldo", headers=_headers())).json()["PEN"] == 90.0


async def test_eliminar_traslado_revierte_todo_el_asiento(client):
    hotel_id = await _crear_hotel(client)
    r = await client.post("/traslados", json=_payload(hotel_id), headers=_headers())
    ts_id = r.json()["tour_servicio_id"]

    assert (await client.delete(f"/tours_servicios/{ts_id}", headers=_headers())).status_code == 200

    saldos = await _saldos(client)
    for codigo in (
        "101-CAJA-PEN", "401-INGRESOS-TRASLADOS-PEN", "501-COSTOS-TRASLADOS-PEN",
        "202-AGENCIAS-POR-PAGAR-PEN", "502-COMISION-HOTEL-PEN", "203-HOTELES-POR-PAGAR-PEN",
    ):
        assert saldos.get(codigo, 0) == 0.0, f"{codigo} debería quedar en cero tras la reversión"


async def test_vendedor_no_registra_traslado_de_otro(client):
    hotel_id = await _crear_hotel(client)
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
        "/traslados", json=_payload(hotel_id, vendedor_id=1), headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403
