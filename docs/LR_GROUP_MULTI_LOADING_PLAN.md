# LR Group / Multi-Loading-Point Plan

Implementation plan for **multi-loading-point custom orders**: one truck picking up (or
dropping) at several locations, producing several LRs that share **one freight** and **one
seal**. Derived from a design/grilling session — see "Decisions" for the locked contract.

## Problem

A custom order can require one vehicle to load at N locations (or unload at M locations).
The consignor issues a separate invoice + e-way bill per location, so each location becomes
its **own LR** (own LR number). But it is **one physical truckload**, so the **base freight**
and **seal number** are charged/entered **once for the whole truck**, not per LR.

Today the system assumes **one trip = one LR**: freight (`LRCharge.BASE_FREIGHT`) and seal are
captured **per LR at finalise**, and the truck-slot guard counts **LRs** per order. That breaks
the moment one truck carries multiple LRs.

## Decisions (locked)

1. The combined freight is the **client-billed base freight** (revenue), charged **once per
   truckload** — not the trip's `onwardFreight` (vehicle cost).
2. Introduce an explicit **`LRGroup`** aggregate. **Group key = order + truck index** (one
   group per truck; an order with `truckQuantity > 1` holds several groups).
3. **One LR = one consignment = one invoice/e-way bill = one (loading point, unloading
   point)** pair. Never more than one loading or unloading point per LR.
4. A loading/unloading point is a **`CustomerLocation`** (kills the legacy hack of modelling
   each pickup as a separate consignor master record).
5. **Consignor and consignee are constant across the whole group.** Only the *locations* vary
   per LR. So both parties live on the **group**, not the LR.
6. Points are declared on the **Order at booking** via **consignment lines** (one line → one
   LR). Loading/unloading point counts need not match; points may repeat across lines.
7. Freight lives on **`LRGroup.baseFreightAmount`**, defaulted from `Order.bookingFreightAmount`.
   Seal lives on **`LRGroup.sealNumber`**. Both entered **once**.
8. **Finalise is one atomic group action** (`POST /lr-groups/:id/finalise`): all LRs in the
   group flip `DRAFT → FINALISED` in one transaction or none do. Replaces per-LR finalise.
9. The **trip link lives on `LRGroup`**; dispatch fires **once per group**; the truck-slot
   guard counts **groups**, not LRs.
10. **Hub-split is a whole-group action** (`LRGroup.secondaryTripId`). Hub fan-out deferred.
11. **Every order/LR is grouped** — a normal single-pickup order is a group-of-one. One code
    path, accept the dev-only migration.
12. New endpoints **reuse `PERMS.LORRY_RECEIPT.*`** (finalise = `APPROVE`).

## Target model

### `LRGroup` (new) — one per truck, the real aggregate
`orderId`, `truckIndex`, `groupNumber` (`SKG/<branch>/<fy>/<seq>`), `fyCode`,
`consignorId`, `consigneeId`,
`originBranchId`, `destinationBranchId`, `transportType`,
`tripLegType`, `hubId`, `railheadBranchId`,
`isMarketVehicle`, `marketVehicleNumber`, `marketDriverName`,
`primaryTripId`, `secondaryTripId`,
`baseFreightAmount` (BigInt), `sealNumber`,
`status` (DRAFT | FINALISED | CANCELLED), `cancelReason`,
`finalisedAt`/`finalisedById`, audit cols, `version`.

### `LorryReceipt` (slimmed) — one consignment/invoice
Keeps: `id`, `lrNumber`, `fyCode`, `groupId`, `loadingLocationId`, `unloadingLocationId`,
`goods[]`, `invoiceNumber`, `invoiceAmount`, `ewayBills[]`, `status`, audit cols, `version`.
**Removes** (now on group): `consignorId`, `consigneeId`, `originBranchId`,
`destinationBranchId`, `transportType`, `tripLegType`, `hubId`, `railheadBranchId`,
`isMarketVehicle`, `marketVehicleNumber`, `marketDriverName`, `primaryTripId`,
`secondaryTripId`, `sealNumber`, `source`/`orderId` (orderId via group), and the
`LRCharge` BASE_FREIGHT role.

### `Order` (extended)
Add `consigneeId` (single). Replace order-level `OrderItem` with **`OrderConsignment`** lines:
`{ orderId, truckIndex, loadingLocationId, unloadingLocationId, goods[] }`.

---

## Phase 1 — Schema (`apps/server/prisma`) — DONE

Dummy data only (no real LRs/trips), so a destructive migration that drops the relocated
columns + `LRCharge`/`OrderItem` tables is fine — **no backfill needed**.

