"""usuarios.username unique constraint — allow login by username or email

Revision ID: 002
Revises: 001
Create Date: 2026-07-23

`create_all` on startup does not alter existing tables, so this is an
explicit migration (see apps/tours/CLAUDE.md — Schema/migrations). Fails
loudly with an IntegrityError if duplicate usernames already exist in the
target database; no automatic dedup/backfill is applied.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.create_unique_constraint("uq_usuarios_username", ["username"])


def downgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.drop_constraint("uq_usuarios_username", type_="unique")
