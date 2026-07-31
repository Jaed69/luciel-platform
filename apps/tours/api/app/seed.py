"""apps/tours/api/app/seed.py

Idempotent seed: chart of cuentas (9 entries per D-05/D-07/D-12), 1 admin user,
ComisionRegla default global 50/50 (D-10, non-deletable), and one row each of
agencias/vendedores/tours_catalogo/formas_pago/monedas for e2e /ventas.
"""
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.core import Cuentas, Rol, Usuarios
from app.models.tours import (
    Agencias,
    ComisionReglas,
    FormasPago,
    Monedas,
    ToursCatalogo,
    Vendedores,
)


AGENCIAS = [
    ("AG-CUSCOTOP", "Cusco Top"),
    ("AG-ANDEAN", "Andean"),
    ("AG-GUTY", "Guty"),
]

TIPOS_TOUR = [
    ("T-7LAGUNAS", "7 Lagunas"),
    ("T-CTMANANA", "City Tour / T. Mañana"),
    ("T-CTTARDE", "City Tour / T. Tarde"),
    ("T-HUMANTAY", "Laguna Humantay"),
    ("T-VSVIP", "Valle Sagrado VIP"),
    ("T-VSTRAD", "Valle Sagrado Tradicional"),
    ("T-MOTOCROSS", "Motocross"),
    ("T-VSUR", "Valle Sur"),
    ("T-MACHUPICCHU", "Machu Picchu"),
]

# D-34 — fila de catálogo genérica que respalda a todos los traslados.
# tours_servicios.tour_id es NOT NULL con FK a tours_catalogo, y el destino de
# un traslado es texto libre (no un catálogo tarifado), así que todos apuntan
# acá. Se excluye de los listados de tipos de tour por este código.
CODIGO_CATALOGO_TRASLADO = "SRV-TRASLADO"
CATALOGO_TRASLADO = (CODIGO_CATALOGO_TRASLADO, "Traslado")

CHART = [
    ("101-CAJA-PEN", "Caja (PEN)", "activo", "PEN"),
    ("101-CAJA-USD", "Caja (USD)", "activo", "USD"),
    ("201-COMISIONES-POR-PAGAR", "Comisiones por pagar", "pasivo", "PEN"),
    ("202-AGENCIAS-POR-PAGAR-PEN", "Agencias por pagar (PEN)", "pasivo", "PEN"),
    ("202-AGENCIAS-POR-PAGAR-USD", "Agencias por pagar (USD)", "pasivo", "USD"),
    ("401-INGRESOS-TOURS-PEN", "Ingresos por tours (PEN)", "ingreso", "PEN"),
    ("401-INGRESOS-TOURS-USD", "Ingresos por tours (USD)", "ingreso", "USD"),
    ("501-COSTOS-TOURS-PEN", "Costos de tours (PEN)", "costo", "PEN"),
    ("501-COSTOS-TOURS-USD", "Costos de tours (USD)", "costo", "USD"),
    ("501-COSTOS-COMISIONES", "Costos por comisiones", "costo", "PEN"),
    ("672-GAN-PERD-TC", "Ganancia/Pérdida por tipo de cambio", "gasto", "PEN"),
    # D-34 — traslados. Ingreso y costo van en cuentas propias (no reusan las de
    # tours) para poder leer la rentabilidad de cada línea de negocio por
    # separado en el dashboard.
    ("203-HOTELES-POR-PAGAR-PEN", "Hoteles por pagar (PEN)", "pasivo", "PEN"),
    ("203-HOTELES-POR-PAGAR-USD", "Hoteles por pagar (USD)", "pasivo", "USD"),
    ("401-INGRESOS-TRASLADOS-PEN", "Ingresos por traslados (PEN)", "ingreso", "PEN"),
    ("401-INGRESOS-TRASLADOS-USD", "Ingresos por traslados (USD)", "ingreso", "USD"),
    ("501-COSTOS-TRASLADOS-PEN", "Costos de traslados (PEN)", "costo", "PEN"),
    ("501-COSTOS-TRASLADOS-USD", "Costos de traslados (USD)", "costo", "USD"),
    ("502-COMISION-HOTEL-PEN", "Comisión a hoteles (PEN)", "costo", "PEN"),
    ("502-COMISION-HOTEL-USD", "Comisión a hoteles (USD)", "costo", "USD"),
]


async def run_if_empty(session: AsyncSession) -> None:
    """Seed chart of accounts + admin + default comision + catalog rows if DB is empty."""
    existing = (await session.execute(select(Cuentas).limit(1))).scalar_one_or_none()
    if existing is not None:
        return  # Already seeded

    for codigo, nombre, tipo, moneda in CHART:
        session.add(Cuentas(codigo=codigo, nombre=nombre, tipo=tipo, moneda=moneda))

    # Admin user — bcrypt cost 12 (T-02.1-01). Password from env, default dev-only.
    password_hash = bcrypt.hashpw(settings.ADMIN_INITIAL_PASSWORD.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_COST)).decode()
    session.add(Usuarios(
        email="admin@tours.luciel.dev",
        username="admin",
        password_hash=password_hash,
        rol=Rol.admin,
    ))

    # Default global comision rule (D-10 — non-deletable).
    session.add(ComisionReglas(vendedor_id=None, tour_id=None, porcentaje=50, descripcion="Default global 50/50"))

    # Catalog seeds so /ventas can run e2e.
    for codigo, nombre in AGENCIAS:
        session.add(Agencias(codigo=codigo, nombre=nombre))
    session.add(Vendedores(codigo="V-001", nombre="Vendedor demo"))
    for codigo, nombre in TIPOS_TOUR:
        session.add(ToursCatalogo(codigo=codigo, nombre=nombre))
    session.add(ToursCatalogo(codigo=CATALOGO_TRASLADO[0], nombre=CATALOGO_TRASLADO[1]))
    session.add(FormasPago(nombre="Efectivo"))
    session.add(Monedas(codigo="PEN", nombre="Sol peruano", simbolo="S/"))
    session.add(Monedas(codigo="USD", nombre="Dólar estadounidense", simbolo="$"))

    await session.flush()