# Road + Rail: developer notes

> Last checked: 2026-10-10 · Before this: [Orders and LR](03-orders-and-lr.md) · Business view: [ERP flow §2](../../00-overview/erp-flow.md)

## Purpose

A **Road + Rail** LR travels in 3 parts:

1. **First mile (road):** a truck takes the goods from the customer to the **origin railhead**.
2. **Rail:** the goods go into **wagons**, and the wagons travel together as one **rake** to the **destination railhead**.
3. **Last mile (road):** a **Delivery Challan (DC)** puts the goods on a delivery truck to the consignee.

The road flow (Order → LR group → trip → delivery) is the same as in [Orders and LR](03-orders-and-lr.md). This page covers everything from the railhead GRN to the delivery challan.

## The flow, in the order the work happens

```
 ORIGIN BRANCH / RAILHEAD
 ────────────────────────
 LR (RoadAndRail, FINALISED) ── truck reaches railhead
     ▼
 ① GRN at Rail Head (1 per LR) ──────────────┐
                                             │
 ② VP Schedule (date, route, wagon counts)   │
     │ confirm → PLANNED                     │
     ▼                                       │
 ③ MR/RR (1 row per wagon: VP no, RR, seal)  │
     │ submit → schedule MRRR_CREATED        │
     ▼                                       ▼
 ④ VP Loading: put GRN goods into each wagon (VP)
     │ every wagon "Loaded" → schedule LOADED
     │ finalise → schedule FINALISED, creates ⑤
     ▼
 ⑤ Rail Rake (1 per schedule)
     │ Rake at Rail Head: time + demurrage/wharfage
     ▼
 ════════════ train travels ════════════
     ▼
 DESTINATION BRANCH
 ──────────────────
 ⑥ Rake at Branch: time + demurrage/wharfage
 ⑦ GRN at Branch (1 per wagon)
     │ first submit → rake UNLOADING
     │ last wagon   → rake RECEIVED
     ▼
 ⑧ Delivery Challan (truck to consignee)
     │ issue → ISSUED
     ▼
 ⑨ LR Delivered → Acknowledged → Billed
```

① and ②/③ run **in parallel**. Goods can be received at the railhead before or after the schedule is planned. They meet at ④.

## Data model: how one LR's goods move through the tables

Follow one goods line from the LR to the delivery truck:

```
LorryReceipt ─► LRGoods
                  │
GRN (1:1 LR) ─► GRNGoods ............................ received at origin railhead
                  │
                  ▼
VPSchedule ─► VPScheduleWagonCount (wagon type × count, freight)
   │ 1:1
   ▼
MRRR ─► MRRRRow (1 per physical wagon: vpNo, mrRrNo, sealNo)
            │ 1:1
            ▼
        VPWagonLoading (1 per wagon: gate, labour, capacity check)
            │ 1:N
            ▼
        VPLoading (GRN × wagon) ─► VPLoadingGoods (qty of one GRNGoods line in this wagon)
                                       │ 1:1
VPSchedule ─1:1─► RailRake             │
                    │ 1:N              ▼
                    └──► RailBranchGRN (1 per wagon) ─► RailBranchGRNItem (received / damage / shortage)
                    │                                        │ 1:N (qty can be split)
                    └──► DeliveryChallan ─► DeliveryChallanItem
```

**Key idea:** quantities are tracked **per goods line, per wagon**. One LR can be split across several wagons, and then across several delivery challans. Each table only holds its own part of the quantity.

