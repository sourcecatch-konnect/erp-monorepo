# syntax=docker/dockerfile:1

# Production image for @skerp/web (Next.js standalone output), built around
# `turbo prune` — see apps/server/Dockerfile for the stage-by-stage rationale.

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true

RUN corepack enable \
  && corepack prepare pnpm@9.0.0 --activate \
  && echo "store-dir=/pnpm/store" > /root/.npmrc

WORKDIR /app

# ---------------------------------------------------------------- pruner ----
FROM base AS pruner

RUN npm install -g "turbo@^2" --no-audit --no-fund

COPY . .

RUN turbo prune @skerp/web --docker \
  && { [ -f out/pnpm-lock.yaml ] && cp out/pnpm-lock.yaml out/json/pnpm-lock.yaml; true; }

# --------------------------------------------------------------- builder ----
FROM base AS builder

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pruner /app/out/full/ .

# NEXT_PUBLIC_* values are baked into the client bundle at build time.
# Defaults route everything through the Caddy reverse proxy on the site
# origin: axios hits /api/* (stripped to the server), socket.io connects to
# the origin's /socket.io (proxied with websocket upgrade).
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SOCKET_URL=/
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID \
    NEXT_OUTPUT=standalone \
    TURBO_CACHE_DIR=/turbo-cache

RUN --mount=type=cache,id=turbo-cache,target=/turbo-cache \
    pnpm turbo run build --filter=@skerp/web...

# ---------------------------------------------------------------- runner ----
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Standalone output contains a pruned node_modules + server.js; static assets
# and public/ are served by the same server but not traced, so copy them in.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3001

CMD ["node", "apps/web/server.js"]
