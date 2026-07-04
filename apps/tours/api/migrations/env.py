"""Alembic migrations environment for tours-api.

sqlalchemy.url is loaded from DATABASE_URL env (overrides alembic.ini empty value).
target_metadata = Base.metadata from app.models (Task 2 lands app.models + Base).
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# this = the migrations/ directory
config = context.config

# Override sqlalchemy.url from DATABASE_URL env (D-03 — set in tours-api container env).
db_url = os.environ.get("DATABASE_URL", "")
if db_url:
    # Alembic sync engine needs a sync URL — convert aiosqlite -> sqlite.
    sync_url = db_url.replace("sqlite+aiosqlite://", "sqlite://")
    config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata — Task 2 will populate app.models.Base.metadata.
try:
    from app.models import Base  # noqa: WPS433 (lazy for Task 1 compat)
    target_metadata = Base.metadata
except Exception:
    target_metadata = None


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite — batch mode for ALTER support
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()