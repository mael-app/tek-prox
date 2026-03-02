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

# Agent runs as root on purpose — needs pct/pvesh access on the Proxmox host
# when using --pid=host or exec'd directly; keep non-root if running in a VM.
RUN groupadd --system --gid 1001 agent \
 && useradd  --system --uid 1001 --gid agent agent

COPY --from=builder /install /usr/local
COPY agent.py .

USER agent

EXPOSE 8765

CMD ["gunicorn", "--bind", "0.0.0.0:8765", "--workers", "2", "--timeout", "60", "--access-logfile", "-", "agent:app"]
