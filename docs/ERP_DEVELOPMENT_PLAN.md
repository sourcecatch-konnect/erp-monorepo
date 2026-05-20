# SKERP — Transport ERP Development Plan

> Phase-wise, module-wise roadmap for the new monorepo ERP.
> Status snapshot: **~25% complete** (schema drafted, auth flow done, infra scaffolded).
> The Prisma schema is still **pending/incomplete** — treat it as a draft, not final.

---

## 1. Where We Are Today

### New monorepo (`erp-monorepo`) — the target build

| Area | Status | Notes |
|------|--------|-------|
| Turborepo workspace | ✅ Done | `apps/` + `packages/` set up |
| `apps/server` (Express + TS + Prisma) | 🟡 Partial | Auth flow only |
| `apps/admin-web` | 🟡 Scaffold | Shell only |
| `apps/employee-web` | 🟡 Scaffold | Shell only |
| `packages/ui`, `validators`, `types`, `config` | 🟡 Partial | Shared libs started |
| Prisma schema | 🟡 Draft | Full TMS schema drafted (~26 models), **not finalised** |
| Auth (admin + employee login, refresh token, logout) | ✅ Done | Cookie-based JWT, refresh rotation |
| Health route | ✅ Done | |
| Everything else (masters, orders, LR, trips, dashboard) | ❌ Not started | |

### Old ERP (`erp-backend` + `erp-frontend`) — reference only

The legacy app is the **functional reference** for what the business needs. It already has:

- **Auth + Permission** — role-based access, signup, role assignment.
- **Master module** — one generic CRUD engine driving **26 master entities** (`master.route.js` + `masterSchemas.js`): user, company, branch, warehouse, role, permission, module, route, rateMatrix, vehicle, customer, agreement, driver, truck, goods, labour, city, area, railwayFreightMatrix, pump, spareCategory, sparePartSupplier, sparePart, transport, wagon. Includes bulk import + bulk delete.
- **Order Booking** — create / edit / view / list / change-status.
- **Lorry Receipt (LR)** — LR form, vehicle-location lookup.
- **Trip / Container** — trip form, route lookup, trip table/modal.
- **Operations, Accounts, Dashboard, Settings/AccessControl** — frontend pages exist.

> Use the old ERP to confirm **business rules and field lists**, but rebuild cleanly in the monorepo with TypeScript + Prisma + shared validators. Do not port code 1:1.

---

## 2. Guiding Principles

> **Important:** We are **not** copying the old repo's design decisions. No fully-dynamic
> generic master engine, no config-driven `:masterName` routing. The old ERP is a
> *functional* reference (field lists, business rules) — **not** an architectural one.

1. **Schema first, per module.** Finalise the Prisma models for a module before building its API.
2. **Validators are shared.** Every entity gets a Zod schema in `packages/validators`, consumed by both server and web.
3. **Vertical slices.** Each module ships end-to-end: schema → API → admin UI → employee UI (where relevant).
4. **Explicit, typed modules over dynamic abstraction.** Each master is its own typed
   route + service + Prisma model. Repetition is reduced with shared *helpers/factories*,
   not with a runtime metadata engine. See §6 for the full rationale.
5. **Permissions enforced from Phase 1.** Every route checks module-level `canView/Create/Update/Delete`.
6. **Type safety end-to-end.** No `any`, no untyped `Json` blobs as a design crutch.
   The compiler should catch a wrong field name before runtime does.

---

## 3. Phase-Wise Plan

### Phase 0 — Foundation & Infrastructure *(do first)*

Goal: a stable base every module can build on.

- [ ] Finalise tooling: env config (`.env.example` files already added), `prisma.config.ts`, DB connection.
- [ ] Standardise server structure: pick **one** convention (`modules/` vs `controllers/` + `router/` are currently both present — consolidate).
- [ ] Shared response envelope (`ApiResponse`), error handling (`error.middleware`) — already partly there; finish it.
- [ ] Logging, request validation middleware, async handler wrapper.
- [ ] CI: lint + typecheck + build across the workspace.
- [ ] Seed script for local dev (company, branch, admin user, modules).

**Deliverable:** server boots, DB connects, one protected route works end-to-end.

---

### Phase 1 — Auth & Access Control Module

