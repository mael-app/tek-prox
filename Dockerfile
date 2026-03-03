# syntax=docker/dockerfile:1

# ─── Stage 1: All deps (dev + prod) with native build tools ─────────────────
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Make the commit hash available to next.config.ts at build time
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production deps only (prisma CLI + runtime, no TS/tailwind/…) ─
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 4: Runtime ────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# Baked-in at build time: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD)
ARG GIT_COMMIT=unknown
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_COMMIT=$GIT_COMMIT

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

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

# Compiled scripts for CLI commands
COPY --from=builder --chown=nextjs:nodejs /app/scripts          ./scripts

# Persistent volume for the SQLite database
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs docker-cli-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh docker-cli-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
