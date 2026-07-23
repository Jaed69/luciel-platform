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

CHART = [
    ("101-CAJA-PEN", "Caja (PEN)", "activo", "PEN"),
    ("101-CAJA-USD", "Caja (USD)", "activo", "USD"),
    ("201-COMISIONES-POR-PAGAR", "Comisiones por pagar", "pasivo", "PEN"),
    ("401-INGRESOS-TOURS-PEN", "Ingresos por tours (PEN)", "ingreso", "PEN"),
    ("401-INGRESOS-TOURS-USD", "Ingresos por tours (USD)", "ingreso", "USD"),
    ("501-COSTOS-TOURS-PEN", "Costos de tours (PEN)", "costo", "PEN"),
    ("501-COSTOS-TOURS-USD", "Costos de tours (USD)", "costo", "USD"),
    ("501-COSTOS-COMISIONES", "Costos por comisiones", "costo", "PEN"),
    ("672-GAN-PERD-TC", "Ganancia/Pérdida por tipo de cambio", "gasto", "PEN"),
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
    session.add(Agencias(codigo="AG-001", nombre="Agencia demo"))
    session.add(Vendedores(codigo="V-001", nombre="Vendedor demo"))
    for codigo, nombre in TIPOS_TOUR:
        session.add(ToursCatalogo(codigo=codigo, nombre=nombre))
    session.add(FormasPago(nombre="Efectivo"))
    session.add(Monedas(codigo="PEN", nombre="Sol peruano", simbolo="S/"))
    session.add(Monedas(codigo="USD", nombre="Dólar estadounidense", simbolo="$"))

    await session.flush()