# LR Delivery & Acknowledgement — plan

Status: agreed in grilling session 2026-07-10 (niranjan) — ready for implementation
Branch: `ERP-44/LR_Delivery_Acknowledgement`
Related: [LR_HUB_RAILHEAD_PLAN.md](./LR_HUB_RAILHEAD_PLAN.md) — **this plan amends its
"split at hub" action** (see §5).

## 1. Why

Two gaps vs the legacy ERP (`SK_Logistics`):

1. **No delivery concept at all.** Legacy had a two-stage post-transit flow —
   *Delivered* (`Delivered.aspx` / `LGST_LRDelivered`: delivery + reporting
   date/time, remark, unloading charges) and *LR Acknowledgement*
   (`LGST_LRAcknowledgment[Items|Uploads]`: POD paper returned by courier, with
   detention, damage, per-item received/damaged qty, scan uploads). The new ERP
   stops at FINALISED.
2. **Trips close blind.** `POST /trips/:id/close` only checks
   `status === "InTransit"` — a trip closes with its LRs never delivered, and
   the LR hangs forever. This is the reported bug.

We are not cloning legacy; the improvements are: POD photo at the point of
delivery, receiver identity, trip-close gating, hub-aware lifecycle, aging
worklists, bulk actions, timeline, and notifications.

## 2. Lifecycle (target)

Per **LorryReceipt** (`LRStatus` gains two values):

```
DRAFT → FINALISED → DELIVERED → ACKNOWLEDGED
            └→ CANCELLED
```

- **DELIVERED** — goods handed to consignee. Set by creating an `LRDelivery`
  record; the record is the source of truth, the status is the cheap queryable
  flag. Undoing (deleting) the record reverts status to FINALISED (gated, §6).
- **ACKNOWLEDGED** — signed POD paper is back at the booking branch. Set by
  creating an `LRAcknowledgement` record. Designed as the future billing gate
  (billing itself out of scope here).

**"At hub"** is *not* an LR status — it is a derived, group-level display state:
`group.hubId != null && group.secondaryTripId == null` (goods lying at Jalgaon
awaiting leg 2).

Group-level display status stays derived too — `LRGroupStatus` is untouched.
A group renders "Delivered" when every non-cancelled LR in it is DELIVERED.

## 3. Decisions from the grilling (with rationale)

| # | Decision | Choice |
|---|---|---|
| 1 | Delivery granularity | **Per LR** (matches legacy; supports multiple unloading points/dates and per-LR damage). Group status derived. |
| 2 | Status model | **DELIVERED + ACKNOWLEDGED enum values, each backed by a record table.** Delete record ⇒ status reverts. |
| 3 | Trip-close gating | **"Way 1" — gate the final leg only** (§4). Hub leg-1 closes freely; LR shows in "at hub" worklist. |
| 4 | Delivery form | Legacy fields **+ receiver name/phone + optional POD photo** (Attachment `entityType: "lr-delivery"`). Item quantities stay at ack stage. |
| 5 | Acknowledgement | **Full legacy ack**: received date, courier docket/name/charge, detention days+amount, damage amount, per-item received/damaged qty, remark, scan uploads (`entityType: "lr-acknowledgement"`). Pending-POD worklist with aging. |
| 6 | Permissions | **Branch-scoped**: `lorry_receipt.deliver` checked against the LR group's **destination** branch; `lorry_receipt.acknowledge` against the **origin** (booking) branch. All-branch users unrestricted. |
| 7 | Corrections | **Edit always (audited); undo gated** — delivery cannot be undone once the final trip is Closed (admin must reopen trip first). Ack undo free while no bill references it. |
| 8 | Market vehicles | No trip ⇒ no close gate; covered by the **pending-delivery worklist with aging** alongside fleet LRs. |
| 9 | UX extras (all in) | LR lifecycle timeline, bulk deliver per group, in-app notifications, dashboard stats cards. |

## 4. The trip-close gate ("Way 1")

**Final trip of a group** = `secondaryTripId ?? primaryTripId`. Market-vehicle
groups have neither ⇒ never gate.

On `POST /trips/:id/close` (before opening the transaction, per the
transaction guidance in CLAUDE.md):

```
blockers = LRGroups where deletedAt = null, status = FINALISED
           and finalTrip == closingTrip
           and NOT heldAtHub(group)            // hubId set, secondaryTripId null
           and ∃ LR in group with status = FINALISED (i.e. not DELIVERED/CANCELLED)
```

If `blockers` non-empty ⇒ `BadRequestError` listing the LR numbers:
*"Cannot close trip — 3 LRs not delivered: LR-1042, …. Mark them delivered
or hold the group at hub."*

Cases this yields:

