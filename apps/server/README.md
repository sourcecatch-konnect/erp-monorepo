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

⚠️ Running plain `pnpm prisma migrate deploy` deploys to the **local container**,
not Supabase — the CLI reads `DIRECT_URL`, which points at localhost. You must
override it with the Supabase session-mode URL for this one command.
`SUPABASE_DIRECT_URL` lives in `apps/server/.env` and is **not** exported to your
shell automatically, so read it from the file:

**bash / git-bash** (from `apps/server/`):
```bash
DIRECT_URL="$(grep '^SUPABASE_DIRECT_URL=' .env | cut -d= -f2- | tr -d '\"')" \
  pnpm exec prisma migrate deploy
```

**PowerShell** (from `apps/server/`):
```powershell
$env:DIRECT_URL = (Get-Content .env | Select-String '^SUPABASE_DIRECT_URL=').ToString().Split('=',2)[1].Trim('"')
pnpm exec prisma migrate deploy
Remove-Item Env:DIRECT_URL   # so later migrate commands hit local again
```

Confirm the output line says `pooler.supabase.com`, not `localhost:5432`.

### 4. After a migration that adds permission keys

If the change added entries to `packages/types/src/permissions.ts`, rebuild the
packages and re-run the RBAC seed (it targets `DATABASE_URL`, which already
points at Supabase):

```bash
pnpm build:packages
pnpm --filter @skerp/server exec tsx prisma/seed-admin.ts
```

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
