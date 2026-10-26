# Masters: developer notes

> Last checked: 2026-10-09 · User guide: [Masters](../../user-guide/02-masters.md)

## Purpose

Base records (≈26 masters). Almost all of them use **one shared CRUD factory**, so adding or changing a master is mostly configuration.

## The shared factory

`apps/server/src/modules/_shared/crud.factory.ts` → `createCrudRouter({ … })`:

| Option | Meaning |
|---|---|
| `model` | Prisma delegate, e.g. `db.branch` |
| `createSchema` / `updateSchema` | Zod schemas from `packages/validators` |
| `permissionKey` | e.g. `"masters.branch"` → checks `masters.branch.view/create/update/delete` |
| `hooks.beforeCreate / beforeUpdate / beforeDelete` | Business rules (e.g. block deleting a used record, clear a cache) |
| `uniqueErrorMessages` | Friendly message per unique field (e.g. `branchCode`) |
| `listOptions` | `searchableFields`, `defaultInclude`, `softDelete` |

**Endpoints every master gets:**

| Method & path | Permission action |
|---|---|
| `GET /` (paged list), `GET /search`, `GET /lookup` (dropdowns), `GET /export` (CSV), `GET /:id` | view |
| `POST /` | create |
| `PATCH /:id` | update |
| `DELETE /:id`, `POST /bulk-delete` | delete |
| `POST /bulk-import` (array of rows) | create |

**Website:** `apps/web/features/masters/_shared/` (`MasterListPage.tsx`: list, search, add, edit, delete, import, export). Each master has its own folder under `features/masters/<name>` with its form and columns. The overview page is `/masters`.

## Masters and their extra rules

| Master | Route module | Extra rules (hooks / custom routes) |
|---|---|---|
| Branch | `branch` | Unique `branchCode`; Head Office can't be deleted; delete blocked when linked (users, orders, LRs, agreements…); `PUT /branches/:id/railheads` (railheads must be Areas marked Rail Head); clears the branch-code cache (`branch/branch-ref.cache.ts`) on update/delete |
| Area | `area` | Unique (city, name) and Google Place; can't remove a railhead still used |
| City / State | `city`, `state` | Checks on create/update/delete |
| Customer | `customer` | Customer **locations** (loading/unloading points) with their own endpoints; a location used in orders can't be deleted |
| Agreement | `agreements` | Nested **detention rates** (`DetentionRate`: DAY/HOUR bands, not yet used by any calculation) |
| Rate Matrix | `rateMatrix` | Unique (agreement, route, vehicle type, unit, transport type). Read by `order.service.ts → computeFreight` |
| Railway Freight | `railwayFraightMatrix` | Source/destination areas must be railheads in the chosen cities |
| Vehicle | `vehicle` | Unique number; **market vehicle needs a transporter**; `insuranceDueDate` checked when starting trips/journeys |
| Vehicle Type | `vehicleType` | Unique code; freight range |
| Driver | `driver` | Licence expiry checked on trips/journeys (`assertLicenceValid`); salary + joining/leaving dates used by the salary run; document upload via S3 presign |
| Transport | `transport` | Unique name and phone; has a party **ledger** (vendor payments) |
| Creditor / Labour / Pump | `creditor`, `labour`, `pump` | Each has a party **ledger** |
| Cash Account | `cash-account` | CASH/BANK account linked to a ledger; opening balance in Finance |
| Spare Part / Category / Supplier, Warehouse, Goods, Units, Wagons, Company | own modules | Mostly plain CRUD + delete-when-linked checks |

**Ledgers:** customer, transport, creditor, labour, pump, driver and spare-part supplier ledgers are created on first use by `getOrCreatePartyLedger` (`ledger/posting.service.ts`). Don't create them by hand.

## How to add a new master (recipe)

1. Prisma model in `schema.prisma` → `pnpm db:migrate`.
2. Zod create/update schemas in `packages/validators`.
3. Permission group in `PERMS.MASTERS` + readable names in `permission-labels.ts`.
4. Server: a `<name>.route.ts` with `createCrudRouter(...)`; register it in `src/index.ts`.
5. Website: a folder in `features/masters/<name>` (form + columns) using `MasterListPage`; page in `app/(dashboard)/masters/<name>`; menu item in `config/navigation.ts`.
6. Grant the permissions to roles (`seed-admin.ts`), and run the seed.

## Known gaps

- The import file format/template isn't documented. ⚠ Confirm how users prepare the import file.
- `DetentionRate` (agreements) isn't used by any calculation yet (see the planned DC detention module).
