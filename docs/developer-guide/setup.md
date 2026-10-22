# Developer setup

> Last checked: 2026-10-09 · Audience: developers

## What you need

| Tool | Version |
|---|---|
| Node.js | 18 or newer (the team uses Node 24) |
| pnpm | 9 (`packageManager: pnpm@9.0.0`) |
| Git | any recent version |
| A PostgreSQL database | the **test** database (Supabase), or Postgres on your PC |
| Redis | needed for notifications (BullMQ). The server still starts without it, but notification jobs fail |

## First time

```
git clone https://github.com/sourcecatch-konnect/erp-monorepo.git
cd erp-monorepo
pnpm install            # also runs "prisma generate" (postinstall)
```

Create the environment files. Ask a team lead for the **test** values, and never use live values on your PC:

| File | Copy from | Main settings |
|---|---|---|
| `apps/server/.env` | `apps/server/.env.example` | `DATABASE_URL`, `DIRECT_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `REDIS_URL`, `PORT=5000`, AWS (S3 attachments, SES email), WhatsApp, OneLap |
| `apps/web/.env` | `apps/web/.env.example` | `NEXT_PUBLIC_API_URL=http://localhost:5000`, Google Maps key |

⚠ Never put real secrets in `.env.example`. Those files are committed to GitHub.

Prepare the database (only when it is new or empty):

```
pnpm db:deploy                                   # apply all migrations
cd apps/server
pnpm exec tsx prisma/seed-admin.ts               # admin user, roles, permissions, chart of accounts
```

`seed-admin` creates the user **admin@sktranslines.com** with a default password, printed at the end of the run. **Change it straight away** on any shared or live database.

## Every day

```
pnpm dev
```

This runs, in order:
1. `prisma generate`
2. builds the shared packages
3. starts the **server** on http://localhost:5000 and the **website** on http://localhost:3001

The server restarts by itself when you save a file (`tsx watch`), and its database connections restart with it.

## Useful commands

| Command | What it does |
|---|---|
| `pnpm check-types` | Type check everything |
| `pnpm lint` | Lint everything (no warnings allowed) |
| `pnpm test` | Run the tests (server: Vitest) |
| `pnpm db:migrate` | Create a new migration after changing `schema.prisma` (dev only) |
| `pnpm --filter @skerp/server db:status` | Show which migrations are applied |
| `pnpm build` | Production build of everything |
| `npx prisma studio` (in `apps/server`) | Browse the **local/test** database in the browser |

## Test database vs live database

| | Local (your PC) | Live (EC2) |
|---|---|---|
| Database | Supabase **test** project (Tokyo region) | A Postgres container on the EC2 server. See [deployment](deployment.md). ⚠ Confirm the live server uses this setup |
| Data | Test data. Safe to try anything | Real company data. Never test here |
| Speed | Each query ~130 ms (far region) | Fast (database on the same server) |

**Rule:** your local `.env` must **never** point to the live database.

## Branches and commits

- Work on a branch named after the ticket, e.g. `ERP-72/DCDetention`, then open a pull request to `main`.
- Deploys go from the `production` branch (see [deployment](deployment.md)).
- Before pushing, run `pnpm check-types`, `pnpm lint` and `pnpm test`.
