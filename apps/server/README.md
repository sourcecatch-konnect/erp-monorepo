# @skerp/server

Express 5 + Prisma 7 (PostgreSQL) API. ESM, run with `tsx`.

## Database & migration setup

Two databases are in play:

| Connection | Env var | Used by | Points at |
| --- | --- | --- | --- |
| **Runtime** | `DATABASE_URL` | the app (Prisma Client, `prisma/prisma.ts`) | **Supabase** (pooler, `:6543`) |
| **Migrate CLI** | `DIRECT_URL` | `prisma migrate *` (`prisma.config.ts`) | **local Docker Postgres** |
| **Deploy target** | `SUPABASE_DIRECT_URL` | `migrate deploy` (override) | **Supabase** (session, `:5432`) |

Migrations are **authored against a local Postgres container** (fast — Prisma creates its
shadow DB locally) and **deployed to Supabase** with `migrate deploy`. Never run
`migrate dev` against Supabase: it replays the whole history into a remote shadow DB and
is painfully slow over the network.

### 1. Spin up the local Postgres container (one-time)

```bash
docker run --name erp-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  -d postgres:17
```

After a reboot the container is stopped, not gone — just start it again:

```bash
docker start erp-pg
```

Your `apps/server/.env` already has `DIRECT_URL` pointing at this container
(`postgresql://postgres:postgres@localhost:5432/postgres`). It's a migrate-only
workspace — **do not seed it** and don't point the app at it.

> First time on a fresh clone, sync the local container to the current schema:
> ```bash
> pnpm --filter @skerp/server exec prisma migrate deploy   # applies committed migrations locally
> ```

### 2. Day-to-day: create a migration (local)

Edit `prisma/schema.prisma`, then:

```bash
pnpm --filter @skerp/server db:migrate -- --name <change_name>
# generates prisma/migrations/<ts>_<change_name>/ and applies it to the local container,
# then regenerates the Prisma Client. Fast — local shadow DB.
```

Check state any time:

```bash
pnpm --filter @skerp/server db:status
```

Commit the new `prisma/migrations/<ts>_<change_name>/` folder.

### 3. Deploy migrations to Supabase

`migrate deploy` only applies pending migrations — no shadow, no replay.

**PowerShell:**
```powershell
$env:DIRECT_URL=$env:SUPABASE_DIRECT_URL; pnpm --filter @skerp/server db:deploy
```

**bash / git-bash:**
```bash
DIRECT_URL="$SUPABASE_DIRECT_URL" pnpm --filter @skerp/server db:deploy
```

> Both env vars come from `apps/server/.env`. The override is needed because the CLI
> reads `DIRECT_URL`, which normally points at your local container.

### Other commands

```bash
pnpm --filter @skerp/server db:generate   # regenerate Prisma Client only
pnpm --filter @skerp/server dev           # run the API (http://localhost:5000)
```

### Troubleshooting

- **`port 5432 already in use`** — another Postgres is running locally. Map a different
  host port (e.g. `-p 5433:5432`) and set `DIRECT_URL=...@localhost:5433/postgres`.
- **`migrate dev` is slow** — you're pointed at Supabase, not the local container. Check
  `DIRECT_URL` in `.env`.
- **drift / "migrations not found" against Supabase** — its recorded history must match
  the migration folders on disk. After a squash, baseline Supabase once
  (`migrate resolve --applied <migration>`) before deploying.