- **Direct trip** (leg = final): blocked until every LR is DELIVERED. Bug fixed.
- **Hub leg 1**: the group is first put in *held-at-hub* (§5) ⇒ close allowed
  even though LRs are FINALISED.
- **Hub leg 2** (`secondaryTripId == closingTrip`): blocked until DELIVERED.
- **Journey legs** use the same shared close path — apply the gate in both the
  journey-leg and legacy branches of the close route.

## 5. Amendment to the hub plan: split becomes two actions

The hub plan's single `split-at-hub` action creates an ordering paradox with
the gate: HO closes leg 1 *before* the leg-2 trip exists, but until the split
happens the leg-1 trip **is** the group's final trip ⇒ close would be blocked.
Fix: decompose the split.

1. **`POST /lr-groups/:id/hold-at-hub`** — HO-gated. On a FINALISED group:
   looks up the `isHeadOffice` branch, sets `hubId`, `hubArrivalAt = now()`.
   From this moment the group is exempt from the close gate (goods are
   accounted for: lying at Jalgaon) and appears in the **"At hub — awaiting
   leg 2"** worklist. Run before or right after closing leg 1.
2. **`POST /lr-groups/:id/dispatch-from-hub`** — body `{ secondaryTripId }`.
   Sets `secondaryTripId`, `tripLegType = FROM_HUB`. Group leaves the at-hub
   worklist; leg 2 is now the final trip and carries the gate.

Everything else in the hub plan (railhead vs hub separation, `isHeadOffice`,
validator changes) stands. Note: trip/hub/railhead fields live on **LRGroup**,
not LorryReceipt — the hub doc predates that refactor; endpoints above are
group-level.

## 6. Schema

```prisma
model LRDelivery {
  id               String    @id @default(cuid())
  lrId             String    @unique
  lr               LorryReceipt @relation(fields: [lrId], references: [id])
  deliveredAt      DateTime            // date+time goods handed over
  reportedAt       DateTime?           // truck arrival at consignee (detention basis)
  receiverName     String?
  receiverPhone    String?
  unloadingCharges BigInt?             // paise
  remark           String?
  createdById      String
  updatedById      String?
  createdBy        User      @relation("CreatedLRDelivery", ...)
  updatedBy        User?     @relation("UpdatedLRDelivery", ...)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  version          Int       @default(1)
}

model LRAcknowledgement {
  id              String    @id @default(cuid())
  lrId            String    @unique
  lr              LorryReceipt @relation(fields: [lrId], references: [id])
  receivedAt      DateTime            // POD paper received back
  courierName     String?
  courierDocketNo String?
  courierCharge   BigInt?             // paise
  detentionDays   Int?
  detentionAmount BigInt?
  damageAmount    BigInt?
  remark          String?
  items           LRAcknowledgementItem[]
  // + same audit fields as LRDelivery
}

model LRAcknowledgementItem {
  id          String  @id @default(cuid())
  ackId       String
  ack         LRAcknowledgement @relation(fields: [ackId], references: [id], onDelete: Cascade)
  lrGoodsId   String
  goods       LRGoods @relation(fields: [lrGoodsId], references: [id])
  receivedQty Decimal?
  damagedQty  Decimal?
  @@unique([ackId, lrGoodsId])
}
```

Plus:

- `enum LRStatus` += `DELIVERED`, `ACKNOWLEDGED`.
- `LRGroup.hubArrivalAt DateTime?` (with existing `hubId`, drives the at-hub
  state + aging).