| Table | What it holds | Key rules |
|---|---|---|
| `Wagon` (master) | Wagon type: size, `totalCft`, `capacityMt` | |
| `RailwayFreightMatrix` (master) | Rail freight per **wagon type + source city/area + destination city/area** | Used to price the schedule |
| `Labour` (master) | Labour leaders and **supervisors**, per branch | GRN, VP Loading, Branch GRN and DC pick their supervisor from here |
| `BranchRailheadArea` (master) | Which **areas** (railheads) a branch manages | Schedule areas must belong to the from/to branch |
| `VPSchedule` | Planned rake: date, from/to branch, source/destination railhead area, totals | Only one schedule per date + route (checked in code) |
| `VPScheduleWagonCount` | Wagon type × count, with freight from the matrix | Freight = matrix amount × count |
| `MRRR`, `MRRRRow` | Railway Receipt data, **one row per wagon** (`rowLabel`, `sequenceNo`, `vpNo`, `mrRrNo`, `sealNo`) | `rakeType` = `INDENT` or `LEASE` |
| `GRN`, `GRNGoods` | Goods received at the **origin railhead**, one GRN per LR. Gate no., labour, checklist, damage photos, first-mile truck money | `lorryReceiptId @unique` |
| `VPWagonLoading` | Loading of one wagon: gate, labour + charge, supervisor, capacity check | `mrRrRowId @unique` |
| `VPLoading`, `VPLoadingGoods` | Which GRN goods went into which wagon, and how many | `@@unique([vpWagonLoadingId, grnId])` |
| `OneLapTracker`, `OneLapTrackerAssignment` | GPS tracker fitted on **one wagon** of the rake | One active tracker per schedule |
| `RailRake` | The rake: `rakeNumber`, `railwayRakeNumber`, status, times | `vpScheduleId @unique` |
| `RailRakeOperation` (+ `Placement`, `Charge`, `ChargeWaiver`, `ChargePayment`) | Rake time at a station, and **demurrage / wharfage** | One per rake per stage (`ORIGIN_RAILHEAD`, `DESTINATION_BRANCH`) |
| `RailBranchGRN`, `RailBranchGRNItem` | Goods received **from one wagon** at the destination | `vpWagonLoadingId @unique`; one item per `VPLoadingGoods` |
| `DeliveryChallan`, `DeliveryChallanItem` | Last-mile truck: own / market, freight, advance, which goods and how many | Scoped to **one rake** and **one consignee** |

## Statuses

| Document | Statuses | What moves it |
|---|---|---|
| `GRN` (railhead) | DRAFT → SUBMITTED (+ CANCELLED) | Submit / cancel buttons |
| `VPSchedule` | DRAFT → PLANNED → MRRR_CREATED → LOADING → LOADED → FINALISED (+ CANCELLED) | Confirm → MR/RR submit → **automatic** from wagon progress (`recalculateVpScheduleLoadingStatus`) → finalise |
| `MRRR` | DRAFT → SUBMITTED (+ CANCELLED) | Submit / cancel |
| `VPWagonLoading` | DRAFT → IN_PROGRESS → COMPLETED (+ CANCELLED) | First allocation → "Mark loaded" (can reopen to IN_PROGRESS) |
| `VPLoading` (allocation) | DRAFT → LOADED (+ CANCELLED) | |
| `RailRake` | CREATED → UNLOADING → RECEIVED | Created at finalise → first Branch GRN submitted → last wagon's Branch GRN submitted |
| `RailRakeOperation` | DRAFT → SUBMITTED (+ CANCELLED) | |
| `RailRakeCharge` | DRAFT → ASSESSED → PARTIALLY_SETTLED → SETTLED / WAIVED (+ CANCELLED) | |
| `RailBranchGRN` | DRAFT → SUBMITTED | |
| `DeliveryChallan` | DRAFT → ISSUED (+ CANCELLED) | |

⚠ **Not used yet (known gaps):**
- `RailRake.DISPATCHED` exists, but **nothing sets it**. A rake goes straight from CREATED to UNLOADING. `dispatchedAt` / `dispatchedById` stay empty.
- `VPWagonLoading.VERIFIED` and `VPSchedule.VERIFIED` exist, and so does the permission `vp_loading.verify`, but **no endpoint sets them**.

## Step by step: screen → API → rules

Base paths are registered in `apps/server/src/index.ts`.

### ① GRN at Rail Head: `/grn` (`modules/grn`)

| Action | API | Rules |
|---|---|---|
| Pick LR | `GET /grn/eligible-lrs` | LR is **FINALISED**, its group is FINALISED and `transportType = RoadAndRail`, no GRN yet, and the LR group's **railhead branch** is one the user can access |
| Preview | `GET /grn/preview/:lrId` | Fills goods from the LR, and the first-mile truck money from the LR group's `market*` fields |
| Create / edit | `POST /grn`, `PUT /grn/:id` | Total quantity per line **must equal** the LR goods quantity. Supervisor must be from the Labour master of an allowed branch. The LR can't be changed after create |
| Submit | `POST /grn/:id/submit` | Needs received goods. **Damage qty > 0 needs a damage photo** (image, under 2 MB, upload finished and marked clean) |
| Cancel | `POST /grn/:id/cancel` | Not allowed once any VP Loading uses this GRN |
| Print | `GET /grn/:id/pdf`, `/print-preview` | |