Done in [schema.prisma](../apps/server/prisma/schema.prisma):

- Added `LRGroup` (the truckload aggregate) + `LRGroupStatus` enum.
- Added `OrderConsignment` + `OrderConsignmentGoods`; removed `OrderItem`; added
  `Order.consigneeId` + consignment lines.
- Slimmed `LorryReceipt` to `groupId` + `loadingLocationId`/`unloadingLocationId` + goods +
  invoice/e-way; relocated everything else to `LRGroup`.
- Removed `LRCharge` + `LRChargeType` (freight is now `LRGroup.baseFreightAmount`).
- Repointed all back-relations on `User`, `Branch`, `Customer`, `VehicleTrip`,
  `CustomerLocation`, `Goods`, `Order`. `prisma validate` passes.

**You run:** `pnpm db:migrate` (will drop relocated columns/tables), then `pnpm db:generate`.
Still TODO in this phase: wire `SKG/<branch>/<fy>/<seq>` group numbers via the existing
`DocumentSequence` flow (docType `LRG`) — happens in the Phase 3 group service.

## Phase 2 — Validators + types — DONE

- **`packages/validators/src/lr-group/lr-group.schema.ts`** (new): `createLRGroupSchema`
  (discriminated union FROM_ORDER | INSTANT; INSTANT carries inline `lrs[]` lines, FROM_ORDER
  reads lines from the order), `updateLRGroupSchema`, `finaliseGroupSchema`
  (`{ baseFreightAmount, sealNumber, lrs: [{ lrId, invoiceNumber, invoiceAmount, ewayBill }] }`),
  `splitGroupAtHubSchema`, `cancelGroupSchema`, `lrGroupLineSchema`, `finaliseGroupLineSchema`.
- **`lorry-receipt.schema.ts`** slimmed: removed `lrChargeTypeSchema`, `createLR*`,
  `finaliseLRSchema`, `splitLRAtHubSchema`, `cancelLRSchema`; kept the enums (now shared with the
  group schema), `lrGoodsLineSchema`, a slim `updateLRSchema` (loading/unloading location +
  goods + invoice), and `ewayBillSchema`/`addEwayBillSchema`.
- **`order.schema.ts`**: added `consigneeId` + `consignments` (array of `orderConsignmentSchema` =
  `{ truckIndex, loadingLocationId, unloadingLocationId, goods[] }`); kept `items` for Item orders.
- **Types** (`packages/types`): new `lr-group/lr-group.type.ts` (`LRGroup`, `LRGroupListItem`,
  body/form-input types, refs, `TripRef`); reshaped `lorry-receipt.type.ts` (slim LR, dropped
  `LRCharge`, added `LocationRef`/`LRGroupRef`); added consignment row types + `consigneeId` to
  `order.type.ts`. Index + package.json subpath exports wired.
- **Verified:** `pnpm --filter @skerp/validators build` ✅, `pnpm --filter @skerp/types
  check-types` ✅.

Code that still references the removed LR exports (→ fix in Phase 3/4):
`apps/server/src/modules/lorry-receipt/lorry-receipt.route.ts`;
`apps/web/features/lorry-receipts/{lorry-receipt.service.ts, components/LRForm.tsx, LRDetail.tsx,
components/FinaliseDialog.tsx}`.

## Phase 3 — Server — DONE

Server `pnpm --filter @skerp/server check-types` passes. Summary of what landed:

- **`modules/lr-group/lr-group.service.ts`**: `generateGroupNumber` (`SKG/...`, docType `LRG`),
  `assertGroupSlotAvailable` (counts groups + enforces unique `truckIndex`), `dispatchTripOnAttach`
  (moved here, fires once per group), `groupListSelect` / `groupDetailInclude`.
