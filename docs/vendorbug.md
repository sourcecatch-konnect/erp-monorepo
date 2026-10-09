# Vendor Payment bug — market-truck freight paid once per LR (ERP71)

## Summary

A market (hired) truck is booked as one **LR group**. The freight, advance,
commission, hamali and TDS agreed with the transporter are entered **once for
the truck** (`LRGroup.market*`). Transporter Payment works **per LR**, though,
and every LR copies the whole truck's figures. So:

1. A truck carrying N LRs shows the full truck freight N times, and paying all
   rows pays the truck N times.
2. A truck becomes payable as soon as **one** of its LRs is delivered, while
   its other LRs are still on the road. The operator can pay early, then pay
   again when the next LR is delivered.

**Fix in one line:** offer a truck for payment only when **all** of its LRs are
delivered, and as **one line for the whole truck**.

## Example

Group `SKG/HO/26-27/00042`, LRs `00051` and `00052`, market freight ₹85,000,
advance ₹10,000 (commission, hamali and TDS are 0 here).

Transporter Payment → Select LR shows **both** LRs, each with ₹85,000 freight.

|                    | Freight   | Advance | Net payable |
| ------------------ | --------- | ------- | ----------- |
| Correct            | ₹85,000   | ₹10,000 | ₹75,000     |
| Today (2 lines)    | ₹1,70,000 | ₹20,000 | ₹1,50,000   |
| **Overpaid**       |           |         | **₹75,000** |

The same overpayment happens across two slips. If only `00051` is delivered,
the truck shows as one row (₹75,000 net) and can be paid. When `00052` is
delivered later, it shows up as a new row and is paid again. Each LR is claimed
separately, so nothing blocks the second payment.

## How the flow works today

```
LR group created (market vehicle)
  └─ LRGroup.marketFreightAmount / marketAdvanceAmount / … entered ONCE per truck
       │
LRs delivered one at a time  (POST /lorry-receipts/:id/deliver, or deliver-all with a subset)
  └─ LorryReceipt.status = DELIVERED  ← per LR
  └─ LRGroup.status = DELIVERED only when every live LR is delivered  ← derived, but unused by Vendor Payment
       │
Transporter Payment → "Search eligible LRs"   GET /vendor-payment/calculators/transporter
  └─ one row PER LR whose own status is DELIVERED/ACKNOWLEDGED
  └─ each row = the group's full market amounts
       │
Save / submit slip   POST /vendor-payment/slips
  └─ server re-derives every amount (except stationery) per LR from the group → same duplication
  └─ claim lock is per LR id → the truck's other LRs stay claimable
       │
Approve → accrual journal built from the sum of the lines → doubled in the books
```

### Code references

| Step | Where | What it does |
| --- | --- | --- |
| Truck amounts stored once | `apps/server/prisma/schema.prisma:1935-1939` | `marketFreightAmount`, `marketAdvanceAmount`, `marketCommissionAmount`, `marketHamaliAmount`, `marketTdsAmount` on `LRGroup` |
| Eligibility is per LR | `apps/server/src/modules/vendor-payment/calculators/transporter.ts:103-140` | `status IN (DELIVERED, ACKNOWLEDGED)` on the **LR**. Group completeness is never checked. |
| Truck amounts copied onto every LR | `transporter.ts:68-84` (`toEligible`) | `freightPaise: lr.group.marketFreightAmount`, same for advance, commission, hamali and TDS |
| Claim is per LR | `transporter.ts:165-172`, `calculators/claims.ts` | `claimedAmong(["LR"], lrIds)`. Claiming `00051` does not block `00052`. |
| Server "re-derives" the duplicate | `vendor-payment.route.ts:131-162` (`buildServerLines`) | Overwrites the client's amounts with `reconcileTransporterLines`, which uses the same `toEligible`. Every line gets the truck's figures again. |
| Totals summed across lines | `vendor-payment.route.ts:200-236` (`recalcSlipTotals`) | gross = Σ(freight + detention); deductions = Σ(advance + commission + hamali + TDS + damage + stationery) |
| Ledger posting | `apps/server/src/modules/ledger/posting.service.ts:1453-1461` | Dr `FREIGHT_EXPENSE` Σfreight; Cr `TRANSPORTER_ADVANCE_RECOVERY`, `TDS_PAYABLE`, … Σ each; Cr transporter = net |
| One-claim-per-source index | `prisma/migrations/20260921000000_add_vendor_payment/migration.sql:115-117` | Partial unique `(sourceType, sourceId) WHERE isActive`. Correct, but the source is the LR, not the truck. |
| Group delivery state (already exists) | `apps/server/src/modules/lorry-receipt/lr-delivery.service.ts:44-72` (`syncGroupDeliveryStatus`) | Sets `LRGroup.status = DELIVERED` only when no live, non-cancelled LR is missing a delivery |
| Partial delivery is allowed | `apps/server/src/modules/lr-group/lr-group.route.ts:1494-1581` (deliver-all with selected LRs), `lr-delivery.route.ts:730` (per-LR deliver) | This is why a truck can be "half delivered" |
| LR set is frozen after DRAFT | `lr-group.route.ts:1631` | LRs can only be added to a DRAFT group, so "all LRs delivered" is a stable test once the group is finalised |
| Web grid | `apps/web/features/vendor-payment/TransporterSlipWizard.tsx:164-173, 394-483` | One row per LR, prefilled from the group, keyed by `lrId`, `sourceType: "LR"` |

