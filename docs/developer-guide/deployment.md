# Deployment (live server)

> Last checked: 2026-10-09 · Audience: developers / admins. Full technical details: [`deploy/README.md`](../../deploy/README.md).

⚠ Confirm: this page describes the production setup in the `deploy/` folder. Check that the live EC2 server really runs it this way.

## How live is set up

```
                    ┌─ caddy (:80 / :443) ─ the only part open to the internet
  browser ──────────┤     /api/*       → server :5000
                    │     /socket.io/* → server :5000
                    │     everything   → web :3001
                    │
                    web ── server ──┬─ postgres  (database, inside the server, never exposed)
                                    ├─ redis     (jobs, never exposed)
                                    └─ migrate   (runs "prisma migrate deploy" before the server starts)
```

- Everything runs in **Docker** on one **AWS EC2** server, in `/opt/skerp`.
- **Caddy** handles HTTPS automatically when a domain is set (`SITE_ADDRESS` in `.env`).
- The **database (Postgres 17)** and **Redis** run as containers on the same server, with no outside access.
- Logs: **Dozzle**, reachable only through an SSH tunnel.

## How a release goes live

1. Merge into the **`production`** branch.
2. GitHub Actions builds three images (`skerp-server`, `skerp-migrate`, `skerp-web`), copies them to the server over SSH, and runs `docker compose up -d`.
3. The `migrate` container applies new database migrations. The server starts only if they succeed.

**Rollback:** set `IMAGE_TAG` in `/opt/skerp/.env` to an older version, then run `docker compose up -d` (details in `deploy/README.md`).

## Before releasing a big feature (checklist)

| # | Step |
|---|---|
| 1 | All checks pass on the branch (types, lint, tests) |
| 2 | Tried on the **test** database by the users who own the feature |
| 3 | Migrations are safe for existing data. Take a **database backup** first |
| 4 | New permissions: run `seed-admin` on live (syncs the permission list and default roles), then grant the new permissions to the right roles |
| 5 | New ledgers: run the ledger seed (part of `seed-admin`) |
| 6 | One-time data (e.g. opening balances) entered by accounts |
| 7 | New settings added to `/opt/skerp/.env` (never committed) |
| 8 | Tell the users what changed (release note) |

## Driver Lifecycle release (pending)

- Migrations: `add_driver_finance`, `other_payments`, `joining_leaving_date`, `opening_balance` (they are applied automatically by `migrate`)
- Then: `seed-admin` (permissions + ledgers), opening balances, role grants

## Secrets on live

- Kept only in `/opt/skerp/.env` (permissions `600`) and in GitHub Actions secrets.
- **Change any secret that was ever committed to GitHub** (AWS keys, WhatsApp token, login secrets).
