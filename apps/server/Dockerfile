# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# Prisma generate reads prisma.config.ts. A dummy direct URL is enough for client generation.
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
RUN pnpm --filter @skerp/server db:generate
RUN pnpm --filter @skerp/server... build
RUN cp -R apps/server/generated apps/server/dist/generated

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=5000
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

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