Goal: complete identity + permissions. Mostly done — finish and harden.

| Task | Status |
|------|--------|
| Admin / employee login, refresh token, logout | ✅ Done |
| `profile` endpoint (real implementation) | ❌ TODO |
| Signup / create user | ❌ TODO |
| Role CRUD + assign role to user | ❌ TODO |
| Module registry + Permission matrix (`role × module`) | ❌ TODO |
| `requirePermission(module, action)` middleware | ❌ TODO |
| Admin UI: login, user management, roles, permission matrix | ❌ TODO |
| Employee UI: login, profile | ❌ TODO |

**Deliverable:** an admin can create users, define roles, and grant per-module permissions; both web apps gate routes on them.

---

### Phase 2 — Master Module *(the backbone — build before transactions)*

Goal: all reference data that orders/LR/trips depend on.

**Build approach — explicit per-master, not a dynamic engine:**

- [ ] Each master = its own Prisma model + Zod schema (`packages/validators`) + typed
      service + typed router (`/customers`, `/vehicles`, `/routes`, …). No `:masterName`.
- [ ] Cut boilerplate with a **typed CRUD factory/helper** (generics over the Prisma
      delegate) — shared *code*, not shared runtime config. Each master still has its
      own file, types, and overridable handlers.
- [ ] Standardise list endpoints: pagination, sorting, filtering, search as shared utilities.
- [ ] Bulk import as an explicit per-master endpoint with a typed row schema + error report.

Recommended sub-order (dependency-aware):

1. **Geography & org:** State → City → Area, Company → Branch → Warehouse.
2. **Catalog:** Module, Role, Goods, Wagon, SpareCategory.
3. **Parties:** Customer, Driver, Labour, Transport, Pump, SparePartSupplier, SparePart.
4. **Fleet:** Vehicle.
5. **Commercial:** Agreement → DetentionRate, Route, RateMatrix, RailwayFreightMatrix.

- [ ] Admin UI: master list, detail, form dialog, bulk import (reuse old `Masters.jsx` UX).

**Deliverable:** every master is CRUD-able with validation and bulk import.

---

### Phase 3 — Order Booking Module

Goal: capture customer demand.

- [ ] Finalise `OrderBooking` + `OrderGoods` schema (truck vs goods order types).
- [ ] API: create / edit / view / list / change-status (Pending → Approved/Rejected).
- [ ] Order-form metadata endpoint (dropdown data: customers, branches, cities, goods).
- [ ] Approval workflow + audit (created/updated/approved by).
- [ ] Admin UI: create/edit/view order, order table, approvals.
- [ ] Employee UI: create order, my orders.

**Deliverable:** orders can be booked, approved, and feed into LR.

---

### Phase 4 — Lorry Receipt (LR) Module

Goal: the core transport document.

- [ ] Finalise `LorryReceipt`, `EwayBill` schema; review `LRstatus` lifecycle (draft → generated → trip_attached → finalised → in_transit → delivered → closed/cancelled).
- [ ] API: create LR, generate, attach to trip, finalise, status transitions, cancel.
- [ ] E-way bill capture, POD upload, invoice fields.
- [ ] LR-form metadata endpoint; vehicle-location lookup.
- [ ] Admin UI: create LR, LR list/detail, status board.
- [ ] Employee UI: LR creation for field staff.

**Deliverable:** an approved order becomes an LR that can be tracked through its lifecycle.

---

### Phase 5 — Trip / Container Module

Goal: move LRs physically.

- [ ] Finalise `VehicleTrip`, `TripUnloadingPoint`, `TripStatusHistory` schema.
- [ ] API: create trip, attach LRs, route + rate-matrix lookup, multi-point unloading, status history (planned → in_transit → completed/cancelled).
- [ ] Vehicle & driver availability handling (`AVAILABLE` / `ON_TRIP`).
- [ ] Advance payment + payment mode capture.
- [ ] Admin UI: trip container, trip table/modal, status timeline.
- [ ] Employee UI: trip updates from the field.

**Deliverable:** LRs are bundled into trips and tracked to completion.

---

### Phase 6 — Operations Module

Goal: day-to-day execution view across orders, LRs, and trips.

