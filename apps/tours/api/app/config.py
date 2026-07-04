"""apps/tours/api/app/config.py

Pydantic BaseSettings for tours-api. Read from .env or environment.
Shared NEXTAUTH_SECRET with tours-web (D-02) — JWTs signed there are verified here.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    NEXTAUTH_SECRET: str = "dev-only-change-me"
    NEXTAUTH_URL: str = "http://tours.luciel.dev"
    # Path interno del contenedor tours-api (named Docker volume tours-db-data:/data).
    DATABASE_URL: str = "sqlite+aiosqlite:////data/tours.db"
    JWT_ALGORITHM: str = "HS256"
    BCRYPT_COST: int = 12
    ADMIN_INITIAL_PASSWORD: str = "change-me"
    TOURS_API_URL: str = "http://tours-api:8000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()