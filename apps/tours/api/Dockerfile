# apps/tours/api/Dockerfile
# Self-contained build context = apps/tours/api/ (simplifies CI matrix per Plan 02).
# python:3.13-slim + uv install + uvicorn CMD.
FROM python:3.13-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir uv
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .
COPY app/ app/
COPY migrations/ migrations/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"