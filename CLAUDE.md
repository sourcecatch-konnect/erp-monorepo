# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Turborepo + pnpm workspaces. Node ≥18, TypeScript strict everywhere, pnpm@9.

- **apps/server** — Express 5 + Prisma 7 (PostgreSQL) + Zod. ESM (`"type": "module"`, run with `tsx`). Cookie-based auth (httpOnly), JWT, bcryptjs.
- **apps/web** — Next.js 16 App Router (port 3001). React 19, Redux Toolkit, TanStack Query + Table, axios, react-hook-form + zodResolver, Tailwind 4.
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
pnpm --filter @skerp/web dev       # http://localhost:3001

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

- **Each master is a vertical slice** under `apps/server/src/modules/<master>/` and `apps/web/features/masters/<master>/`. Deleting one folder must not break others. No cross-master imports.
- **Schema is single source of truth.** Prisma model → Zod in `packages/validators/src/master/<name>.schema.ts` → inferred types re-exported from `packages/types`. Forms/tables consume _types_, never a runtime config object describing fields.
- **Server uses `createCrudRouter`** (`apps/server/src/modules/_shared/crud.factory.ts`) for standard CRUD + list/search/export/bulk-delete/bulk-import. Each route is gated by `requirePermission(permissionKey, action)` — never expose a master without a `permissionKey`. Bespoke endpoints live in the same router, not as factory flags.
- **Web uses composition, not dispatch.** `_shared/MasterListPage.tsx` and `_shared/MasterFormDialog.tsx` are layout shells. Each master writes its own `page.tsx`, `<Name>Form.tsx`, `<Name>Table.tsx`, `<name>.service.ts`. Forms are JSX composition of field components in `_shared/fields/` reading from `useFormContext()`. Conditional fields live locally in that master's form.
- **Registry** (`apps/web/features/masters/registry.ts`) is navigation + permissions metadata only — slug, label, icon, category, permissionKey, lazy `page` import. Not a field config map.
- Anti-patterns to reject in review: central `switch` over master/field type, `if (slug === "...")` outside that master's folder, field-config objects driving rendering, untyped `ColumnDef<any>[]`, one Zod schema for both create + update without reason. See MASTER_MODULE_PLAN §13.

The `[master]` dynamic route does `masterRegistry.find(...)` + `entry.page()` — dynamism stops at routing.

### API response envelope

```ts
type ApiResponse<T> =
  | { ok: true; data: T; meta?: ListMeta }
  | { ok: false; error: ApiError };
```

Helpers in `apps/server/src/modules/_shared/response.ts` (`sendOk`). Errors thrown as typed errors (`NotFoundError`, `BadRequestError`, `ValidationError` from `lib/error.js`) and converted by `errorMiddleware`. List query parsed by `_shared/list.query.ts` — shape `?page=&size=&sort=field:asc&search=&filter[k]=v`.

### Server routing

`apps/server/src/index.ts` mounts routers under literal paths (`/states`, `/cities`, …). There are two parallel directory styles in `src/`:

- **`modules/<feature>/`** — newer pattern (used by masters). Router + crud factory.
- **`router/<feature>/`** — older pattern (auth, employee, lookup). Still wired into `index.ts`.

When adding a master, follow `modules/`. Don't move old routers preemptively.

### Database transactions

Prisma interactive transactions (`db.$transaction(async (tx) => …)`) have a **5s
default timeout**. A transaction that does many sequential awaits will blow it
(symptom: `Transaction API error: A query cannot be executed on an expired
transaction` — and it points at whichever query happened to run after the clock
expired, not the slow one). Follow this shape for any multi-step write:

- **Keep the transaction to writes only.** Do all read-only work — lookups,
  permission/branch checks (`assertBranchAccess`), validation, slot guards,
  document-number generation — _before_ opening the transaction, against `db`.
  (Sequence generation via `DocumentSequence` upserts is atomic per statement and
  gap-tolerant, so it's safe outside the transaction; a rolled-back write just
  leaves a number gap.)
- **Don't materialise heavy reads inside the transaction.** Have the `create` /
  `update` return a minimal `select: { id: true }`, then re-fetch the full
  `include` detail _after_ the transaction commits.
