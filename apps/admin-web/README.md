# Admin Web (`@skerp/admin-web`)

Admin frontend for the SKERP logistics ERP. Next.js (App Router) + Redux Toolkit +
TanStack React Query + Tailwind, consuming `@skerp/ui` and the `@skerp/server` API.

## Getting Started

```sh
pnpm --filter @skerp/admin-web dev      # http://localhost:3001
```

Requires the API server running (`pnpm --filter @skerp/server dev`).
Set `NEXT_PUBLIC_API_URL` in `.env` (see `.env.example`).

## Project Structure

`app/` is **routing only** — thin pages that compose feature code. Domain logic
lives in `features/`.

```
app/                  routing: route groups, layouts, thin pages
  (auth)/             unauthenticated pages (login, signup)
  (dashboard)/        authenticated pages — gated + wrapped in the app shell
features/             one self-contained folder per domain feature
  <feature>/
    components/  hooks/  services/  store/  types.ts  index.ts (public API)
components/layout/    app shell — AppShell, Sidebar, Topbar
config/               route constants, sidebar navigation
store/                root Redux store + typed hooks
lib/                  axios instance (api.ts), helpers (utils.ts)
hooks/                app-wide hooks
types/                app-wide shared types
```

### Conventions

- Import with the `@/` alias (`@/features/auth`, `@/lib/api`). No deep relative
  paths across folders.
- Import a feature only via its barrel: `@/features/<feature>`.
- The root store composes feature slices; each feature owns its slice.
- Follow [`llm-guideline/`](../../llm-guideline/) — `design.md` (visual system)
  and `frontend.md` (architecture).

### Adding a module

1. `features/<module>/` with `components/ hooks/ services/ store/ types.ts index.ts`.
2. Register its reducer in `store/store.ts`.
3. Add a route under `app/(dashboard)/<module>/`.
4. Enable its item in `config/navigation.ts`.