- [ ] Unified operations board (pending pickups, in-transit, delivery due, exceptions).
- [ ] Detention tracking against `DetentionRate`.
- [ ] Alerts (insurance/licence expiry, idle vehicles).
- [ ] Admin + employee operations dashboards.

**Deliverable:** operators have a single screen to run the day.

---

### Phase 7 — Accounts Module

Goal: turn movement into money.

- [ ] Freight billing / invoice generation from LR + trip data.
- [ ] Customer ledger, credit-limit checks, TDS handling.
- [ ] Supplier/pump/spare-part payables.
- [ ] Driver advances vs settlement.
- [ ] Admin UI: invoices, ledgers, payments.

**Deliverable:** invoices and ledgers are generated from operational data.

---

### Phase 8 — Dashboard & Reports *(do last)*

Goal: visibility for management.

- [ ] Role-based dashboards (admin vs employee).
- [ ] KPIs: orders, LRs, trips, revenue, fleet utilisation, on-time %.
- [ ] Reports + exports (LR register, trip sheet, customer-wise revenue).

**Deliverable:** management dashboard with live KPIs and exportable reports.

---

### Phase 9 — Hardening & Release

- [ ] End-to-end testing per module.
- [ ] Performance: indexes, pagination, query review.
- [ ] Security audit (authz, input validation, file uploads).
- [ ] Deployment, backups, monitoring.
- [ ] User docs / onboarding.

---

## 4. Suggested Build Order (Summary)

```
Phase 0  Foundation        ← first
Phase 1  Auth & Access
Phase 2  Masters           ← backbone, blocks everything below
Phase 3  Order Booking
Phase 4  Lorry Receipt
Phase 5  Trip / Container
Phase 6  Operations
Phase 7  Accounts
Phase 8  Dashboard & Reports
Phase 9  Hardening & Release  ← last
```

**Rule of thumb:** Foundation → Auth → Masters must be solid before any transactional module. Orders → LR → Trip is a hard dependency chain. Operations, Accounts, and Dashboard are downstream consumers — they come after the transactional data exists.

---

## 5. Open Items / Schema Decisions Pending

The Prisma schema is a draft. Resolve before/with each module:

- `OrderBooking.truckDetail` is loose `Json` — model it properly for truck orders.
- LR ↔ Goods relation is currently optional/one-sided — confirm whether goods belong to LR or Order.
- `User.password` is nullable — confirm auth strategy (invite flow vs set-on-create).
- No soft-delete / `deletedAt` anywhere — decide on a global policy.
- No `Invoice` / `Payment` / `Ledger` models yet — needed for Phase 7.
- No file/attachment model — needed for POD, logos, photos.
- Server has duplicate conventions (`modules/` vs `controllers/`+`router/`) — pick one in Phase 0.

---

---

## 6. Production Best Practices for the New Repo

This is the architecture we follow instead of the old repo's decisions.

### 6.1 Why not the dynamic master engine

The old ERP routes every master through one `/:masterName` handler driven by a
metadata object. It looks DRY but in production it costs you:

- **No type safety** — `masterName` is a string; a typo or bad payload fails at runtime, not compile time.
- **No per-entity logic** — the moment one master needs a hook (e.g. recalc rates, cascade a status) the generic engine fights you.
- **Hard to read/debug** — stack traces all point at the same file; you can't grep for "where is customer created".
- **Weak validation & authz granularity** — everything funnels through one permission check, one schema lookup.