### Why editing the grid doesn't help

The wizard lets the operator edit freight, advance and the other amounts, and
its help text says "adjust as needed" (`TransporterSlipWizard.tsx:330`). But
`buildServerLines` throws away every client amount except stationery
(`vendor-payment.route.ts:150-161`). An operator who notices the duplicate and
sets freight to 0 on `00052` still gets ₹85,000 saved on that line. **No UI
workaround exists for this bug.**

## Root causes

1. **Wrong payment unit.** The vendor-payment source is the LR, but the
   transporter's charges belong to the truck (LR group). Amounts at truck
   level are read once per LR.
2. **Wrong eligibility test.** Eligibility checks the LR's own delivery, not
   whether the whole truck is delivered.
3. **Wrong claim key.** The double-payment guard (claim + partial unique
   index) is keyed on the LR id, so it can't stop the truck from being paid
   once per LR.

Detention and damage are **not** affected. They come from each LR's own
acknowledgement (`LRAcknowledgement.detentionAmount` / `damageAmount`), so
adding them up across LRs is correct. See the detention question in "Open
questions" below.

## Impact

For a truck with N LRs (N ≥ 2), each one paid:

- **Cash:** net payable is N × the truck's net. The ₹75,000 example overpays
  by ₹75,000.
- **P&L:** `FREIGHT_EXPENSE` is debited N × the freight. Truck profitability
  and vehicle-cost reports are understated.
- **TDS:** `TDS_PAYABLE` is credited N × the TDS, so the TDS liability (and the
  return built from it) is overstated.
- **Advance:** `TRANSPORTER_ADVANCE_RECOVERY` is credited N × the advance. The
  comment at `posting.service.ts:1291-1301` notes there is no matching debit
  flow for advances yet, so this ledger is already one-sided, and the bug
  doubles the error.
- **Commission / hamali recovery:** over-credited N times in the same way.
- **Vendor statement / ageing:** the transporter's payable is overstated by
  (N − 1) × the truck's net.
- **Timing:** even with N = 1 line paid, the truck can be paid before its other
  LRs are delivered (paid early), against the business rule.

## Related display bug: railhead GRN shows the truck's freight on every LR

The railhead GRN is **one per LR** (`LorryReceipt.grn` is 1:1). Its preview
copies the **whole truck's** charges into each GRN:

- `apps/server/src/modules/grn/grn.route.ts:637-651`. For a market vehicle:
  `totalFreight`, `advanceAmount`, `hamaliAmount`, `tdsAmount` and
  `commissionAmount` come from `group.market*`. For an own vehicle:
  `totalFreight` comes from `group.baseFreightAmount ?? trip.onwardFreight`.
  Both are truck-level, so the same duplication applies.
- `grn.service.ts:460-503` (`calculateGRNTotals`) computes a per-GRN
  `netAmount` from those figures, and `grn.pdf.ts:403-411` prints Total
  Freight, Advance and Net Payable.

A truck with 2 LRs shows ₹85,000 on both GRNs, and the GRN PDFs print it
twice. This is very likely the "freight shown twice" that was reported.