**Money on the GRN (first-mile market truck):** `netAmount = totalFreight + detentionAmount − (advance + damage + TDS + hamali + printing/stationery)`, computed in `grn.service.ts`.
⚠ The same ERP-58 doubling as the LR (group amounts × number of LRs) shows in this preview.

### ② VP Schedule: `/vp-schedules` (`modules/vp-schedule`)

| Action | API | Rules |
|---|---|---|
| Freight preview | `POST /vp-schedules/freight-preview` | Looks up `RailwayFreightMatrix` per wagon type for the route |
| Create / edit | `POST /`, `PATCH /:id` | Source and destination areas must be marked **Rail Head** and must belong to the from / to branch (`BranchRailheadArea`). **Only one schedule per date + branch route + area route.** Edit only in DRAFT. Uses `version` (optimistic lock: "changed in another tab") |
| Confirm | `POST /:id/confirm` | DRAFT only, at least one wagon → **PLANNED** |
| Cancel / delete | `POST /:id/cancel`, `DELETE /:id` | Cancel only in DRAFT or PLANNED |

### ③ MR/RR: `/mrrr` (`modules/mrrr`)

| Action | API | Rules |
|---|---|---|
| Pick schedule | `GET /mrrr/vp-schedules`, `/vp-schedules/:id/preview` | Only **PLANNED** schedules |
| Create | `POST /mrrr` | One MR/RR per schedule. It creates **one row per wagon** from the wagon counts (e.g. 2 × BCN + 1 × BCNA gives 3 rows) |
| Edit rows | `PATCH /:id`, `PATCH /:id/rows` | DRAFT only |
| Submit | `POST /:id/submit` | Every row needs **Sequence No, VP No, MR/RR No and Seal No**. Schedule → **MRRR_CREATED** |
| Cancel / delete | `POST /:id/cancel`, `DELETE /:id` | Cancel only before any VP Loading exists (schedule goes back to PLANNED). A submitted MR/RR can't be deleted |

### ④ VP Loading: `/vp-loading` (`modules/vp-loading`)

The biggest module (about 3,700 lines). Work is done **per wagon** (one MR/RR row = one VP).

| Action | API | Rules |
|---|---|---|
| Schedule list | `GET /vp-loading/schedules`, `/wagons` | Schedules in MRRR_CREATED … LOADED |
| Eligible GRNs | `GET /schedules/:id/eligible-grns` | GRN is **SUBMITTED**, has a gate no., is a RoadAndRail LR, and its railhead and destination match the schedule's **branch and area route**. Redis-cached per route (`vp-loading.cache.ts`) |
| Load goods into a wagon | `POST /rows/:mrrrRowId/allocations` | MR/RR row must have a VP No. **Gate lock:** the first GRN fixes the wagon's gate, and GRNs from another gate are refused. Loaded qty ≤ available qty, damage ≤ loaded, and each goods line only once. Wagon → IN_PROGRESS, schedule → LOADING |
| Edit / cancel allocation | `PATCH /allocations/:id`, `POST /allocations/:id/cancel` | Only while the wagon is IN_PROGRESS |
| Labour | `PATCH /wagons/:id/labour` | Hamali for the wagon (`labourId`, `labourCharge`) |
| Mark loaded | `POST /wagons/:id/complete` | Needs at least one loaded allocation, and all of them loaded → COMPLETED. Can be reopened. When **every** wagon is COMPLETED the schedule becomes **LOADED** |
| Capacity | — | ⚠ **Not built yet.** The columns (`capacityCheckStatus`, `capacityOverride*`) and the permission `vp_loading.capacity_override` exist, but the status always stays `NOT_CHECKED`. Nothing stops an overloaded wagon |
| Tracker | `GET/POST /schedules/:id/tracker-assignment` (+ `/replace`, `/release`, `/available-trackers`) | Needs a submitted MR/RR and a host wagon with a VP No. One active tracker per schedule. Can't be changed once the rake journey has started (use **replace**). Released automatically when the rake is RECEIVED |
| Final review | `GET /schedules/:id/final-review` | |
| **Finalise** | `POST /schedules/:id/finalise` (`vp_loading.complete`) | Schedule LOADED, every MR/RR row has a VP No and a COMPLETED wagon. In one transaction: creates **RailRake** `RK/<fromBranch>/<toBranch>/<FY>/00001` (`nextSequence(..., "RAIL_RAKE")`) and sets the schedule to **FINALISED** |

### ⑤ / ⑥ Rail Rake and Rake operations: `/rail-rakes`, `/rail-rake-operations`

