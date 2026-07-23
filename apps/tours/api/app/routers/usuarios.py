"""apps/tours/api/app/routers/usuarios.py

Phase 02.1.1-01 — Full /usuarios CRUD + 2 password endpoints.

RBAC: admin-only for list/create/edit/delete (D-15). /me/password is any-authed
(D-08). /{id}/password is admin-only (password reset by admin).

Guards:
- D-11: last-admin protection — cannot demote or soft-delete the only active admin.
- D-12: self-delete protection — admin cannot DELETE their own account.
- D-10: email unique — POST with duplicate email returns 409.
- D-26: password_hash never appears in any response or audit snapshot.
"""
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.core import Rol, Usuarios
from app.schemas.core import (
    AdminPasswordResetIn,
    PasswordChangeIn,
    UsuarioCreateIn,
    UsuarioOut,
    UsuarioUpdateIn,
)

router = APIRouter(tags=["usuarios"])


async def _assert_admin_remaining(session: AsyncSession, exclude_user_id: int) -> None:
    """D-11 — refuse operations that would leave zero active admins."""
    count = (await session.execute(
        select(Usuarios).where(Usuarios.rol == Rol.admin, Usuarios.activo.is_(True), Usuarios.id != exclude_user_id)
    )).scalars().all()
    if len(count) == 0:
        raise HTTPException(status_code=409, detail="No se puede — quedaría sin administradores activos")


@router.get("/usuarios", response_model=list[UsuarioOut])
async def list_usuarios(
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> list[Usuarios]:
    return list((await session.execute(select(Usuarios).order_by(Usuarios.id))).scalars().all())


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
async def create_usuario(
    body: UsuarioCreateIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> Usuarios:
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_COST)).decode()
    user = Usuarios(
        email=body.email,
        username=body.username,
        password_hash=password_hash,
        rol=body.rol,
        activo=True,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # SQLite UNIQUE violation message includes the column name.
        if "usuarios.email" in str(exc.orig):
            raise HTTPException(status_code=409, detail="Email ya registrado")
        if "usuarios.username" in str(exc.orig):
            raise HTTPException(status_code=409, detail="Usuario ya registrado")
        raise
    await session.refresh(user)
    return user


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
async def update_usuario(
    usuario_id: int,
    body: UsuarioUpdateIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> Usuarios:
    user = (await session.execute(select(Usuarios).where(Usuarios.id == usuario_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # D-11 — last-admin guard on role demotion.
    if body.rol is not None and body.rol != Rol.admin and user.rol == Rol.admin and user.activo:
        await _assert_admin_remaining(session, exclude_user_id=usuario_id)
    if body.email is not None:
        user.email = body.email
    if body.username is not None:
        user.username = body.username
    if body.rol is not None:
        user.rol = body.rol
    if body.activo is not None:
        user.activo = body.activo
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "usuarios.email" in str(exc.orig) or "email" in str(exc.orig):
            raise HTTPException(status_code=409, detail="Email ya registrado")
        raise
    await session.refresh(user)
    return user


@router.delete("/usuarios/{usuario_id}")
async def delete_usuario(
    usuario_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(require_role("admin")),
) -> dict:
    target = (await session.execute(select(Usuarios).where(Usuarios.id == usuario_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # D-12 — self-delete guard.
    if usuario_id == int(user["id"]):
        raise HTTPException(status_code=409, detail="No puede eliminar su propia cuenta")
    # D-11 — last-admin guard.
    if target.rol == Rol.admin and target.activo:
        await _assert_admin_remaining(session, exclude_user_id=usuario_id)
    target.activo = False  # soft delete
    await session.commit()
    return {"ok": True}


@router.put("/usuarios/me/password")
async def change_my_password(
    body: PasswordChangeIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
) -> dict:
    """D-08 — any authed user can change their own password (current required)."""
    me = (await session.execute(select(Usuarios).where(Usuarios.id == int(user["id"])))).scalar_one_or_none()
    if me is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not bcrypt.checkpw(body.current_password.encode(), me.password_hash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contraseña actual incorrecta")
    me.password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_COST)).decode()
    await session.commit()
    return {"ok": True}


@router.put("/usuarios/{usuario_id}/password")
async def admin_reset_password(
    usuario_id: int,
    body: AdminPasswordResetIn,
    session: AsyncSession = Depends(get_session),
    _user: dict = Depends(require_role("admin")),
) -> dict:
    """Admin-only password reset — no current_password required."""
    target = (await session.execute(select(Usuarios).where(Usuarios.id == usuario_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    target.password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_COST)).decode()
    await session.commit()
    return {"ok": True}