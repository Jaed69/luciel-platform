"""apps/tours/api/app/routers/auth.py

POST /auth/login — NextAuth Credentials provider calls this endpoint.
Only verifies password with bcrypt; NextAuth issues the JWT with the shared
NEXTAUTH_SECRET on the tours-web side (D-02).
"""
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import current_user_id
from app.database import get_session
from app.models.core import Usuarios
from app.schemas.core import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)) -> LoginResponse:
    user = (await session.execute(select(Usuarios).where(Usuarios.email == body.email))).scalar_one_or_none()
    if user is None or not user.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    # Set audit ContextVar so any further work in this request is attributed.
    current_user_id.set(user.id)
    return LoginResponse(id=user.id, email=user.email, username=user.username, role=user.rol.value)