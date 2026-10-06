# apps/tours/api/Dockerfile
# Self-contained build context = apps/tours/api/ (simplifies CI matrix per Plan 02).
# python:3.14.7-slim + uv install + uvicorn CMD.
FROM python:3.14.7-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
# Install the exact versions pinned in uv.lock (hash-verified), so the image runs what
# the tests ran. BuildKit cache mount keeps wheels between builds (never in the image).
RUN --mount=type=cache,id=uv,target=/root/.cache/uv \
    uv export --frozen --no-dev --no-emit-project -o /tmp/requirements.txt \
    && uv pip install --system -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt
COPY app/ app/
COPY migrations/ migrations/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"