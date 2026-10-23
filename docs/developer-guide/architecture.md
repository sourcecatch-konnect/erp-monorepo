# Architecture

> Last checked: 2026-10-09 · Audience: developers

## The big picture

```
 Browser ──► Website (Next.js, apps/web, :3001)
                 │  axios, cookies (httpOnly)          socket.io (live updates)
                 ▼                                          │
            API server (Express 5, apps/server, :5000) ◄────┘
                 │                 │                 │
                 ▼                 ▼                 ▼
          PostgreSQL         Redis + BullMQ      Outside services
          (Prisma 7)         (notification       AWS S3 (files), AWS SES (email),
                              jobs)              Meta WhatsApp, OneLap GPS,
                                                 WhiteBooks e-way bill
```

## The project (monorepo)

It is a pnpm + Turborepo monorepo:

```
erp-monorepo/
  apps/
    server/        Express API, Prisma schema, migrations, seeds, background jobs
    web/           Next.js website (pages, screens, menus)
  packages/
    types/         shared TypeScript types + the PERMISSIONS list (+ readable names)
    validators/    shared Zod schemas (the same rules on the website and the server)
    ui/            shared UI components (buttons, dialogs, tables…)
    config/        shared config
    notifications-web/, attachments-web/   shared front-end pieces
    eslint-config/, typescript-config/, dev-tools/
  deploy/          production Docker setup (see deployment.md)
  docs/            this documentation
```

## Server (`apps/server`)

| Part | Where | Notes |
|---|---|---|
| Entry | `src/index.ts` | Registers every route under its path (e.g. `/driver-finance`), starts the socket.io server, the notification workers and the daily checks |
| Modules | `src/modules/<module>/` | One folder per business area: `*.route.ts` (API), `*.service.ts` (logic), sometimes `*.pdf.ts` and `__tests__/` |
| Database schema | `prisma/schema.prisma` | All tables. The generated client goes to `generated/prisma` |
| Migrations | `prisma/migrations/` | One folder per change. Never edit an applied migration |
| Database client | `prisma/prisma.ts` | Prisma with the `pg` adapter. Pool size `DB_POOL_MAX` (default 10), idle timeout `DB_IDLE_TIMEOUT_MS` (default 5 min) |
| Login | `src/middlewares/auth.middlware.ts` | Reads the `accessToken` cookie (JWT, 15 min; a refresh token lasts 7 days) and loads the user's permissions (cached 5 min in memory) |
| Permissions | `src/auth/can.middleware.ts`, `src/auth/branch-scope.ts` | `can(PERMS.X.Y)` on every route. `branchFilter(req)` and `assertBranchAccess` limit data to the user's branches |
| Accounting | `src/modules/ledger/posting.service.ts` | **The only place vouchers are written** (`postJournal`, `reverseJournal`, and one helper per document type) |
| Notifications | `src/modules/notifications/` | Event table + BullMQ queue (Redis) → in-app, email (SES), WhatsApp |
| Audit log | `src/modules/audit/audit.service.ts` | `recordAuditEntry`, which never throws |
| Shared helpers | `src/modules/_shared/` | Document numbers (`nextSequence`, `formatDocNumber`), list paging, the CRUD factory for masters, responses |

## Website (`apps/web`)

| Part | Where |
|---|---|
| Pages (URLs) | `app/(dashboard)/<path>/page.tsx`. Each one is thin and renders a feature screen |
| Screens and logic | `features/<module>/`: screens, dialogs, `*.service.ts` (API calls), React Query hooks |
| Sidebar menu | `config/navigation.ts`. Each item has a permission, and items the user can't open are hidden |
| API client | `lib/api.ts`: axios with cookies; refreshes the login automatically on a 401 |
| Shared components | `components/` (layout, lookups such as the driver/vehicle pickers, feedback) |

## Background work

| What | How |
|---|---|
| Sending notifications | BullMQ workers (Redis): retries with back-off |
| Live updates | socket.io: in-app notifications, GPS positions |
| Daily checks | `setInterval` sweeps: LR delivery reminders, driver licence expiry |

## Main modules (server folder → menu)

| Server module | Menu |
|---|---|
| `order`, `lr-group`, `lorry-receipt` | Orders, Lorry Receipts, Deliveries |
| `trip`, `vehicle-journey`, `trip-expense`, `log-slip`, `vehicle-cost` | Trips, Vehicle Journeys, Vehicle Reports |
| `vp-schedule`, `mrrr`, `vp-loading`, `grn`, `rail-rake`, `rail-branch-grn`, `rail-rake-operation`, `delivery-challan` | VP Management |
| `billing`, `receipt` | Billing & Receipts |
| `vendor-payment` | Vendor Payments |
| `driver-finance` | Driver Payments |
| `cash-planning`, `cash-account`, `ledger` | Cash & Bank, Books of Account |
| `purchase-order`, `spare-inward`, `spare-parts`, `job-card`, `service-bill`, `supplier-replacement` | Workshop |
| `tracking`, `one-lap-tracker` | Wagon Tracking |
| masters (`customer`, `transport`, `vehicle`, `driver`, `route`, `rateMatrix`, `agreements`, …) | Masters |
| `admin`, `notifications`, `audit`, `attachments`, `user-pref` | Settings, notifications, files |