- **`modules/lr-group/lr-group.route.ts`**: list, status-counts, detail, create (FROM_ORDER reads
  the order's consignment lines for the truck + generates one LR each; INSTANT uses inline lines),
  update (DRAFT group fields), **atomic finalise** (covers every LR exactly once; writes freight +
  seal on the group, invoice + e-way per LR), group hub-split, cancel (cascades LRs). All gated by
  `PERMS.LORRY_RECEIPT.*`. Mounted at `/lr-groups`.
- **`lorry-receipt.service.ts`** slimmed: kept `generateLRNumber` + `resolveHubBranchId`; new slim
  `lrListSelect`/`lrDetailInclude` (group ref + locations + goods + eway); dropped the LR-based slot
  guard (now group-based).
- **`lorry-receipt.route.ts`** slimmed to list/detail/draft-update (location/goods/invoice)/add-eway;
  branch access derived via the LR's group. Create/finalise/split/cancel removed (group owns them).
- **`order`**: create + full-edit persist `consigneeId` + `consignments[]` (with goods); `orderInclude`
  returns consignee + consignment lines.
- **`trip.route.ts`**: delete-guard now counts linked `LRGroup`s, not LRs.

Original step list (for reference):

1. **New `modules/lr-group/`** (`lr-group.route.ts` + `lr-group.service.ts`):
   - `GET /lr-groups`, `GET /lr-groups/:id` (with LRs, locations, trip, freight).
   - `POST /lr-groups` / `PATCH /lr-groups/:id` — create/edit DRAFT group; add/remove LR lines.
   - `POST /lr-groups/:id/finalise` — **atomic**: write freight + seal on group, set each LR's
     invoice + e-way, flip all LRs + group to FINALISED in one `$transaction`. Move
     `dispatchTripOnAttach` here, firing **once** for the group's trip.
   - `POST /lr-groups/:id/split-at-hub` — whole-group hub-split (logic moved from LR route).
   - `POST /lr-groups/:id/cancel`. All gated by `can(PERMS.LORRY_RECEIPT.*)`.
   - `generateGroupNumber` in the service (mirror `generateLRNumber`, docType `LRG`).
2. **Trim `modules/lorry-receipt/`**: remove finalise + split-at-hub routes; LR create/update
   become group-internal operations (no standalone freight/seal). Keep list/detail (reading
   via group). LR number generation stays per LR.
3. **`modules/order/`**: order create/update persists consignment lines; "generate LRs"
   produces one draft LR per line, all FK'd to one `LRGroup` per truck. `bookingFreightAmount`
   seeds the group's `baseFreightAmount`.
4. **Slot guard** (`lorry-receipt.service.ts` → group service): `assertTruckSlotAvailable`
   counts non-cancelled **groups** per order vs `truckQuantity`.
5. Mount `/lr-groups` in `apps/server/src/index.ts`. Update `trip.pdf.ts` / `order.pdf.ts` /
   freight references to read freight from the group.

## Phase 4 — Web (`apps/web/features`)

1. **Order booking form** gains a consignment-lines editor (per line: loading location,
   unloading location, goods) + single consignee picker. Locations filtered to the
   consignor/consignee customer's `CustomerLocation`s.
2. **LR/group screens** become group-centric:
   - List shows groups (group number, truck, consignor→consignee, freight, status) with LRs
     nested/expandable.
   - **Group finalise dialog**: N per-LR rows (invoice number, invoice amount, e-way bill) +
     **two shared fields** (base freight amount defaulted from booking freight, seal number).
     One submit → `POST /lr-groups/:id/finalise`.
   - Hub-split action moves to the group.
3. New `lr-group.service.ts` + `lr-group.keys.ts`; trip detail shows the group it carries.

## Phase 5 — Verify & clean up

- `pnpm check-types`, `pnpm lint`, `pnpm build`.
- Manually exercise: 3-loading-point order → generate group → finalise once → confirm one
  freight + one seal, three LRs each with own invoice + e-way; truck-slot count = 1.
- Confirm hub-split moves the whole group to a leg-2 trip.

## Transaction shape (create path)

`POST /lr-groups` create was hitting Prisma's 5s interactive-transaction timeout
(many sequential reads + a per-line LR-number loop + a heavy `include`, all inside
one `$transaction`). Restructured to the pattern now documented in CLAUDE.md
("Database transactions"): all reads / branch checks / `generateGroupNumber` /
`generateLRNumbers` run against `db` _before_ the transaction; the transaction
only creates the group + LRs (returning `select: { id }`) and dispatches the trip;
the detail `include` is re-fetched after commit. LR numbers are reserved as one
block (`generateLRNumbers`) instead of N single upserts. A
`{ timeout: 15000, maxWait: 10000 }` budget is set as a backstop. **Apply the same
shape to the finalise / split / cancel transactions if they grow.**

## Open (flagged, not blocking)

- **Accounts vs Ops separation**: reused `LORRY_RECEIPT.*`. Split into `LR_GROUP.*` only if
  freight finalisation must be Accounts-only while Ops manages LRs.
- **Origin/destination branch** stays sourced from the order (not inferred per location), so
  branch-scoped LR/group numbering stays stable.
- **Hub fan-out** (group's LRs diverging to different leg-2 trips) deliberately deferred;
  would be modelled as re-grouping at the hub.