**This is display and report only.** No money moves on these figures. Vendor
Payment reads `LRGroup.market*` (transporter) and `GRN.labourCharge` (hamali,
`calculators/hamali.ts:161-200`), never `GRN.totalFreight` / `netAmount`, and
no GRN amount is posted to the ledger.

## Other gaps found while tracing the flow

Each of these lets a paid truck drift out of sync with its slip. They belong in
the same fix or an immediate follow-up.

| # | Gap | Where |
| --- | --- | --- |
| G1 | **Undo delivery ignores vendor payment.** A delivered and already-paid LR can be reverted to FINALISED. For market vehicles the trip-closed gate doesn't apply (`assertFinalTripNotClosed` returns early when there is no trip). | `lr-delivery.route.ts:856-891`, `lr-delivery.service.ts:136-140` |
| G2 | **Ack edit / undo ack ignore vendor payment.** Detention and damage can change after the slip has captured them. Undo-ack only checks bills. | `lr-delivery.route.ts:975` (PATCH acknowledgement), `:1074` (undo-acknowledgement) |
| G3 | **Truck amounts are editable after payment.** `PATCH /lr-groups/:id` lets you change `market*` amounts and the transporter at any status. Only `paymentMode` is locked. | `lr-group.route.ts:866-870, 1078-1118` |
| G4 | **A DELIVERED group can be cancelled.** The cancel guard blocks only FINALISED and CANCELLED. Cancelling cascades every LR, delivered or acknowledged, to CANCELLED, even when the truck has been paid. | `lr-group.route.ts:1699-1704` |
| G5 | **Grid looks editable but isn't.** Server-owned amount inputs are editable in the UI and then silently overwritten. | `TransporterSlipWizard.tsx:330, 417-465` |
| G6 | **Slip detail shows raw ids.** Lines render as `LR · <cuid>` with no LR or group number. | `VendorPaymentSlipDetailPage.tsx:270` |

## Fix

### Design

Make the **LR group (truck)** the payment source for transporter slips.

- **One line per truck.** New source type `LR_GROUP`, `sourceId = LRGroup.id`.
  The existing partial unique index `(sourceType, sourceId) WHERE isActive`
  then guarantees at most one active claim per truck. No index change is
  needed.
- **Eligible only when complete.** The group is a market vehicle for this
  transporter, not deleted or cancelled, has at least one delivered or
  acknowledged LR, and has **no** live, non-cancelled LR that is still
  DRAFT/FINALISED.
- **Truck amounts once, LR amounts summed.** Freight, advance, commission,
  hamali and TDS come from `LRGroup.market*`, **once**. Detention and damage are
  the **sum** over the group's live LRs' acknowledgements.

### Server

1. **Prisma + validators.**
   - Add `LR_GROUP` to `enum VendorPaymentSourceType` (`schema.prisma:4520`).
     The migration is `ALTER TYPE "VendorPaymentSourceType" ADD VALUE 'LR_GROUP';`.
   - Add it to `vendorPaymentSourceTypeSchema` in
     `packages/validators/src/accounts/vendor-payment.schema.ts`, then rebuild
     validators.
2. **`calculators/transporter.ts`: query `lRGroup`, not `lorryReceipt`.**
   - Eligibility `where`:
     ```ts
     {
       deletedAt: null,
       status: { not: "CANCELLED" },
       isMarketVehicle: true,
       marketTransportId: transportId,
       ...branchWhere,
       lorryReceipts: {
         some: { deletedAt: null, status: { in: ["DELIVERED", "ACKNOWLEDGED"] } },
         none: { deletedAt: null, status: { in: ["DRAFT", "FINALISED"] } },
       },
     }
     ```
     Use the explicit LR test rather than relying only on
     `LRGroup.status === "DELIVERED"`. Both work, but the LR test is correct
     on its face and doesn't depend on `syncGroupDeliveryStatus` having run.
   - **Date filter = truck completion date** (the latest `deliveredAt` in the
     group):
     - `to` → `lorryReceipts.none: { deletedAt: null, status: { not: "CANCELLED" }, delivery: { deliveredAt: { gt: to } } }`
     - `from` → `lorryReceipts.some: { deletedAt: null, status: { not: "CANCELLED" }, delivery: { deliveredAt: { gte: from } } }`
   - **Search:** group number, market vehicle number, or
     `lorryReceipts.some.lrNumber`. Searching "00052" still finds the truck.
   - **Paging:** the same `pageMerged` stream, ordered by group
     `(createdAt, id)`.
   - **Drop claimed:** drop groups with an active `LR_GROUP` claim, **and**
     groups where any LR has an active legacy `LR` claim. This keeps the
     changeover safe.
   - **Row shape:** `groupId`, `groupNumber`, `lrNumbers[]`,
     `marketVehicleNumber`, `completedAt` (latest delivery), plus the amounts
     above.
   - **`reconcileTransporterLines(groupIds)`:** re-runs the same eligibility
     and claim checks (including legacy LR claims) and returns the server
     amounts. Do all of this on `db` before the transaction, as now.
