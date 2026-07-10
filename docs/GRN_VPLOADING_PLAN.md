# GRN & VP-Loading — implementation plan

Status: proposed (schema already exists; server + web are unbuilt). Written while
finishing the container/logistics module and comparing against the old
reference ERP (`D:\Work\SK_Logistics code\SK_Logistics`) for gaps.

## Problem

An LR that's `FINALISED` and rail-eligible (`transportType` includes rail,
`railheadBranchId` set) has no way to record what happens at the rail-head:
receiving the goods off the truck (GRN), then physically loading them onto a
wagon (VP-Loading). Both models already exist in full in
[schema.prisma](../apps/server/prisma/schema.prisma) — `model GRN` (~line 1465),
`model GRNGoods` (~1549), `model VPLoading` (~1578) — with fields that already
mirror the legacy screens closely (gate in/out times, freight settlement math,
detention, hamali, a 5-item document checklist with paired remarks on GRN;
loaded qty/cft/weight, labour, supervisor, loading start/complete on
VPLoading). But there is **zero server module, zero route, zero permission
key, and zero web feature** for either — confirmed by grepping
`apps/server/src/modules/`, `apps/web/features/`, and
`packages/types/src/permissions.ts`.

Reference: the old ERP's confirmed GRN-pending SQL rule (from its own
`LLM.md` + restored DB) is: LR is active, not cancelled, finalised, assigned
to the selected rail-head, transport type includes rail, and no active GRN
row exists yet for it. Once GRN is created, the LR drops off that pending
list. The new schema's design already anticipated this — this doc just wires
the workflow up.

## Dependency chain (confirmed from schema FKs, not assumed)

```
LorryReceipt (FINALISED, transportType Rail|RoadAndRail, railheadBranchId set)
        │
        ▼
      GRN   (1:1 via GRN.lorryReceiptId @unique)   status: DRAFT → SUBMITTED
        │
        ▼
   VPLoading  (grnId is a required, non-nullable FK — GRN is a hard
               prerequisite, not just a business rule)
        status: DRAFT → LOADED
```

Priority: **GRN first, then VPLoading** — VPLoading is schema-impossible
without a GRN row.

## Decisions locked

1. No schema changes needed for either model — both are already complete.
2. GRN's "branch" for scoping/numbering is derived through
   `LorryReceipt.railheadBranchId` — GRN has no branch FK of its own.
3. VPLoading is meaningless without MRRR/wagon-row context, so it does **not**
   get a standalone primary list screen — it's a per-row action inside the
   existing MRRR detail screen, with a secondary read-only list for audit.
4. Server enforces `GRN.status === "SUBMITTED"` and FK consistency
   (`GRN.lorryReceiptId` matches) at VPLoading-create time rather than
   trusting the Prisma FK alone.
5. Both new modules follow the `apps/server/src/modules/mrrr/` shape (pending
   list → CRUD → bespoke submit/complete/cancel actions), not the generic
   `createCrudRouter` factory — these are lifecycle actions on an existing LR,
   not standalone CRUD masters.

## Phase 1 — GRN

### Validators — `packages/validators/src/grn/grn.schema.ts`

- `createGRNSchema` — `{ lorryReceiptId, gateNo?, inDateTime?, outDateTime?,
  goods?: [{ lrGoodsId?, goodsName, description?, totalQty, unit?, weight? }]
  }`. If `goods` is omitted, the service seeds `GRNGoods` 1:1 from the LR's
  `LRGoods` (same copy-on-create convention as `lr-group`).
- `updateGRNSchema` — gate times, per-line qty received/damage/shortage,
  freight settlement inputs (`totalFreight`, `balanceFreight`, `freightPerMt`,
  `detentionDays`, `detentionRate`, `advanceAmount`, `damageAmount`,
  `tdsAmount`, `hamaliAmount`, `printingStationaryAmount`), `labourId` +
  `labourCharge`, `unloadingSupervisorId`, `damagesBy`, the 5 checklist
  booleans + their paired remark strings.