| Action | API | Rules |
|---|---|---|
| Rake list / detail | `GET /rail-rakes`, `/:rakeId`, `/incoming` (for the destination branch) | Read only. No dispatch endpoint (see gaps) |
| Wagons available for Branch GRN | `GET /:rakeId/available-vps`, `/:rakeId/vps/:vpWagonLoadingId/preview` | Wagons that are loaded and have no Branch GRN yet |
| Rake at Rail Head / at Branch | `POST /rail-rake-operations`, `PATCH /:id`, `POST /:id/submit` | One operation per rake per stage. Branch and area come from the stage. Permission is per stage (`rake_at_rail_head.*` or `rake_at_branch.*`) |
| Calculate charges | `POST /rail-rake-operations/calculate` | **Placements:** placed → removed time, free minutes, chargeable minutes. **Demurrage** = Σ ceil(chargeable minutes / 60) × rate per hour, or a manual amount. **Wharfage** = manual amount. A waiver (APPROVED or RECEIVED) reduces demurrage. Money is in paise |
| Submit | `POST /:id/submit` | Needs arrival and departure, every placement removed, and both DEMURRAGE and WHARFAGE records |

### ⑦ GRN at Branch: `/rail-branch-grns` (`modules/rail-branch-grn`)

| Action | API | Rules |
|---|---|---|
| Preview / create | `GET /preview`, `POST /` | **One Branch GRN per wagon.** The rake must not be RECEIVED yet. The wagon must belong to the rake and have loaded goods. Every loaded goods line must appear **exactly once** |
| Edit | `PATCH /:id` | For each line: **received + shortage = loaded**, damage ≤ received. A reason is needed for damage or shortage. Damage needs "damages by" and a photo |
| Submit | `POST /:id/submit` | Labour ≥ 1, labour charge and unloading supervisor (destination branch Labour master) are required. **Rake status:** the first submitted wagon gives UNLOADING, all wagons submitted gives **RECEIVED** (and releases the tracker) |
| Delete | `DELETE /:id` | DRAFT only |

### ⑧ Delivery Challan: `/delivery-challans` (`modules/delivery-challan`)

| Action | API | Rules |
|---|---|---|
| Options | `GET /options/rakes`, `/options/vps`, `/options/supervisors`, `/options/transports`, `/options/vehicles` | Rakes with at least one SUBMITTED Branch GRN |
| Create / edit | `POST /`, `PATCH /:id` | **One rake and one consignee per challan.** Items can come from **any** wagon of the rake, so an LR split across wagons can go back on one truck. Qty ≤ **pending** (Branch GRN received − already on other non-cancelled challans). Destination must be the consignee's location |
| Vehicle | (in body) | `OWN` needs a registered vehicle. `MARKET` needs a transporter and a vehicle (registered, or a typed number). The enum also has `CLIENT_DELIVERY`, but no code uses it. Freight ≥ 0, advance ≤ freight |
| Issue | `POST /:id/issue` | Re-checks pending qty inside the transaction → **ISSUED** |
| Cancel / delete | `POST /:id/cancel`, `DELETE /:id` | Delete only in DRAFT |

### ⑨ Delivery of a rail LR

`lorry-receipt/lr-delivery-eligibility.service.ts` (`getLRDeliveryEligibilities`) decides whether an LR can be marked delivered. For a rail LR it answers with one stage:

| Stage | Meaning |
|---|---|
| `AWAITING_BRANCH_GRN` | Some wagon carrying this LR has no submitted Branch GRN |
| `AWAITING_DELIVERY_CHALLAN` / `PARTIALLY_CHALLANED` | Not all received qty is on **ISSUED** challans |
| `READY_FOR_DELIVERY` | Everything is on issued challans → delivery, acknowledgement and billing work like road |

## Money: where rail amounts go