- **Avoid N sequential round-trips.** Don't `await` a per-row query in a loop
  (e.g. one document number per line). Reserve a block in a single upsert
  instead — see `generateLRNumbers` (bumps the sequence by N, returns the first
  reserved value, formats the rest in memory) vs the single-row `generateLRNumber`.
- **Add an explicit budget as a safety net**, not a substitute for the above:
  `db.$transaction(fn, { timeout: 15000, maxWait: 10000 })`.

Reference implementation: `modules/lr-group/lr-group.route.ts` `POST /` (create).
Helpers typed `Prisma.TransactionClient` accept the base `db` client too, so the
same function works inside and outside a transaction.

### Auth

- Tokens are **httpOnly cookies** (`accessToken` ~15m, `refreshToken` 7d) set by the server. Frontend never reads or stores tokens — relies on `axios` with `withCredentials: true`.
- On 401, the axios interceptor in `apps/web/lib/api.ts` calls `/auth/refresh` once and retries (concurrent 401s share one refresh).
- App-load bootstrap: `AuthBootstrap` dispatches `fetchMe` (`GET /auth/me`). Session lives in the Redux `auth` slice: `{ user, status, error }` with status `idle | loading | authenticated | unauthenticated`. The user object carries `permissions: string[]`, `branchScope`, `branchIds`.
- `ProtectedRoute` wraps `(dashboard)` routes. Accepts an optional `permission` prop for permission-gated pages. No signup UI in web — admins are provisioned server-side.

### RBAC

- Permission keys are typed `resource.action` strings — registry lives in `packages/types/src/permissions.ts` (`PERMS.MASTERS.CUSTOMER.VIEW`, etc.) and is the single source of truth. Adding a permission = adding a constant there and re-running the seed.
- **Server gating:**
  - Bespoke routes: `can(PERMS....)` from `apps/server/src/auth/can.middleware.ts` — typed against the registry.
  - Master CRUD: the factory's `requirePermission(moduleKey, action)` composes `<moduleKey>.<action>` and checks the same hydrated set.
  - `authMiddleware` hydrates `req.ctx = { permissions: Set<string>, branchScope, branchIds }` from a 5-min in-memory cache, so checks are zero-DB after the first hit per user. Invalidate via `apps/server/src/auth/permission-cache.ts` on role/permission/user-branch mutations.
- **Branch scoping:** `branchFilter(req)` from `apps/server/src/auth/branch-scope.ts` returns a Prisma `where` fragment based on `req.ctx.branchScope` / `branchIds`. Apply to every query on a branch-scoped model. On writes, `assertBranchAccess(req, body.branchId)` before insert/update.
- **Frontend gating:** `useCan(PERMS....)` / `<Can permission={...}>` from `@/features/auth`. Server is the source of truth — these only hide UI.
- **Admin surface:** `/settings/roles`, `/settings/access`, `/settings/audit-log` (all gated by `admin.rbac.manage` except audit which uses `admin.audit_log.view`). Seed canonical roles: Admin (`isSystem`, all perms), Branch Manager, Operations, Accounts, Read-Only Auditor.
- Plan: `docs/RBAC_PLAN.md`. Don't reintroduce CRUD bool columns or name-match admin bypasses.

### Frontend state ownership

- **Redux Toolkit** — global/long-lived state (auth, eventually current branch / permissions / UI prefs). Feature slices live in `features/<feature>/store/`; root store in `store/store.ts` imports the reducer directly from the slice file (not the barrel — avoid circular imports).
- **TanStack Query** — server data for feature screens (lists, details, mutations).
- **`useState`** — view-local UI only.

### Frontend folder rules

`app/` is **routing only** — thin pages that import and render a feature component. Business logic lives in `features/<feature>/`. Path alias `@/*` → `./*`; cross-folder imports use `@/...`, not deep `../../../`. Each feature exposes its public API via `index.ts`; never import from a feature's internal paths.

## Design system (non-negotiables)

Source: `llm-guideline/design.md`. Both web apps must look identical.