- `submitGRNSchema` — final remarks only; checklist/freight fields must
  already be present on the record (validated server-side).
- `cancelGRNSchema` — `{ cancelReason }`.
- Export from `packages/validators/src/index.ts` and add a `"./grn"` subpath
  export in its `package.json` (matches the newer module convention used by
  `lorry-receipt`/`lr-group`/`attachments`).

### Server — `apps/server/src/modules/grn/{grn.route.ts, grn.service.ts}`

`grn.service.ts`: `grnListSelect`, `grnDetailInclude`, `generateGRNNumber`
(reuse `_shared` doc-number helpers, branch code from
`lorryReceipt.railheadBranch.branchCode`), `computeGRNTotals`
(`grossTotal`/`netAmount` math), `seedGRNGoodsFromLR`.

Routes, mirroring `mrrr.route.ts`:

- `GET /grn/pending-lorry-receipts` — the pending list. `can(PERMS.GRN.CREATE)`.
  `where: { deletedAt: null, status: "FINALISED", transportType: { in:
  ["Rail","RoadAndRail"] }, railheadBranchId: <branch-scoped>, grn: null }`.
- `GET /grn` — list, filter by `status`.
- `GET /grn/:id` — detail (`grnDetailInclude`: lorryReceipt + goods + labour +
  unloadingSupervisor).
- `POST /grn` — create DRAFT. Eligibility reads (LR finalised, rail-capable,
  no existing GRN) happen against `db` **before** the transaction; the
  transaction only creates `GRN` + `GRNGoods` (minimal `select`); full detail
  is re-fetched after commit — per CLAUDE.md's "Database transactions" shape,
  same pattern as `lr-group` create.
- `PATCH /grn/:id` — update, DRAFT only.
- `POST /grn/:id/submit` — validates the 5-item checklist + required freight
  fields are present, computes `netAmount`, sets `status: "SUBMITTED"`.
- `POST /grn/:id/cancel` — DRAFT or SUBMITTED → CANCELLED; **blocked if any
  non-cancelled `VPLoading` already references this GRN**.
- `DELETE /grn/:id` — soft-delete, DRAFT only.

New permission block in `packages/types/src/permissions.ts` (next to `MRRR`):

```ts
GRN: {
  VIEW: "grn.view",
  CREATE: "grn.create",
  UPDATE: "grn.update",
  DELETE: "grn.delete",
  SUBMIT: "grn.submit",
  CANCEL: "grn.cancel",
},
```

Mount in `apps/server/src/index.ts`: `app.use("/grn", grnRoute)`, next to the
`mrrr` mount. Seed `masters.grn`-style permission keys in
`apps/server/prisma/seed-admin.ts` (actually `grn.*`, matching the block
above — not a master, but seeded the same way).

### Web — `apps/web/features/grn/`

`grn.service.ts`, `grn.keys.ts`, `GRNListPage.tsx`, `GRNDetail.tsx`,
`components/GRNForm.tsx` (gate times, freight settlement block, document
checklist with paired remarks), `components/GRNGoodsTable.tsx`,
`components/PendingLRPickerDialog.tsx` (backs the pending-list endpoint),
`components/SubmitGRNDialog.tsx`, `components/CancelGRNDialog.tsx`. Add a
"Create GRN" action to `apps/web/features/lorry-receipts/LRDetail.tsx`,
visible only when the LR is FINALISED, rail-eligible, and has no GRN yet.

## Phase 2 — VP-Loading

### Validators — `packages/validators/src/vp-loading/vp-loading.schema.ts`

- `createVPLoadingSchema` — `{ mrRrId, mrRrRowId, lorryReceiptId, grnId,
  gateNo?, loadedQty, loadedCft?, loadedWeightMt?, labourId?, labourCharge?,
  loadingSupervisorId?, loadingStartedAt? }`.
