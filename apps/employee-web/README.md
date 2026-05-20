# Employee Web (`@skerp/employee-web`)

Employee portal for the SKERP logistics ERP. Next.js (App Router) + Redux Toolkit +
TanStack React Query + Tailwind, consuming `@skerp/ui` and the `@skerp/server` API.

Employee accounts are created by an admin in `admin-web` (Settings → Users); there is
no self-service signup here.

## Getting Started

```sh
pnpm --filter @skerp/employee-web dev      # http://localhost:3002
```

Requires the API server running (`pnpm --filter @skerp/server dev`).
Set `NEXT_PUBLIC_API_URL` in `.env` (see `.env.example`).

## Project Structure

`app/` is **routing only** — thin pages that compose feature code. Domain logic
lives in `features/`. Mirrors `admin-web`.

```
app/                  routing: route groups, layouts, thin pages
  (auth)/             login
  (dashboard)/        authenticated pages — gated + wrapped in the app shell
features/             one self-contained folder per domain feature
  auth/               components/ hooks/ services/ store/ types.ts index.ts
components/layout/    app shell — AppShell, Sidebar, Topbar nav
config/               route constants, sidebar navigation
store/                root Redux store + typed hooks
lib/                  axios instance (api.ts), helpers (utils.ts)
hooks/ types/         app-wide hooks / types
```

### Conventions

- Import with the `@/` alias (`@/features/auth`, `@/lib/api`).
- Follow [`llm-guideline/`](../../llm-guideline/) — `design.md` and `frontend.md`.
- Auth uses httpOnly cookies + persistent login (`/auth/me`) + token refresh,
  identical to `admin-web`; login posts to `/auth/employee/login`.
