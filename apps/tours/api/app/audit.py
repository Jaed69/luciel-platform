"""apps/tours/api/app/audit.py

Structural audit log via SQLAlchemy `before_flush` event listener (D-21/D-22/D-23).

- ContextVar `current_user_id` is set by `app.dependencies.get_current_user`.
- `Auditable` mixin marks models for capture; per-model `__sensitive_fields__`
  set is redacted to None before serializing (D-26 — password_hash).
- INSERT → datos_antes=None, datos_despues=snapshot.
- UPDATE → datos_antes via `sqlalchemy.inspect().attrs.*.committed_state` (Pitfall 2
  — NOT instance.__dict__ which holds post-mutación state).
- DELETE → datos_antes=snapshot, datos_despues=None.
- AuditLog itself is NOT auditable (D-22).
"""
import json
from contextvars import ContextVar
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

# Set by get_current_user; read by before_flush listener (D-23).
current_user_id: ContextVar[int | None] = ContextVar("current_user_id", default=None)

# Global sensitive fields — always redacted. Per-model overrides via __sensitive_fields__.
SENSITIVE_FIELDS: set[str] = {"password_hash"}


class Auditable:
    """Mixin marking a model for audit_log capture."""
    __auditable__ = True
    __sensitive_fields__: set[str] = set()


def redact_sensitive(data: dict[str, Any], extra_sensitive: set[str] | None = None) -> dict[str, Any]:
    """Return a copy with sensitive keys set to None (D-26)."""
    sensitive = SENSITIVE_FIELDS | (extra_sensitive or set())
    return {k: (None if k in sensitive else v) for k, v in data.items()}


def _snapshot(instance) -> dict[str, Any]:
    """Capture current column values of an instance as a plain dict.

    Uses mapper.column_attrs (Python attribute names) NOT table.columns (DB names)
    so aliased attributes like `metadata_` (mapped to column `metadata`) resolve correctly.
    """
    state = inspect(instance)
    return {attr.key: getattr(instance, attr.key) for attr in state.mapper.column_attrs}


def _audit_entry(tabla: str, registro_id: int | None, operacion: str,
                 datos_antes: dict | None, datos_despues: dict | None,
                 sensitive: set[str]) -> dict:
    """Build an AuditLog row dict. The caller inserts it (avoids circular import)."""
    from app.models.core import AuditLog  # lazy — models import audit.Auditable
    return AuditLog(
        tabla=tabla,
        registro_id=registro_id,
        operacion=operacion,
        datos_antes=json.dumps(redact_sensitive(datos_antes, sensitive), default=str) if datos_antes is not None else None,
        datos_despues=json.dumps(redact_sensitive(datos_despues, sensitive), default=str) if datos_despues is not None else None,
        usuario_id=current_user_id.get(),
    )


@event.listens_for(Session, "before_flush")
def audit_before_flush(session: Session, flush_context, _instances):
    """Capture INSERT/UPDATE/DELETE for Auditable instances into audit_log."""
    sensitive_global = SENSITIVE_FIELDS

    for instance in session.new:
        if not getattr(instance, "__auditable__", False):
            continue
        datos_despues = _snapshot(instance)
        sensitive = sensitive_global | getattr(instance, "__sensitive_fields__", set())
        session.add(_audit_entry(
            tabla=instance.__table__.name,
            registro_id=datos_despues.get("id"),
            operacion="I",
            datos_antes=None,
            datos_despues=datos_despues,
            sensitive=sensitive,
        ))

    for instance in session.dirty:
        if not getattr(instance, "__auditable__", False):
            continue
        # Pitfall 2: committed_state holds pre-mutación values per attribute.
        state = inspect(instance)
        committed = state.committed_state  # dict: {attr_key: old_value}
        datos_antes: dict[str, Any] = {}
        for attr in state.mapper.column_attrs:
            key = attr.key
            datos_antes[key] = committed.get(key, getattr(instance, key))
        datos_despues = _snapshot(instance)
        sensitive = sensitive_global | getattr(instance, "__sensitive_fields__", set())
        session.add(_audit_entry(
            tabla=instance.__table__.name,
            registro_id=datos_despues.get("id"),
            operacion="U",
            datos_antes=datos_antes,
            datos_despues=datos_despues,
            sensitive=sensitive,
        ))

    for instance in session.deleted:
        if not getattr(instance, "__auditable__", False):
            continue
        datos_antes = _snapshot(instance)
        sensitive = sensitive_global | getattr(instance, "__sensitive_fields__", set())
        session.add(_audit_entry(
            tabla=instance.__table__.name,
            registro_id=datos_antes.get("id"),
            operacion="D",
            datos_antes=datos_antes,
            datos_despues=None,
            sensitive=sensitive,
        ))