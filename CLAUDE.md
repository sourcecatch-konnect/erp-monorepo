# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Turborepo + pnpm workspaces. Node ≥18, TypeScript strict everywhere, pnpm@9.

- **apps/server** — Express 5 + Prisma 7 (PostgreSQL) + Zod. ESM (`"type": "module"`, run with `tsx`). Cookie-based auth (httpOnly), JWT, bcryptjs.
- **apps/admin-web** — Next.js 16 App Router (port 3001). React 19, Redux Toolkit, TanStack Query + Table, axios, react-hook-form + zodResolver, Tailwind 4.
- **apps/employee-web** — Same shape as admin-web (port 3002).
- **packages/ui** (`@skerp/ui`) — shadcn-style component library. Exported via `./*` glob (`@skerp/ui/components/button`). Storybook for previews.
- **packages/validators** (`@skerp/validators`) — Shared Zod schemas. Built to `dist/`, with per-master subpath exports (`@skerp/validators/master/city`).
- **packages/types** (`@skerp/types`) — Inferred types from validators + shared API/response types. Source-only (`./src/index.ts`).
- **packages/config**, **packages/eslint-config**, **packages/typescript-config** — shared configs.

## Commands

All run from the repo root unless noted.

```bash
pnpm dev                      # turbo run dev (predev builds packages first)
pnpm build                    # turbo run build (all)
pnpm build:packages           # build just packages/* — required before dev
pnpm lint                     # turbo run lint
pnpm check-types              # turbo run check-types
pnpm format                   # prettier write all ts/tsx/md

# Prisma (server)
pnpm db:generate              # prisma generate
pnpm db:migrate               # prisma migrate dev

# Single app dev
pnpm --filter @skerp/server dev          # http://localhost:5000
pnpm --filter @skerp/admin-web dev       # http://localhost:3001
pnpm --filter @skerp/employee-web dev    # http://localhost:3002

# Single package build / type-check
pnpm --filter @skerp/validators build
pnpm --filter @skerp/ui check-types

# Storybook for UI library
pnpm --filter @skerp/ui storybook
```

Env vars (declared in `turbo.json` globalEnv): `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`.

There is no test runner wired into turbo right now (UI has vitest deps but no `test` script). Don't claim "tests pass" — there's nothing to run.

## Architecture

### Master modules (vertical slices)

`docs/MASTER_MODULE_PLAN.md` and `llm-guideline/` are the authoritative architecture docs — read them before touching masters or UI. Key invariants:

- **Each master is a vertical slice** under `apps/server/src/modules/<master>/` and `apps/admin-web/features/masters/<master>/`. Deleting one folder must not break others. No cross-master imports.
- **Schema is single source of truth.** Prisma model → Zod in `packages/validators/src/master/<name>.schema.ts` → inferred types re-exported from `packages/types`. Forms/tables consume *types*, never a runtime config object describing fields.
- **Server uses `createCrudRouter`** (`apps/server/src/modules/_shared/crud.factory.ts`) for standard CRUD + list/search/export/bulk-delete/bulk-import. Each route is gated by `requirePermission(permissionKey, action)` — never expose a master without a `permissionKey`. Bespoke endpoints live in the same router, not as factory flags.
- **Web uses composition, not dispatch.** `_shared/MasterListPage.tsx` and `_shared/MasterFormDialog.tsx` are layout shells. Each master writes its own `page.tsx`, `<Name>Form.tsx`, `<Name>Table.tsx`, `<name>.service.ts`. Forms are JSX composition of field components in `_shared/fields/` reading from `useFormContext()`. Conditional fields live locally in that master's form.
- **Registry** (`apps/admin-web/features/masters/registry.ts`) is navigation + permissions metadata only — slug, label, icon, category, permissionKey, lazy `page` import. Not a field config map.
- Anti-patterns to reject in review: central `switch` over master/field type, `if (slug === "...")` outside that master's folder, field-config objects driving rendering, untyped `ColumnDef<any>[]`, one Zod schema for both create + update without reason. See MASTER_MODULE_PLAN §13.

The `[master]` dynamic route does `masterRegistry.find(...)` + `entry.page()` — dynamism stops at routing.

### API response envelope

```ts
type ApiResponse<T> =
  | { ok: true;  data: T; meta?: ListMeta }
  | { ok: false; error: ApiError };
```

Helpers in `apps/server/src/modules/_shared/response.ts` (`sendOk`). Errors thrown as typed errors (`NotFoundError`, `BadRequestError`, `ValidationError` from `lib/error.js`) and converted by `errorMiddleware`. List query parsed by `_shared/list.query.ts` — shape `?page=&size=&sort=field:asc&search=&filter[k]=v`.

