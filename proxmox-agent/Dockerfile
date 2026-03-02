# syntax=docker/dockerfile:1

# ─── Stage 1: install dependencies ──────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# nsenter (from util-linux) is needed to escape the container's mount
# namespace and reach the host's pct binary when running in Docker.
RUN apt-get update && apt-get install -y --no-install-recommends \
      util-linux \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY agent.py .

# Baked-in at build time: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD)
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT

EXPOSE 8765

CMD ["gunicorn", "--bind", "0.0.0.0:8765", "--workers", "2", "--timeout", "60", "--access-logfile", "-", "agent:app"]