3. **`vendor-payment.route.ts` → `buildServerLines`.**
   - Accept only `sourceType: "LR_GROUP"` for TRANSPORTER. Reject `"LR"` with a
     clear message, for example "Transporter payments are per truck — select
     the LR group".
   - Keep the stationery rule: one manual value per line, now per truck.
   - `lockSources` and the transaction shape don't change. The lock key is the
     group id.
4. **Guards (G1–G4).** Add a small helper next to `claimedAmong` that answers
   "does this group (or any of its LRs) have an active transporter claim?",
   and use it to block:
   - undo-delivery, ack edit and undo-ack on any LR of a claimed group
     (message: "Truck is on vendor payment slip X — cancel the slip first");
   - changing `market*` amounts or `marketTransportId` on a claimed group;
   - cancelling a DELIVERED group. Tighten the guard to allow cancel only in
     DRAFT, or at minimum when the group is unclaimed.

### Web

1. **`vendor-payment.service.ts`.** Add an `EligibleTransporterTruck` type
   that matches the new row shape.
2. **`TransporterSlipWizard.tsx`.**
   - One row per truck: Group no. / vehicle, LRs (`00051, 00052`), completed
     date, and amounts.
   - Selection is keyed by `groupId`, and lines are sent as
     `sourceType: "LR_GROUP"`.
   - Make the server-owned amounts read-only. Keep only **Stationery**
     editable.
   - Update the step text: "Trucks whose LRs are all delivered, with no active
     claim. Amounts come from the LR group's market-vehicle figures and the
     acknowledgements."
   - Rename the button to "Search eligible trucks".
3. **Slip detail (G6).** Show group number and LR numbers for each line. Either
   resolve the labels in `GET /vendor-payment/slips/:id`, or store a
   `sourceLabel` on the line at create time.

### GRN preview (separate, lower priority)

Changing `grn.route.ts:637-651` needs an ops decision on how a truck's charges
should appear on a per-LR GRN:

- **(a) Recommended.** When the group has more than one live LR, prefill 0 and
  return the truck figures as a read-only reference ("Truck freight ₹85,000 —
  shared by 2 LRs, group SKG/HO/26-27/00042"). For a single-LR group, keep
  today's behaviour.
- **(b)** Apportion by LR weight or quantity.

Existing GRNs keep their duplicated figures. They are display only, so no data
fix is required, but reports that add up GRN freight across LRs will
over-count until those GRNs are corrected.

## Existing data: find affected trucks before deploying

Run these **before** the fix goes live. Approve and disburse work from the
stored lines, so a legacy slip that is already DRAFT or PENDING_APPROVAL can
still be approved with doubled amounts after the deploy.

**Trucks claimed more than once (overpaid or about to be):**

```sql
SELECT g."groupNumber",
       COUNT(l.id)                                   AS active_lr_lines,
       ARRAY_AGG(DISTINCT s."slipNumber")            AS slips,
       ARRAY_AGG(DISTINCT s.status::text)            AS slip_statuses,
       SUM(l."netPaise") / 100.0                     AS net_on_slips_rupees,
       (COUNT(l.id) - 1) * (
         COALESCE(g."marketFreightAmount", 0)
         - COALESCE(g."marketAdvanceAmount", 0)
         - COALESCE(g."marketCommissionAmount", 0)
         - COALESCE(g."marketHamaliAmount", 0)
         - COALESCE(g."marketTdsAmount", 0)
       ) / 100.0                                     AS approx_overpaid_rupees
FROM "VendorPaymentSlipLine" l
JOIN "VendorPaymentSlip" s ON s.id = l."slipId"
JOIN "LorryReceipt" lr     ON lr.id = l."sourceId"
JOIN "LRGroup" g           ON g.id = lr."groupId"
WHERE l."sourceType" = 'LR'
  AND l."isActive"
  AND s.type = 'TRANSPORTER'
GROUP BY g.id
HAVING COUNT(l.id) > 1
ORDER BY g."groupNumber";
```

(`approx_overpaid_rupees` ignores per-LR detention, damage and stationery, so
treat it as a starting point for Accounts, not the final figure.)

**Trucks paid before all their LRs were delivered:**

```sql
SELECT g."groupNumber", s."slipNumber", s.status, lr."lrNumber" AS paid_lr
FROM "VendorPaymentSlipLine" l
JOIN "VendorPaymentSlip" s ON s.id = l."slipId"
JOIN "LorryReceipt" lr     ON lr.id = l."sourceId"
JOIN "LRGroup" g           ON g.id = lr."groupId"
WHERE l."sourceType" = 'LR'
  AND l."isActive"
  AND EXISTS (
    SELECT 1 FROM "LorryReceipt" o
    WHERE o."groupId" = g.id
      AND o."deletedAt" IS NULL
      AND o.status IN ('DRAFT', 'FINALISED')
  );
```

**Remediation.** This is an Accounts decision for each case.

- **DRAFT / PENDING_APPROVAL / APPROVED (unpaid):** cancel the slip with
  `POST /vendor-payment/slips/:id/cancel`, which reverses the accrual if
  approved and releases the LRs. Then recreate it as one truck line after the
  fix.
- **PARTIALLY_PAID / PAID:** the cancel route refuses these, and Vendor Payment
  has no refund or reversal flow today. Recovery from the transporter
  (adjusting against their next payment, or a manual journal) has to be agreed
  with Accounts.
- Legacy single-line trucks (one LR, or only one LR claimed and the truck now
  fully delivered) are correct and can stay as they are. The new eligibility
  check skips any truck with a legacy LR claim, so it can't be paid again.

## Test plan

Server unit tests (vitest, `pnpm --filter @skerp/server test`):

- Truck amount aggregation: the group's market amounts are counted once, and
  detention and damage are added up across LRs.
- Eligibility predicate: partially delivered → not eligible; all delivered or
  acknowledged → eligible; a cancelled LR is ignored.

Manual / API walkthrough with the example truck (freight ₹85,000, advance
₹10,000, LRs `00051` + `00052`):

| # | Step | Expected |
| --- | --- | --- |
| 1 | Deliver `00051` only, then search eligible trucks | Truck **not** listed |
| 2 | Deliver `00052`, search again | **One** row: group `SKG/HO/26-27/00042`, LRs `00051, 00052`, freight ₹85,000, advance ₹10,000, net ₹75,000 |
| 3 | Search "00052" | Same truck row |
| 4 | Save and submit | Slip gross ₹85,000, deductions ₹10,000, net ₹75,000. Accrual: Dr Freight Expense ₹85,000 / Cr Transporter Advance Recovery ₹10,000 / Cr Transporter ₹75,000 |
| 5 | Same truck from a second tab | "already claimed" error |
| 6 | Acks with detention ₹1,000 on `00051` and ₹500 on `00052` | Line detention ₹1,500 |
| 7 | Undo delivery of `00052` while the slip is active | Blocked (G1) |
| 8 | Edit the group's market freight while the slip is active | Blocked (G3) |
| 9 | Cancel the slip | Accrual reversed; truck listed again |
| 10 | Single-LR truck | One row, same amounts as before the fix |
| 11 | POST a slip with `sourceType: "LR"` | 400 |
| 12 | Truck with a legacy active `LR` claim on `00051` | Not listed, and can't be submitted as `LR_GROUP` |

Then run `pnpm check-types` and `pnpm lint`.

## Open questions

1. **Detention per LR or per truck?** Detention is captured on each LR's
   acknowledgement and summed above. If ops enters the same truck wait on
   every LR's ack, summing double-counts it. Should truck detention move to
   the group, or be entered on only one LR?
2. **DELIVERED or ACKNOWLEDGED?** The rule today is "delivered" (truck reached
   the consignee). Should payment wait for POD (all LRs ACKNOWLEDGED)?
3. **GRN apportioning:** option (a) or (b) above.
4. **Recovery** of trucks already overpaid (see the remediation section above).