**Our rule:** explicit modules, with shared *helpers* (a typed `createCrudRouter<T>()`
factory) to remove boilerplate. Generic where it's safe (pagination, error mapping),
explicit where the domain lives (each master's file).

### 6.2 Server architecture

- **Layered, one convention.** `routes → controller → service → prisma`. Routes only
  wire HTTP; controllers validate + shape responses; services hold business logic and
  own all Prisma access. Pick this and delete the duplicate `modules/` vs
  `controllers/`+`router/` split in Phase 0.
- **Feature-first folders.** `src/modules/<feature>/` containing that feature's
  route + controller + service + types. Easier to navigate than layer-first.
- **Validate at the edge.** Zod `safeParse` on every body/query/param via one
  `validate(schema)` middleware. Controllers receive already-typed input.
- **One response envelope.** `{ success, data, error, meta }` everywhere. One
  `AsyncHandler` wrapper so no route forgets `try/catch`.
- **Central error handling.** Typed `AppError` hierarchy → one error middleware →
  consistent HTTP codes. Never leak Prisma errors raw.
- **Config via validated env.** Parse `process.env` through a Zod schema at boot;
  fail fast if missing. No scattered `process.env.X` reads.
- **Structured logging** (pino) with request IDs. No `console.log` in production paths.

### 6.3 Database & Prisma

- **Migrations, never `db push`** for shared/prod environments. Review every migration.
- **Index foreign keys and filter columns** (status, dates, branchId). The schema
  currently only indexes `VehicleTrip.status` — audit all transactional models.
- **Soft delete policy** — add `deletedAt`/`isActive` to masters that get referenced
  (you can't hard-delete a customer with LRs). Decide globally in Phase 0.
- **Audit columns** — `createdById/updatedById/createdAt/updatedAt` on every
  transactional model (already partly there — make it consistent).
- **Transactions** for multi-table writes (order→LR, LR→trip attach, invoicing).
- **Money as `Decimal`**, never `Float`. Fix `monthlyRent`, `salary`, `rate`,
  `freightAmount`, `creditLimit` etc. — they're `Float` today and will lose precision.
- **Replace loose `Json`** (`OrderBooking.truckDetail`) with real columns/relations.
- **Seed scripts** are checked in and idempotent.

### 6.4 Shared packages (the monorepo advantage)

- `packages/validators` — Zod schemas are the **single source of truth**; server
  validates with them, web infers form types from them, types are derived not duplicated.
- `packages/types` — shared API contract types (request/response DTOs).
- `packages/ui` — shared component library; both web apps consume it.
- Keep these versioned via workspace protocol; Turborepo handles build ordering.

### 6.5 API design

- RESTful, plural nouns (`/customers`, `/lorry-receipts`).
- **Consistent list contract:** `?page&limit&sort&search&filter`, response carries
  `meta.total`. Build it once as a shared helper.
- **Pagination is mandatory** on every list endpoint — never return unbounded rows.
- Version the API (`/api/v1`) from day one.
- Use proper status codes; `501` placeholders (current auth profile route) must be
  resolved before a module is "done".

### 6.6 AuthZ & security

- Short-lived access token + rotating refresh token (already done) — keep refresh
  tokens revocable (store a token id / version).
- `requirePermission(module, action)` middleware on every protected route; never
  trust the client for role/branch scoping.
- **Branch/company scoping** — most queries must be filtered by the user's branch;
  enforce in the service layer, not the UI.
- Rate-limit auth endpoints; hash passwords with bcrypt/argon2; validate file uploads
  (type, size) for POD/photos/logos.
- Secrets only via env; never commit `.env` (only `.env.example`).

### 6.7 Frontend (both web apps)

- TypeScript strict mode; forms typed from shared Zod schemas (`react-hook-form` + `zodResolver`).
- Server state via TanStack Query (caching, invalidation) — not hand-rolled fetch state.
- Route-level code splitting; protected-route wrapper reading the permission matrix.
- Shared `ui` package for tables, dialogs, form fields — consistent UX, written once.

### 6.8 Quality & delivery

- **CI gates:** lint + typecheck + build + test on every PR. Turborepo caches it.
- Tests: unit on services, integration on API routes (test DB), at minimum for
  Auth, Orders, LR, Trips, Accounts.
- Conventional commits + PR reviews; no direct pushes to `main`.
- `.env.example` kept current for every app (already started — maintain it).
- Error tracking (Sentry) + structured logs in production.

### 6.9 Summary: old vs new

| Concern | Old ERP | New repo |
|---------|---------|----------|
| Masters | One dynamic `:masterName` engine | Explicit typed module per master + shared CRUD factory |
| Types | JS, runtime-checked | TS strict, compile-checked, shared validators |
| Validation | Ad-hoc | Zod at the edge, single source of truth |
| Money | `Float` | `Decimal` |
| Schema changes | `db push`-style | Reviewed migrations |
| Structure | Mixed | One layered, feature-first convention |
| API lists | Inconsistent | Standard pagination/sort/filter contract |

---

*Generated as a planning baseline. Update phase checkboxes as work lands.*
