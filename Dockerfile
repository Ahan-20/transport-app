# syntax=docker/dockerfile:1.7
#
# Multi-stage build for a Next.js + better-sqlite3 app on Railway.
#   1) deps    — install dev+prod deps with build tools (native modules)
#   2) builder — run `next build` to produce .next/standalone
#   3) runner  — minimal runtime image with only what's needed to serve
#
# The "standalone" output (set in next.config.ts) gives us a self-contained
# server.js plus a pruned node_modules — so the runner stage is small and
# cold starts on Railway are fast.

# ────────────────────────────────────────────────────────────────────────────
# Stage 1: deps
#   Installs all dependencies on a node:alpine base. python3/make/g++ are
#   needed because better-sqlite3 will fall back to compiling from source if
#   no prebuilt binary matches the runtime libc.
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# Copy only manifests first so this layer caches between code changes.
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ────────────────────────────────────────────────────────────────────────────
# Stage 2: builder
#   Compiles the Next.js app for production. The standalone output is what
#   actually ships — the rest of node_modules is discarded at the next stage.
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ────────────────────────────────────────────────────────────────────────────
# Stage 3: runner (the image Railway actually runs)
#   Only the standalone bundle, static assets, public/, and migrations are
#   needed at runtime. Native modules (better-sqlite3) are already in the
#   standalone bundle's node_modules thanks to Next.js's file tracing.
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# tini  = minimal init (~10KB), propagates SIGTERM correctly so SQLite has a
#         chance to checkpoint the WAL before the container is killed.
# libc6-compat = required by better-sqlite3's prebuilt linux-musl binary.
# su-exec = drops root → nextjs without the overhead of a full su shell, so
#           tini stays PID 1 and signal handling still works.
RUN apk add --no-cache tini libc6-compat su-exec \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone bundle (server.js + pruned node_modules) at the root.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public/ aren't included in the standalone output.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrations are read at runtime by src/lib/db.ts on first boot.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

# Entrypoint chowns the Railway-mounted data volume to nextjs before dropping
# privileges. Don't set USER here — the entrypoint runs as root briefly,
# then su-exec switches to nextjs for the actual node process.
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
