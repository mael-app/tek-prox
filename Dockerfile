# syntax=docker/dockerfile:1

# ─── Stage 1: All deps (dev + prod) with native build tools ─────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production deps only (prisma CLI + runtime, no TS/tailwind/…) ─
FROM node:22-slim AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 4: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Next.js standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Production node_modules (overrides standalone subset; brings prisma CLI + all its deps)
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Generated Prisma client from builder (prod-deps doesn't run prisma generate)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Schema + migrations for `prisma migrate deploy` at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma           ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Persistent volume for the SQLite database
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