1. **Precise, not soft.** Global radius is 6px (`--radius: 0.375rem`); all `rounded-*` derive from it. Never use `rounded-xl`/`2xl`+. `rounded-full` only for true circles (avatars, dots, spinners). Neutrals are warm-tinted oklch (hue ~92) — never pure gray. Motion: `transition-colors` 150ms hovers, shared overlay animations, Skeleton shimmer; no `hover:scale-*`/`hover:shadow-*`. Body/data text ≥ `text-sm`, labels ≥ `text-xs`, no `tracking-wide`.
2. **One primary color** — blue `#2563EB`, accessed via the `primary` token. Never hardcode `bg-blue-600` or hex.
3. **Tokens, never raw colors** — `bg-card`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`, `bg-destructive`. Never `bg-white`, `text-gray-900`.
4. **Use `@skerp/ui`** for buttons, inputs, dialogs, tables. Need a variant? Add it to the shared component — don't fork into an app. New reusable thing? Add to `packages/ui` so both apps benefit.
5. Forms use react-hook-form + `@hookform/resolvers/zod` with the shared schema from `@skerp/validators`. Don't redefine field rules in the app.
6. One primary button per view. Flat surfaces (1px border, no shadows except floating layers from `@skerp/ui`).

### Reusable primitives — non-negotiable

These get violated quickly by ad-hoc code. If you find yourself writing a `<table>`, a "Loading…" string, or a Prev/Next pair, stop and use the primitive instead.

- **Tables** — `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` from `@skerp/ui/components/table`. Never a raw `<table>` element. For full master CRUD tables (selection, hidden columns, edit/delete column), use `features/masters/_shared/MasterTable.tsx`.
- **Loading states** — `Skeleton` from `@skerp/ui/components/skeleton`. Never the string "Loading…" or a spinner-in-a-cell. For table rows, render N `<TableRow>`s each with `<Skeleton className="h-4 w-..." />` per column.
- **Pagination** — `Pagination` / `PaginationContent` / `PaginationItem` / `PaginationPrevious` / `PaginationNext` from `@skerp/ui/components/pagination`. Never hand-rolled "Previous / Next" buttons.
- **Forms** — `useForm` + `zodResolver(<schema from @skerp/validators>)` + `FormProvider`. Field components live in `features/masters/_shared/fields/*` (TextField, SelectField, CheckboxField, NumberField, …). They read from `useFormContext`. Use `Controller` from react-hook-form only for fields that aren't in the shared field library.
- **API services** — every feature has `<feature>.service.ts` calling `api` (the shared axios instance from `@/lib/api`). Unwrap responses with `unwrapApiResponse` / `unwrapListResponse` from `features/masters/_shared/master-api.ts` — never define a local `Envelope<T>` or call `res.data.data` directly.
- **Service Zod schemas live in `@skerp/validators`**, not inline in route handlers. Both server (`.parse(req.body)`) and web (`zodResolver(schema)`) consume the same schema. New surface? Add the file under `packages/validators/src/<area>/` plus a subpath export in its `package.json`.

## Adding a master (the 6-step path)

If this grows past ~6 steps the architecture is broken. From `MASTER_MODULE_PLAN.md §11`:

1. Prisma model in `apps/server/prisma/schema.prisma` + migration. Include `createdAt`/`updatedAt`; add `deletedAt` if referenced by transactional modules (soft delete).
2. Zod create + update schemas in `packages/validators/src/master/<name>.schema.ts`. Re-export from `packages/validators/src/index.ts` and add a subpath export in its `package.json`. Inferred types re-exported via `packages/types`.
3. Server module: `apps/server/src/modules/<name>/<name>.route.ts` calling `createCrudRouter`. Mount in `apps/server/src/index.ts`.
4. Web feature: `apps/web/features/masters/<name>/` with `page.tsx`, `<Name>Form.tsx`, `<Name>Table.tsx`, `<name>.service.ts`, `<name>.keys.ts`.
5. One-line entry in `apps/web/features/masters/registry.ts`.
6. Seed permission key `masters.<name>` in `apps/server/prisma/seed-admin.ts`.

CSV template (not XLSX in current impl) lives at `apps/web/public/templates/<name>.csv`.

## Conventions

- TypeScript strict — no `any`. Type service responses and slice state explicitly.
- ESM throughout. Server imports use `.js` extensions in source (`import x from "./foo.js"`) because of NodeNext resolution.
- `"use client"` only where required.
- IDs are CUIDs. Timestamps are ISO strings on the wire.
- Don't call `fetch` directly or create ad-hoc axios instances — go through `apps/web/lib/api.ts` and the feature's `<name>.service.ts`.