| Amount | Stored on | Goes to | Status |
|---|---|---|---|
| Rail freight (Railway) | `VPScheduleWagonCount.freightAmount / totalFreight` | Nowhere yet | ⚠ No payment or voucher |
| First-mile market truck | LR group `market*`, shown on GRN | **Vendor Payment → transporter slip** | ⚠ Only after the LR is **DELIVERED** at the customer (end of the whole journey), not when the truck reaches the railhead. ERP-58 doubling |
| Hamali (labour) | `GRN.labourCharge`, `VPWagonLoading.labourCharge`, `RailBranchGRN.labourCharge` | **Vendor Payment → hamali slip** (`vendor-payment/calculators/hamali.ts`, sources `GRN_HAMALI`, `VP_LOADING`, `RAIL_BRANCH_GRN`) | ✅ |
| Last-mile truck (DC) | `DeliveryChallan.freightAmount / advanceAmount` | Nowhere yet | ⚠ No transporter slip. LDC detention rules are still being decided |
| Demurrage / wharfage | `RailRakeCharge` (+ waivers, payments) | Nowhere in the books yet | ⚠ Planned: book to a **station ledger** (e.g. Rake-Amalner) |
| Customer freight | LR group `baseFreightAmount` | Billing, same as road | ✅ |

## Traps

- **Every write uses `version`** (optimistic lock). Send back the `version` you read, or you get "changed by someone else, refresh".
- **Branch scope** is checked against **different branches** at each step: the GRN uses the LR's **railhead** branch, schedule / MR/RR / VP Loading use the schedule's **from** branch, and Branch GRN / DC use the rake's **to** branch.
- **Gate lock:** once a wagon has goods from gate 2, it only accepts gate 2 GRNs.
- **Snapshots:** Branch GRN items and DC items copy the LR number, consignee, goods name and unit, so old documents still print correctly after masters change.
- **Damaged qty: two rules that don't match.** A DC may carry up to the Branch GRN `receivedQty` (damaged goods included). The delivery check only needs `receivedQty − damageQty` on issued challans. The comment in `lr-delivery-eligibility.service.ts` says both use received − damaged. ⚠ Confirm with the business which rule is right before changing either one.
- The eligible-GRN list is **Redis-cached**. If you change GRN or loading writes, keep the cache invalidation in `vp-loading.cache.ts` working.

## Files

- Server: `modules/grn/*`, `modules/vp-schedule/*`, `modules/mrrr/*`, `modules/vp-loading/*` (`.route.ts`, `.service.ts`, `.cache.ts`), `modules/rail-rake/*`, `modules/rail-rake-operation/*`, `modules/rail-branch-grn/*`, `modules/delivery-challan/*`, `modules/one-lap-tracker/one-lap-tracker.assignment.service.ts`, `modules/lorry-receipt/lr-delivery-eligibility.service.ts`
- Masters: `modules/wagon`, `modules/railwayFraightMatrix` (route `/railway-freight`), branch railhead areas in `modules/branch`
- Permissions: `packages/types/src/permissions.ts` → `GRN`, `VP_SCHEDULE`, `MRRR`, `VP_LOADING`, `RAIL_RAKE_OPERATION`, `RAKE_AT_RAIL_HEAD`, `RAIL_BRANCH_GRN`, `DELIVERY_CHALLAN`, `RAKE_AT_BRANCH`, `MASTERS.WAGON`, `MASTERS.RAILWAY_FREIGHT`, `MASTERS.ONE_LAP_TRACKER`
- Website: `apps/web/features/grn`, `VP-Schedule`, `mrrr`, `vp-loading`, `rail-rake`, `rail-rake-operation`, `rail-branch-grn`, `delivery-challan`, `tracking`

## How to test (one full rake)

1. **Masters:** a Wagon type, a Railway Freight row for the route, and both branches with a **Rail Head** area (`BranchRailheadArea`). A labour/supervisor at each branch.
2. **Order → LR group** with `transportType = RoadAndRail`, railhead branch = origin, 2 LRs for 2 consignees → finalise.
3. **GRN at Rail Head** for each LR: enter a damage qty without a photo → refused. Add the photo → submit.
4. **VP Schedule** for 2 wagons → confirm (PLANNED). Make a second schedule for the same date and route → refused.
5. **MR/RR:** create (2 rows), try to submit with an empty seal no → refused. Fill it in → submit (schedule MRRR_CREATED).
6. **VP Loading:** split LR 1 across both wagons, LR 2 into wagon 2. Try a GRN from another gate → refused. Mark both wagons loaded (schedule LOADED) → **finalise**. Check the rake number `RK/…`.
7. **GRN at Branch** for wagon 1 (rake UNLOADING), then wagon 2 with a shortage of 1 (rake RECEIVED, tracker released).
8. **Delivery Challan** for LR 1 from both wagons on one truck → issue. Try to put LR 1 and LR 2 on one challan → refused (different consignees).
9. **Deliveries:** LR 1 is ready to deliver. LR 2 shows AWAITING_DELIVERY_CHALLAN until its challan is issued.