- `updateVPLoadingSchema` — DRAFT-only field updates.
- `completeVPLoadingSchema` — `{ loadingCompletedAt? }` (defaults to now).
- `cancelVPLoadingSchema` — `{ cancelReason }`.
- Export from root index; add a `"./vp-loading"` subpath export.

### Server — `apps/server/src/modules/vp-loading/{vp-loading.route.ts, vp-loading.service.ts}`

- `GET /vp-loadings/pending-rows?mrRrId=` — MRRR rows not yet fully loaded,
  cross-referenced with LRs that have a `SUBMITTED` GRN at the same rail-head
  and aren't already loaded on this row. `@@unique([mrRrRowId,
  lorryReceiptId])` already enforces one loading-record per row+LR pair (a
  wagon row can carry multiple LRs — real LTL rail loading).
- `GET /vp-loadings` — list, filter by `vpScheduleId`/`mrRrId`/`status`.
- `GET /vp-loadings/:id` — detail.
- `POST /vp-loadings` — create DRAFT. Before the transaction, validate
  `GRN.status === "SUBMITTED"` and `GRN.lorryReceiptId === lorryReceiptId`
  (don't just trust the FK), and `MRRRRow.mrRrId === mrRrId`. Branch access
  via `assertBranchAccess(req, vpSchedule.fromBranchId)` — the VPSchedule's
  `fromBranchId` *is* the rail-head branch GRN was scoped to.
- `PATCH /vp-loadings/:id` — DRAFT only.
- `POST /vp-loadings/:id/complete` — sets `loadingStartedAt` (if still null)
  + `loadingCompletedAt = now`, `status: "LOADED"`.
- `POST /vp-loadings/:id/cancel` — DRAFT or LOADED → CANCELLED with
  `cancelReason`.
- `DELETE /vp-loadings/:id` — soft-delete, DRAFT only.

New permission block (next to `VP_SCHEDULE`/`MRRR`):

```ts
VP_LOADING: {
  VIEW: "vp_loading.view",
  CREATE: "vp_loading.create",
  UPDATE: "vp_loading.update",
  DELETE: "vp_loading.delete",
  COMPLETE: "vp_loading.complete",
  CANCEL: "vp_loading.cancel",
},
```

Mount: `app.use("/vp-loadings", vpLoadingRoute)`, next to `/mrrr`.

### Web

New `apps/web/features/vp-loading/` folder (`vp-loading.service.ts`,
`vp-loading.keys.ts`, `components/VPLoadingDialog.tsx`,
`components/LRGRNPickerDialog.tsx`), surfaced as a per-row **"Load" action
inside the existing MRRR detail screen** (`apps/web/features/mrrr/`), not as a
standalone primary entry point. A secondary read-only `/vp-loadings` list is
still useful for audit.

## Verification

- `pnpm --filter @skerp/validators build`, `pnpm --filter @skerp/server
  check-types`, `pnpm --filter @skerp/web check-types`.
- Manually exercise: finalise a `RoadAndRail` LR at a rail-head branch → it
  appears in `GET /grn/pending-lorry-receipts` → create + submit a GRN → LR
  drops off the pending list → create a VP-Loading against that GRN's LR +
  the right MRRR row → complete it → confirm cancel-guards (cancelling a
  SUBMITTED GRN with an active VPLoading is blocked).

## Open items (flagged, not designed here)

- Whether an MRRR row must be `SUBMITTED` before VPLoading can start against
  it, or loading can begin while MRRR is still `DRAFT` — not pinned by
  existing code or legacy notes gathered so far; confirm operationally before
  building the VPLoading "pending rows" guard condition.
- Damage/Depot-GRN (`DGRN` in the legacy system) — legacy has a second,
  parallel GRN-shaped flow that this plan does not cover; revisit if the new
  system needs an equivalent depot-side receipt step distinct from rail-head
  GRN.
