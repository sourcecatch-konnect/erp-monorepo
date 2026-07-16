# syntax=docker/dockerfile:1

# Production image for @skerp/server, built around `turbo prune` so Docker
# layer caching survives source-only changes:
#
#   pruner    → out/json (manifests only) + out/full (source) for the server subtree
#   builder   → pnpm install (store cache mount) + prisma generate + turbo build (turbo cache mount)
#   prod-deps → production-only node_modules from the same pruned manifests
#   runner    → slim runtime with distro Chromium for puppeteer PDF generation
#   migrator  → tiny standalone image that runs `prisma migrate deploy`

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PUPPETEER_SKIP_DOWNLOAD=true \
    TURBO_TELEMETRY_DISABLED=1 \
    CI=true

RUN corepack enable \
  && corepack prepare pnpm@9.0.0 --activate \
  && echo "store-dir=/pnpm/store" > /root/.npmrc

WORKDIR /app

# ---------------------------------------------------------------- pruner ----
FROM base AS pruner

RUN npm install -g "turbo@^2" --no-audit --no-fund

COPY . .

# Older turbo versions emit the pruned lockfile at out/pnpm-lock.yaml instead
# of inside out/json — normalise so the builder only needs out/json.
RUN turbo prune @skerp/server --docker \
  && { [ -f out/pnpm-lock.yaml ] && cp out/pnpm-lock.yaml out/json/pnpm-lock.yaml; true; }

# --------------------------------------------------------------- builder ----
FROM base AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Manifests only — this layer and the install below stay cached until a
# package.json or the lockfile actually changes.
COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pruner /app/out/full/ .

# Prisma generate reads prisma.config.ts; a syntactically valid URL suffices.
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
RUN pnpm --filter @skerp/server db:generate

# Turbo's local cache lives on a mount so shared packages (validators, types,
# config) rebuilt for one image are cache hits for the other.
ENV TURBO_CACHE_DIR=/turbo-cache
RUN --mount=type=cache,id=turbo-cache,target=/turbo-cache \
    pnpm turbo run build --filter=@skerp/server...

# Compiled code resolves ../generated relative to dist/src.
RUN cp -R apps/server/generated apps/server/dist/generated

# ------------------------------------------------------------- prod-deps ----
FROM base AS prod-deps

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------- runner ----
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=5000 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    dumb-init \
    fonts-liberation \
    openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps ./apps
COPY --from=prod-deps /app/packages ./packages

COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/generated ./apps/server/generated
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/public ./apps/server/public
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/config/src ./packages/config/src
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validators/dist ./packages/validators/dist

WORKDIR /app/apps/server

EXPOSE 5000

CMD ["dumb-init", "node", "dist/src/index.js"]

# -------------------------------------------------------------- migrator ----
# Standalone `prisma migrate deploy` image — the runner ships prod deps only
# (no prisma CLI), so migrations get their own tiny image that shares nothing
# but the schema. Keep the prisma version in sync with apps/server.
FROM node:22-bookworm-slim AS migrator

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund prisma@7.8.0 dotenv@17

COPY apps/server/prisma.config.ts ./prisma.config.ts
COPY apps/server/prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]