- Uploads reuse the generic `Attachment` model (`entityType`
  `"lr-delivery"` / `"lr-acknowledgement"`, `entityId` = record id). No new
  file tables (legacy needed `LRAcknowledgmentUploads`; we don't).

Money in paise (`BigInt`) per repo convention. No backfill needed — module
still pre-production (same stance as the hub plan).

## 7. Server endpoints

All in `modules/lorry-receipt/` + `modules/lr-group/`; Zod schemas in
`packages/validators/src/lorry-receipt/` (new `delivery.schema.ts`,
`acknowledgement.schema.ts` + subpath exports); reads/validation outside the
transaction, writes inside, per CLAUDE.md.

| Endpoint | Perm | Notes |
|---|---|---|
| `POST /lorry-receipts/:id/deliver` | `lorry_receipt.deliver` | LR must be FINALISED. Branch check vs group **destination** branch. Creates `LRDelivery`, sets status DELIVERED. |
| `PATCH /lorry-receipts/:id/delivery` | `lorry_receipt.deliver` | Edit details anytime (audited). Never touches status. |
| `POST /lorry-receipts/:id/undo-delivery` | `lorry_receipt.deliver` | **Rejected if final trip is Closed.** Deletes record, reverts to FINALISED. Also rejected if ack exists (undo ack first). |
| `POST /lorry-receipts/:id/acknowledge` | `lorry_receipt.acknowledge` | LR must be DELIVERED. Branch check vs group **origin** branch. Creates record + items, sets ACKNOWLEDGED. |
| `PATCH /lorry-receipts/:id/acknowledgement` | `lorry_receipt.acknowledge` | Edit anytime. |
| `POST /lorry-receipts/:id/undo-acknowledgement` | `lorry_receipt.acknowledge` | Free until billing exists; reverts to DELIVERED. |
| `POST /lr-groups/:id/deliver-all` | `lorry_receipt.deliver` | Bulk: shared defaults + per-LR overrides; creates per-LR `LRDelivery` rows in one transaction. |
| `POST /lr-groups/:id/hold-at-hub` | HO-gated (hub perm, see hub plan) | §5. |
| `POST /lr-groups/:id/dispatch-from-hub` | HO-gated | §5, body `{ secondaryTripId }`. |
| `GET /lorry-receipts/worklists/pending-delivery` | `lorry_receipt.view` | FINALISED LRs on dispatched groups (fleet + market), branch-filtered, sorted by age. |
| `GET /lr-groups/worklists/at-hub` | `lorry_receipt.view` | Held-at-hub groups + days at hub. |
| `GET /lorry-receipts/worklists/pending-pod` | `lorry_receipt.view` | DELIVERED not ACKNOWLEDGED + days since delivery. |
| `POST /trips/:id/close` (existing) | `trip.close` | Add the §4 gate to both close branches. |

New permission keys in `packages/types/src/permissions.ts` under
`LORRY_RECEIPT`: `DELIVER: "lorry_receipt.deliver"`,
`ACKNOWLEDGE: "lorry_receipt.acknowledge"` (+ seed in `seed-admin.ts`:
Admin + Branch Manager + Operations get deliver; Admin + Accounts get
acknowledge — confirm role mapping at seed time).

`lrListSelect` / detail include: add `delivery`, `acknowledgement` (minimal
selects) so lists can render status chips and aging without N+1.

## 8. Web

Feature folder `apps/web/features/lorry-receipts/` (existing):

- **Deliver dialog** — from LR detail + row action. RHF + zodResolver on the
  shared schema; POD photo via existing attachment uploader.
- **Bulk deliver dialog** — from group/trip view: shared date/receiver at top,
  per-LR editable rows beneath.
- **Acknowledge dialog** — courier + detention + damage + per-item qty grid
  (prefilled from LRGoods qty) + scan upload.
- **Worklists page** — one "Deliveries" screen with tabs: *Pending delivery* /
  *At hub* / *Pending POD*. Aging column, overdue rows highlighted
  (`text-destructive`), click-through to LR. Uses `MasterTable`-style
  primitives, Skeleton loaders, shared Pagination.
- **LR lifecycle timeline** on LR detail: Created → Finalised → Dispatched →
  (Held at hub → Dispatched from hub) → Delivered → POD received; each step
  with actor + timestamp, sourced from the records (no new event table needed
  for phase 1).
- **Trip close dialog**: on gate failure, render the blocker LR list from the
  API error and link each LR.
- **Dashboard cards**: In transit / At hub / Pending POD counts + average
  delivery days; each card links to its worklist tab.

## 9. Notifications (existing notifications module)

Seeded templates + recipients rules:

- **LR delivered** → notify origin branch users (event-driven, on deliver).
- **At hub > N days** → notify HO (scheduled sweep via the existing worker).
- **POD pending > N days** → notify origin-branch accounts (scheduled sweep).

N configurable via notification seed defaults (start: 3 days hub, 7 days POD).

## 10. Build order

1. Schema + migration + validators + types (LRStatus values, two models, item
   table, `hubArrivalAt`).
2. Deliver / edit / undo endpoints + perms + seed.
3. Acknowledge / edit / undo endpoints + items.
4. Trip-close gate + hold-at-hub / dispatch-from-hub (touches trip + lr-group
   modules) — with the gate error format the UI needs.
5. Web dialogs (deliver, bulk deliver, acknowledge) + status chips.
6. Worklists page + dashboard cards + timeline.
7. Notification templates + sweeps.

Each step leaves the app consistent; the gate (step 4) must not ship before
step 2, or no trip could ever close.

## 11. Out of scope (explicitly)

- Billing/bill generation (ack is designed as its future gate).
- Customer-facing POD portal / e-signature.
- DC (Delivery Challan) acknowledgement flow from legacy — separate feature.
- Reopening closed trips UX (admin path assumed to exist / be added later).