### Server routing

`apps/server/src/index.ts` mounts routers under literal paths (`/states`, `/cities`, …). There are two parallel directory styles in `src/`:

- **`modules/<feature>/`** — newer pattern (used by masters). Router + crud factory.
- **`router/<feature>/`** — older pattern (auth, employee, lookup). Still wired into `index.ts`.

When adding a master, follow `modules/`. Don't move old routers preemptively.

### Auth

- Tokens are **httpOnly cookies** (`accessToken` ~15m, `refreshToken` 7d) set by the server. Frontend never reads or stores tokens — relies on `axios` with `withCredentials: true`.
- On 401, the axios interceptor in `apps/admin-web/lib/api.ts` calls `/auth/refresh` once and retries (concurrent 401s share one refresh).
- App-load bootstrap: `AuthBootstrap` dispatches `fetchMe` (`GET /auth/me`). Session lives in the Redux `auth` slice: `{ user, status, error }` with status `idle | loading | authenticated | unauthenticated`.
- `ProtectedRoute` wraps `(dashboard)` routes. No signup UI in admin-web — admins are provisioned server-side.

### Frontend state ownership

- **Redux Toolkit** — global/long-lived state (auth, eventually current branch / permissions / UI prefs). Feature slices live in `features/<feature>/store/`; root store in `store/store.ts` imports the reducer directly from the slice file (not the barrel — avoid circular imports).
- **TanStack Query** — server data for feature screens (lists, details, mutations).
- **`useState`** — view-local UI only.

### Frontend folder rules

`app/` is **routing only** — thin pages that import and render a feature component. Business logic lives in `features/<feature>/`. Path alias `@/*` → `./*`; cross-folder imports use `@/...`, not deep `../../../`. Each feature exposes its public API via `index.ts`; never import from a feature's internal paths.

## Design system (non-negotiables)

Source: `llm-guideline/design.md`. Both web apps must look identical.

1. **Sharp, not soft.** Global radius is 2px (`--radius: 0.125rem`). Never use `rounded-lg`/`xl`/`2xl`. `rounded-full` only for true circles (avatars, dots, spinners).
2. **One primary color** — blue `#2563EB`, accessed via the `primary` token. Never hardcode `bg-blue-600` or hex.
3. **Tokens, never raw colors** — `bg-card`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`, `bg-destructive`. Never `bg-white`, `text-gray-900`.
4. **Use `@skerp/ui`** for buttons, inputs, dialogs, tables. Need a variant? Add it to the shared component — don't fork into an app. New reusable thing? Add to `packages/ui` so both apps benefit.
5. Forms use react-hook-form + `@hookform/resolvers/zod` with the shared schema from `@skerp/validators`. Don't redefine field rules in the app.
6. One primary button per view. Flat surfaces (1px border, no shadows except floating layers from `@skerp/ui`).

## Adding a master (the 6-step path)

If this grows past ~6 steps the architecture is broken. From `MASTER_MODULE_PLAN.md §11`:

1. Prisma model in `apps/server/prisma/schema.prisma` + migration. Include `createdAt`/`updatedAt`; add `deletedAt` if referenced by transactional modules (soft delete).
2. Zod create + update schemas in `packages/validators/src/master/<name>.schema.ts`. Re-export from `packages/validators/src/index.ts` and add a subpath export in its `package.json`. Inferred types re-exported via `packages/types`.
3. Server module: `apps/server/src/modules/<name>/<name>.route.ts` calling `createCrudRouter`. Mount in `apps/server/src/index.ts`.
4. Web feature: `apps/admin-web/features/masters/<name>/` with `page.tsx`, `<Name>Form.tsx`, `<Name>Table.tsx`, `<name>.service.ts`, `<name>.keys.ts`.
5. One-line entry in `apps/admin-web/features/masters/registry.ts`.
6. Seed permission key `masters.<name>` in `apps/server/prisma/seed-admin.ts`.

CSV template (not XLSX in current impl) lives at `apps/admin-web/public/templates/<name>.csv`.

## Conventions

- TypeScript strict — no `any`. Type service responses and slice state explicitly.
- ESM throughout. Server imports use `.js` extensions in source (`import x from "./foo.js"`) because of NodeNext resolution.
- `"use client"` only where required.
- IDs are CUIDs. Timestamps are ISO strings on the wire.
- Don't call `fetch` directly or create ad-hoc axios instances — go through `apps/admin-web/lib/api.ts` and the feature's `<name>.service.ts`.
