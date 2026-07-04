"""apps/tours/api/app/dependencies.py

FastAPI dependencies: async session, JWT-based current user, RBAC role guard.
JWT is signed by NextAuth (tours-web) with the shared NEXTAUTH_SECRET and
verified here with pyjwt (D-02, Pitfall 4). On success the dependency sets
`audit.current_user_id` so the before_flush listener can attribute the row (D-23).
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import current_user_id
from app.config import settings
from app.database import get_session

_security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Decode the NextAuth-issued JWT and return user dict. Sets audit ContextVar."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.NEXTAUTH_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user_id_raw = payload.get("sub")
    user_id = int(user_id_raw) if user_id_raw is not None else None
    current_user_id.set(user_id)
    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role"),
        "name": payload.get("name"),
    }


def require_role(*roles: str):
    """Dependency factory — 403 if the authenticated user's role is not in `roles`."""
    async def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rol insuficiente")
        return user
    return _checker