"""apps/tours/api/app/services/liquidaciones.py — RED-phase stub.

Implementado en el commit GREEN subsiguiente.
"""
class LiquidacionPrecheckError(Exception):
    """Raised when close pre-checks fail — caller maps to HTTP 422 with `fails` list."""

    def __init__(self, fails: list[dict]) -> None:
        self.fails = fails or []
        super().__init__("No se puede cerrar la liquidación: faltan datos")


async def close_liquidacion(session, liquidacion_id: int, current_user: dict) -> "Liquidaciones":  # noqa: F821
    raise NotImplementedError("close_liquidacion — RED-phase stub")


async def reopen_liquidacion(session, liquidacion_id: int, current_user: dict) -> "Liquidaciones":  # noqa: F821
    raise NotImplementedError("reopen_liquidacion — RED-phase stub")


async def get_precheck(session, liquidacion_id: int) -> dict:
    raise NotImplementedError("get_precheck — RED-phase stub")