i # SKERP — Comprehensive Module Plan (v2)

> Definitive module-wise plan for the new ERP, derived from a deep grilling session against the actual SK Translines operational workflow (PDF SOPs + drawio + legacy code analysis).
> **Supersedes** [ERP_DEVELOPMENT_PLAN.md](ERP_DEVELOPMENT_PLAN.md) for module ordering and scope. The principles in [MASTER_MODULE_PLAN.md](MASTER_MODULE_PLAN.md) and [RBAC_PLAN.md](RBAC_PLAN.md) still apply.
>
> Status: Masters, Auth, RBAC done. Starting transactional modules.

---

## 1. Context

SK Translines is a multi-branch road + rail freight forwarder. The legacy ERP (`l.sktranslines.com` + `35.154.123.37`) is split across two systems with poor architecture; the new ERP is a **single-tenant, greenfield, no-migration** rebuild for SK only. Build philosophy: **vertical-slice MVP** — ship a usable end-to-end loop first, then deepen.

Scale assumption: **6–10 branches, 500–1500 LRs/day at peak, 50–200 concurrent users**.

---

## 2. Full v1 Module List

Foundation (Phase 0):

1. **Notifications** — event-driven, email + WhatsApp + in-app
2. **Attachments** — polymorphic S3-backed file storage

Operational chain: 3. **Order Booking** 4. **LR (Lorry Receipt)** 5. **Vehicle Trip / Container** (own + market vehicles) 6. **Rail Operations** (Rake, VP, RR/MR, DC, LDC ack chain) 7. **LR Acknowledgement / Delivery** (folded into LR module) 8. **DC Detention** (slab calc, approval, broker payable)

Money chain: 9. **Billing / GST Invoicing** 10. **Receivables / Customer Payments** 11. **Accounts** (Tally bridge + lite ledger + Hamali + Transporter/LDC payments)

Asset chain: 12. **Maintenance** (Job Card, Purchase Order) 13. **Inventory** (spare parts at HO workshop) 14. **Driver Lifecycle** (salary, advance, incentive, doc expiry)

Customer-facing: 15. **Claims / Damage Settlement** 16. **Customer Complaint** (detailed helpdesk-style)

Compliance / Misc: 17. **E-way Bill** (manual attach + NIC API for Part-B + validity) 18. **Reports / Dashboards** (typed reports + exports)

---

## 3. Cross-Cutting Foundation (Phase 0)

### 3.1 Notifications Module

**Architecture:** event-driven pipeline.

- Producers (every module) emit typed events (`order.confirmed`, `lr.delivered`, `dl.expiring`, `sla.breached`, etc.).
- `NotificationRule(eventType, recipientResolver, channels[], templateId, severity)` — rule rows match events to recipients + channels.
- `recipientResolver` is a typed function (e.g. `destBranch.acknowledgers`, `lr.creator`, `role:branch-manager@destBranch`, `subscribers`) that returns `userId[]` from the event payload.
- Per-channel jobs enqueued onto BullMQ → worker dispatches.
- `NotificationLog(eventId, channel, recipientUserId, status, providerId, sentAt, deliveredAt)` — one row per delivery.
- User subscription overlay: `UserNotificationSubscription(userId, eventType, channel, subscribed)` — opt out of non-critical alerts. Critical/statutory alerts marked non-optional.
- Providers behind a single interface: Email (SES), WhatsApp (**Meta Cloud API directly**, no BSP), In-App (websocket + DB row).

### 3.2 Attachments Module

- Polymorphic `Attachment(id, entityType, entityId, fileKey, mime, sizeBytes, uploadedBy, uploadedAt, antivirusStatus)`.
- Storage: **AWS S3** with pre-signed URLs for upload + download. Server never proxies file bytes.
- Antivirus: post-upload worker scans, sets `antivirusStatus = Clean | Infected`. App refuses downloads of non-clean files.
- EXIF/PII stripped server-side before persistence.
- Same module powers: Order PO copies, LR POD, Vehicle RC/Insurance/Permit scans, Driver DL scans, Customer agreements, Complaint attachments, etc.

---

## 4. Operational Modules

### 4.1 Order Booking

**Entity:** `Order(orderNumber, clientId, fromBranchId, toBranchId, pickupDate, customerLocationId, pickupAddressOverride, specialInstructions, orderType: Truck|Item, contactPersonName, contactMobile, contactEmail, bookingFreightAmount, freightOverrideReason, status, fyCode, createdById, approverId, approvedAt)`.

**Children:**

- `OrderItem(orderId, goodsId, quantity, unit, weight)` — when `orderType=Item`.
- For `orderType=Truck`: `truckQuantity` + `vehicleTypeId` (required) on Order itself.
- `OrderEvent(orderId, actorId, eventType, payloadDiff, createdAt)` — full audit timeline shown on detail page.

**Status machine:** `Pending → PendingApproval → Confirmed → InProgress → Completed` (+ `Rejected`, `Cancelled`).

**Rules:**

- Creation is **internal only** (no customer portal in v1). No customer notifications — internal employee notifications only via Notifications module.
- Approver = **From Branch Manager** (or any user with `orders.approve` permission scoped to `fromBranchId`).
- `PendingApproval` requires: client, fromBranch, toBranch, pickupDate, orderType, + type-specific (truckQty+vehicleType OR items[]).
- Freight on `Confirmed`: **auto-calculate from RateMatrix** (lookup by client + from + to + vehicleType for Truck; matrix for Item by goods). Manual override allowed with `freightOverrideReason` audit field.
- Credit-limit check: **soft warning** at Confirm — "Customer at ₹5L of ₹4L limit, confirm anyway?" with reason logged. Doesn't block.
- Editability: Pending/PendingApproval fully editable; Confirmed only soft fields (contact, instructions); InProgress+ frozen (must cancel + rebook).
- Cancellation: **blocked** if any non-cancelled LR exists on this order. User must cancel LRs first.
- **One order → many LRs, capped by `truckQuantity`** for Truck orders. For Item orders, no LR cap (operator splits goods across LRs).
- Single pickup + single drop per order. Multi-drop happens at TRIP level.
- Attachments: PO copy / customer email / signed contract via Attachments module.

**Numbering:** `SKT/<branch-code>/<FY>/<seq>` — e.g. `SKT/JAL/26-27/00001`. Per-branch, per-FY counter, zero-padded.

### 4.2 LR (Lorry Receipt)

> **Model name is `LorryReceipt`** (not `LR`). Branches are `originBranchId` / `destinationBranchId` (not from/to). The entity below reflects what is **implemented**; a "Planned (not yet on the model)" note at the end lists the spec items still to be added.

**Entity:** `LorryReceipt(lrNumber, fyCode, source, orderId nullable, originBranchId, destinationBranchId, transportType: Road|Rail|RoadAndRail, tripLegType: DIRECT|TO_HUB|FROM_HUB, hubId nullable, railheadBranchId nullable, isMarketVehicle, primaryTripId nullable, secondaryTripId nullable, marketVehicleNumber nullable, marketDriverName nullable, consignorId, consigneeId, sealNumber nullable, invoiceNumber nullable, invoiceAmount nullable, priority: Normal|Express|Critical, status: DRAFT|FINALISED|CANCELLED, cancelReason nullable, finalisedAt, finalisedById, createdById, updatedById, version, deletedAt, ...)`.

**Transport type & routing:**

- `transportType` is three-valued: **`Road` | `Rail` | `RoadAndRail`** (not the earlier `Road|RoadRail`).
- **Railhead** (`railheadBranchId`) — order LRs only; **required when `transportType = RoadAndRail`**. A user-picked branch where `Branch.isRailHead = true`. Distinct from hub.

**Hub / split-at-hub:**

- **Hub is always Jalgaon / HO** (a branch flagged as the hub). `hubId` is **never picked in a form** — it is set only by the **"split at hub" action on a FINALISED LR**, which sets `tripLegType = FROM_HUB`.
- `tripLegType`: `DIRECT` (single leg, default) | `TO_HUB` (origin → hub leg) | `FROM_HUB` (hub → destination leg, created by the split). A hub-routed consignment is therefore two legs riding two trips.

**Vehicle attachment (own vs market):**

- **Own vehicle** — attach via `primaryTripId` (and `secondaryTripId` for the second leg of a hub split) → `VehicleTrip`.
- **Market vehicle** — `isMarketVehicle = true`; `marketVehicleNumber` + `marketDriverName` entered directly on the LR, **with no `VehicleTrip` row**.

**Two creation paths:**

- **From Order** (`source = ORDER`) — most LRs; copies consignor/consignee + goods from the order.
- **Instant LR** (`source = INSTANT`) — ad-hoc / walk-in freight, no parent order. `orderId IS NULL`.

**Children (implemented):**

- `LRGoods(lorryReceiptId, name, description, quantity, unit, weight, length, width, height)` — goods lines with optional dimensions; copy-on-create from the order, can diverge after.
- `LRCharge(lorryReceiptId, chargeType, amount, description)` — currently only `BASE_FREIGHT` (added at finalisation).
- `EwayBill(lorryReceiptId, ewayBillNo, generatedAt, expiresAt, generatedBy, documentUrl)` — multiple per LR.

**Implemented actions / routes:** list, status-counts, get, create, update (DRAFT), **finalise** (DRAFT → FINALISED; stamps base freight + seal/invoice/eway), **split-at-hub** (on a FINALISED LR), **cancel**, add eway-bills.

**Status (implemented):** flat `DRAFT → FINALISED → CANCELLED`.

**Rules:**

- **Draft fully editable; Finalised only soft fields.**
- Finalisation requires origin-branch access (`assertOriginAccess`) and stamps the `BASE_FREIGHT` charge + seal/invoice/eway data.
- **Branch-scoped operations** — Origin branch users: create + finalise + cancel. **HO is just a branch** — multi-branch user assignment (`UserBranchAssignment`) gives HO super-users access to all branches via normal permission checks. No HO-special code paths.

**Numbering:** `SKT/<branch>/<FY>/<seq>` — same scheme as Order, separate counter.

**Planned (not yet on the model / not yet built):**

- **Dual status axes** — `operationalStatus` (`Draft → Finalised → InTransit → AtDestination → Acknowledged → Delivered → Closed`) and `billingStatus` (`NotBillable → ReadyToBill → Billed → Paid` + `Disputed`). Current `status` is the flat 3-value enum only.
- **Frozen party snapshots** (`consignorPartySnapshot` / `consigneePartySnapshot` — name + address + GSTIN at finalisation) — only FKs exist today.
- **`paymentMode`** (`Paid | ToPay | TBB`) and **`currentVehicleNo`** denormalisation.
- Richer **`LRChargeType`** (Loading/Unloading/Detention/Courier/Retention/Handling/Other + `isDeduction`/`taxable`).
- `LRAcknowledgement(lrId, receivedQty, damageQty, shortageQty, observedDetentionDays, acknowledgedBy, ackAt, remarks)` — destination-branch Ack screen.
- `PODDispatch(lrId, courierName, docketNumber, courierCharges, retentionAmount, dispatchedAt, receivedAtHOAt, status)` — POD courier sub-tracker; POD attachment required for `ReadyToBill`.
- `LRFreightRevision(lrId, oldAmount, newAmount, reason, actorId, revisedAt)` — post-finalisation freight changes (new permission `lr.freight.revise`). Existing bills NOT auto-updated — credit-note path required.
- `LRTripAssignmentHistory(lrId, tripId, assignedAt, unassignedAt, actorId)` — reassignment audit.
- Destination-branch acknowledge + deliver + POD-upload flow.

### 4.3 Vehicle Trip / Container

> A **trip** is the unit of vehicle movement. "Container" in the heading refers to the rail leg — modelled here as a trip with `tripType = dc` (the rake/DC movement), **not** a separate entity. There is no road-container concept. The entity below reflects what is **implemented**; the "Planned (not yet built)" note lists the spec items still to be added.

**Full-load / single-customer rule:** SK trips are **full-load — one trip carries one client** (no part-load). Hence `consignorId` lives on the trip (required for `lr` trips, null for `dc`/rake trips).

**Entity:** `VehicleTrip(tripNumber, tripName, status: Planned|InTransit|Closed|Cancelled, tripType: lr|dc, vehicleId, driverId, routeId, consignorId nullable, onwardFreight, isTripEmpty, rakeDate nullable, openingKm, startDateTime nullable, endDateTime nullable, closingKm nullable, cancelReason nullable, fyCode, rateMatrixId nullable, createdById, updatedById, version, deletedAt, ...)`.

- **`tripType`** — `lr` (road LR trip) or `dc` (rake / rail movement; `rakeDate` set). One model serves both; the rail-specific Rake/VP/DC chain (§4.4) is still unbuilt, so `dc` is currently a stub.
- **`routeId`** → `Route` master (source + destination city) drives distance + the freight lookup; **`rateMatrixId`** links the matched rate row. (Add `Route` to the §9 masters list.)
- **`onwardFreight`** — freight carried on the trip itself. **`isTripEmpty`** flags an empty / repositioning run.
- **KM/time lifecycle:** `openingKm` captured at creation; `startDateTime` stamped when the first LR attaches (Planned → InTransit); `endDateTime` / `closingKm` stamped on Close.

**`tripName` (auto-generated, human-readable):**

- `lr` : `<FromCity>-<ToCity>/<TruckNumber>/<CustomerShortCode>/<DDMMYYHHmm>`
- `dc` : `<FromCity>-<ToCity>/<TruckNumber>/RAKE(<DDMMYY>)/<DDMMYYHHmm>`

**LR ↔ Trip attachment:** an LR attaches via `LorryReceipt.primaryTripId` (and `secondaryTripId` for the second leg of a hub split). A trip therefore exposes `primaryLRs` + `secondaryLRs`. (No single `currentTripId` / `LRTripAssignmentHistory` — the two-leg model replaces it.)

**Children (implemented):**

- `TripUnloadingPoint(vehicleTripId, sequence, cityId, locationId, plannedDate, actualDate)` — ordered drops.
- `TripStatusHistory(vehicleTripId, status, changedAt, userId, note)` — status-transition log.

**Status machine (implemented):** `Planned → InTransit → Closed` (+ `Cancelled`). (No `AtDestination` / `Completed` yet.)

**Implemented actions / routes:** list, status-counts, get, **PDF**, create, update, **close**, delete (Planned/Cancelled only), **cancel**. Trip numbering uses a single **global per-FY** counter (`TRIP` sequence key — trips are not branch-scoped). Close currently sets `Closed`, stamps `closingKm`/`endDateTime` (validates `closingKm ≥ openingKm`), and releases the vehicle (`Vehicle.status = AVAILABLE`).

**Planned (not yet built):**

- `TripExpense(tripId, category: Fuel|Toll|Loading|Unloading|DriverAdvance|Repair|Misc|Hamali|Other, amount, paymentMode, counterpartyId, receiptAttachmentId)` — typed expense lines.
- `DriverAdvance(tripId, driverId, amount, paymentMode, settledAt, settledAmount, settlementNote)` — per-trip advances; reconciled on Close → driver ledger.
- `TripEvent` — full event timeline (only `TripStatusHistory` exists today).
- **Log Slip on Close** — synchronous calc of expense totals, KM, distance, P&L in one transaction. **Close does none of this yet.**
- **Close blockers** — legacy states ("GRN Pending", "LR Not Finalised", "Unused Trip", missing `TripUnloadingPoint.actualDate`) surfaced as blockers; Close currently only checks `closingKm`.
- **Market-vehicle path** — `TransporterPayment` via the 3-stage workflow primitive (instead of Log Slip + own-vehicle settlement).
- **Vehicle availability reconciliation** — status is toggled inline on close; no periodic drift-catch job yet.
- **Doc-expiry blocks trip-create** — driver DL or vehicle RC/Insurance/Permit/Fitness expired → block, with 60/30/7-day-before notifications.

### 4.4 Rail Operations

Always **own** rakes (no broker-mediated booking). Entities:

- `Rake(rakeNumber, sourceCityId, destinationCityId, fromBranchId, toBranchId, arrivalDate, arrivalTime, dispatchDate, dispatchTime, status, ...)`.
- `VP(rakeId, vpNumber, placementDate, placementTime, removalDate, removalTime, rrNumber, rrDate, mrNumber, mrAmount, mrDate)` — multiple VPs per rake. RR (Railway Receipt) + MR (Money Receipt) entered post-issuance by IR.
- `VPAssignment(vpId, lrId, weight, quantity)` — M2M VP↔LR for consolidation. One LR can span many VPs (heavy goods); one VP can hold many LRs (consolidation).
- `RakeCharges(rakeId, type: Demurrage|Waivel|Warpage, hours, perHourRate, amount, waivelPercent, waivelAmount, letterDate, paymentMode, ...)` — typed rows. DC per-hour rate (₹150) stored in a system config (not hardcoded).
- `DC(dcNumber, rakeId, fromRailHeadBranchId, toBranchId, ldcDate, vehicleId nullable, brokerId nullable, freightAmount, advance, claimedDetention, status, ...)`.
- `DCLineItem(dcId, lrId)` — LRs consolidated on this DC.
- `DCAcknowledgement(dcId, ackType: Supervisor|Broker, actorId, ackDate, ackTime, deliveryDate, reportingDate, collectionDate, paymentMode, detentionDays, detentionAmt, parkingAmt, otherExpenses, labourCharge, shortageAmt, damageAmt, podAttachmentId)` — **two parallel rows per DC** (legacy code reverse-engineered this). UI shows both side-by-side for mismatch detection.
- `DCAckItem(dcAckId, lrId, totalQty, receivedQty, damageQty)` — shortage derived.
- `DCApproval(dcId, acceptedAckType, brokerPayable, approverId, approvedAt)` — approver picks Supervisor or Broker version; chosen ack drives the broker freight payable: `Freight − Advance − Shortage/Damage + Detention/Parking/Other/Labour`.
- `DCPayment` via the **3-stage workflow primitive** (Slip → Entry → Approval → Disbursed).

**Rail flow chain:**

```
VP Schedule → Generate RR/MR → VP Loading → Fill Rake Arrival & Departure
→ Finalise VP Schedule → GRN at Branch Station → Issue DC → DC/WC at Rail Head + Branch
→ DC Acknowledgement (Supervisor + Broker parallel) → DCApproval → DCPayment
```

### 4.5 DC Detention

**Date logic (per the SOP):**

- `FinalReportingDate = min(LDC Date, Report Date, all LR Reporting Dates within DC)`
- `FinalUnloadingDate = max(all LR Unloading Dates within DC)`
- `DetentionDays = FinalUnloadingDate − FinalReportingDate`

**Slab master:**

- `DetentionSlab(name, matchPartyId nullable, matchBrokerId nullable, matchVehicleTypeId nullable, freightFrom nullable, freightTo nullable, freeDays, freeHours, firstDayFree bool, lastDayFree bool)` — match keys with NULL = wildcard. Engine picks **most-specific matching slab** (party > broker > vehicleType > default).
- `DetentionSlabTier(slabId, fromUnit, toUnit, rate, unitType: Day|Hour)` — tier rows for ramped rates (e.g. days 1–2 at ₹1000, days 3+ at ₹1500).
- Supports the legacy "Bipin Singh" (day-wise w/ free first+last), "Big Truck" (free first+last + flat rate), "Small/407" (hour-wise) patterns as data, not code.

**Calculation:**

- `DetentionCalc(dcId, detentionDays, hours, slabId, computedAmount, manualOverrideAmount, finalAmount, overrideReason, computedAt)` — service-layer calc on DCApproval. **Stored snapshot** preserves history; recompute creates a new row.
- Approval chain (Operator → Accounts → Manager) implemented as state transitions on the calc row, gated by permissions.

### 4.6 Folded into LR module

LR Acknowledgement + Delivery handled inside the LR module (see §4.2).

---

## 5. Money Chain

### 5.1 Billing / GST Invoicing

**Entity:** `Bill(billNumber, billDate, billType: Road|RoadRail|RoadGTA, billingPartyType: Consignor|Consignee, customerId, placeOfSupplyStateId, branchId, fyCode, subTotal, taxLines json, totalAmount, status, isReverseCharge, ...)`.

**Children:**

- `BillLine(billId, lrId, chargeType: Freight|Detention|Hamali|Loading|Unloading|Additional|Other, amount, taxable)` — **M:N LR↔Bill**. Solves the Whirlpool requirement (separate Freight Bill vs Detention Bill against the same LR). One LR can appear on many bills (different chargeType); one bill can cover many LRs. Constraint: `(lrId, chargeType)` unique across active (non-cancelled, non-credited) bills.
- `BillTaxLine(billId, taxType: CGST|SGST|IGST, rate, base, amount)` — frozen tax lines (rates may change after issuance).

**Customer master flag:** `splitBillsByChargeType: bool` — auto-applies the Whirlpool pattern.

**GST engine:** pure function. Inputs: `(billType, sellerStateId, placeOfSupplyStateId)` → outputs `taxLines[]`.

- `billType=Road` → no GST normally (non-GTA).
- `billType=RoadRail` → GST always applicable (5%).
- `billType=RoadGTA` → GST under GTA; flag `isReverseCharge` controls whether SK collects or consignor is liable.
- CGST+SGST 2.5%+2.5% if intra-state; IGST 5% if inter-state.
- Rates configurable in system config, not hardcoded.

**Freight is locked on bill** — sourced from LR. To change: use the LR freight revision workflow (§4.2). Bills already generated NOT auto-updated; user must issue credit note + new bill.

**Immutability:** Bill is **immutable once Finalised** (GST law). Corrections via `CreditNote` (full or partial), structurally mirroring Bill with `originalBillId` reference.

**Numbering:**

- Bill: `SKT/B/<branch>/<FY>/<seq>` (e.g. `SKT/B/JAL/26-27/00001`).
- Credit Note: `SKT/CN/<branch>/<FY>/<seq>`.
- Separate counter per `(branch, FY, docType)`.

**Output:** GST-compliant invoice PDF; GSTR-1 JSON export for monthly filing.

### 5.2 Receivables / Customer Payments

**Entities:**

- `Receipt(receiptNumber, customerId, amount, paymentMode: Cash|Cheque|Bank|UPI, referenceNumber, receivedAt, receivedBy, bankLedgerId, status, ...)`.
- `ReceiptAllocation(receiptId, billId, amountApplied, tdsAmount, tdsSection: 194C, tdsCertNumber nullable, tdsCertDate nullable)` — one receipt allocated across many bills, partial allowed.
- Unallocated amount sits as **on-account credit** until allocated to a bill.
- TDS deducted at receipt time; certificate fields filled later when customer shares Form 16A. Quarterly TDS-receivable report ties to 26AS reconciliation.

**Customer ledger:** running balance per customer, summing bills − receipts − credit notes. Ageing buckets: 0–30 / 30–60 / 60–90 / 90+ days.

### 5.3 Accounts (Tally Bridge + Lite Ledger)

**Authority:** ERP maintains a **lite double-entry ledger** for internal P&L, customer + vendor balances, vehicle P&L, pump credit balance. **Tally remains statutory source** for GST/IT/ROC filings. ERP exports voucher XML to Tally.

**Entities:**

- `Ledger(name, ledgerGroup, gstin nullable, ...)` — chart of accounts. Mirrors Tally ledger names for clean export. Includes party-specific ledgers (one per customer, vendor, pump, broker, vehicle, etc.).
- `JournalEntry(voucherNumber, voucherDate, narration, tallyVoucherType: CashReceipt|CashPayment|BankReceipt|BankPayment|Journal|LogSlip, status: Draft|Posted|TallySynced, postedAt, tallyExportedAt)`.
- `JournalEntryLine(journalEntryId, ledgerId, debit, credit, brokerTag nullable)` — N lines per entry. **Broker tag on every line** that touches broker activity (per legacy requirement for broker-wise Tally posting).
- `JournalTemplate(name, lineSpecs json)` — pre-built patterns for common entries:
  - PumpBarter: 3 lines (client freight credit, vehicle freight debit, commission expense).
  - DriverAdvanceSettlement: driver ledger ↔ cash/expense.
  - DetentionPostingToBroker: broker payable + detention income.
  - LR Bill posting (revenue + GST split).
  - Receipt posting (customer ledger + bank/cash + TDS receivable).

**Vendor payment workflows** — all use the **3-stage primitive** (`Slip → Entry → Approval → Disbursed`):

- `TransporterPayment` (market vehicle freight).
- `LDCPayment` (broker payment after DCApproval).
- `JobCardServicePayment` (workshop service bill).
- `HamaliPayment(type: GRNOrigin|GRNBranch|VPLoading|Other, branchId, lrId/rakeId, labourCount, ratePerLabour, totalAmount, ...)` — same workflow primitive.

**Tally export:**

- Each `JournalEntry` auto-derives `tallyVoucherType` from line types (cash account → CashPayment/Receipt, bank account → BankPayment/Receipt, log-slip pattern → LogSlip, else Journal).
- **Direct Tally API integration via a bridge service** (per user choice) — Tally Prime runs on a known machine with a bridge that accepts ERP requests and posts vouchers. ERP marks `tallySyncStatus` per entry. Retry + reconcile logic for offline / rejected vouchers.
- **Fallback:** if bridge is down, export XML for date range + voucher types; user imports into Tally manually; mark `tallyExportedAt`.

---

## 6. Asset Chain

### 6.1 Maintenance

**Entity:** `JobCard(jobCardNumber, vehicleId, openedAt, closedAt, totalCost, totalLabourCost, totalPartsCost, openingKm, closingKm, status, ...)`.

- `JobCardLine(jobCardId, lineType: Part|Labour, partId nullable, qty nullable, unitCost nullable, labourDesc nullable, hours nullable, cost)`.
- `TruckCheckList(jobCardId, checklistType, items json)` — pre-job inspection record.
- `ReplacementList(jobCardId, partId, qty, reason)` — parts marked for replacement.
- `ReplacementInward(replacementListId, returnedAt, conditionNotes, scrapBin)` — old/damaged parts received back.
- `JobCardServiceBill(jobCardId, vendorId, amount, ...)` → `JobCardServicePayment` via 3-stage workflow.

**PO ↔ Job Card relationship:** decoupled. POs feed Inventory; Job Cards consume Inventory. Same part bought once via PO can be used in many Job Cards.

### 6.2 Inventory

Single workshop at HO (per user — only one for now). Schema keeps `(partId, branchId)` for future expansion.

- `StockLedger(partId, branchId, currentQty, reorderLevel, valuationMethod: MovingAvg, lastValuation)` — denormalised current state.
- `StockMovement(partId, branchId, movementType: Inward|Outward|Adjustment, qty, reason: PO|JobCard|ReplacementInward|Adjustment, refType, refId, valuationAtMovement, createdAt)` — append-only audit ledger.
- Live qty = sum of movements (denormalised on `StockLedger.currentQty` for performance).
- Moving Average cost computed on each Inward; Outward (Job Card consumption) reads latest avg.
- Reorder-level alert triggers via Notifications module.

### 6.3 Driver Lifecycle

- Existing `Driver` master (DL number, DL expiry, etc.).
- `DriverSalary(driverId, monthYear, baseSalary, deductions, paidAt, paymentMode)` — monthly payroll record.
- `DriverAdvance` (per Trip — see §4.3).
- `DriverIncentive(tripId, driverId, ruleId, amount, computedAt)` — per-trip incentive (km-based, on-time-delivery-based; rule-configured).
- `DriverLedger` — running balance: salary + incentives − advances − recoveries.

**Doc expiry:** DL on Driver master; cron-driven scan emits 60/30/7-day-before notifications. Block trip-create if expired.

---

## 7. Customer-Facing Modules

### 7.1 Claims / Damage Settlement

**Origin (two paths converge on one Claim):**

- **Auto-trigger** when `LRAcknowledgement.damageQty > 0` or `shortageQty > 0` → `Claim(status=Pending)`. Operator confirms + fills `goodsValue`, `claimAmount`, `basisDescription`.
- **Customer-side** via Complaint with `category=DamageClaim` → system links/creates Claim.

**Entity:** `Claim(claimNumber, lrId, claimType: Damage|Shortage|Loss, claimedAmount, basisDescription, status: Pending|Active|Settled|Rejected, settledAmount, settledAt, ...)`.

**Recovery:**

- `ClaimRecovery(claimId, source: Insurance|Broker|Driver|Other, partyId, recoveredAmount, status: Filed|Approved|Received, ...)` — supports split recovery (60% insurance + 40% broker debit note).
- Auto-generates **debit note to broker** when source=Broker is Approved (broker payable reduces).
- Net SK loss = settledAmount − sum(approved recoveries).

`ClaimEvent` timeline like Order/LR.

### 7.2 Customer Complaint (detailed)

**Entity:** `Complaint(complaintNumber, raisedBy, raisedForCustomerId, category, severity, subject, description, status, slaDueAt, slaPausedAt, assigneeId, resolvedAt, ...)`.

**Children:**

- Polymorphic links: `ComplaintRelation(complaintId, refType: LR|Order|Bill|Vehicle, refId)` — one complaint can span many entities (e.g. "LR delayed + bill disputed").
- `ComplaintMessage(complaintId, authorId, body, attachments[], visibility: Internal|Customer, createdAt)` — back-forth thread.
- `ComplaintAttachment` via Attachments module.
- `ComplaintEvent(complaintId, ...)` — audit timeline.
- `Resolution(complaintId, rootCause, correctiveAction, preventiveAction, customerSatisfactionScore, resolvedAt)` — driven at close for systemic improvement.

**SLA + escalation:**

- Per-category SLA config (e.g. DamageClaim=72h, BillingDispute=48h, Delay=24h).
- Cron checks: at 50% breach → reminder to assignee; 80% → escalate to manager; 100% → escalate to dept head. All via Notifications.
- SLA pause when `awaiting customer response`.

**Intake:**

- v1: internal entry by SK staff (phone/WhatsApp/email triage).
- v1.5: email ingestion (`complaints@sktranslines.com` forwarder → parser → auto-create ticket).
- Customer portal deferred to post-v1 (matches no-customer-portal scope).

---

## 8. Compliance / Misc

### 8.1 E-way Bill

SK is **transporter**, not consignor. Customer (consignor) generates the EWB. SK:

- Stores EWB # against LR (manual attach from customer-provided data). Multiple EWBs per LR possible (multi-invoice consignment).
- Uses NIC EWB API for: **Part-B updates** (vehicle no, transporter ID — TRANSIN), **validity extension**, **lookup/validate**.
- Tracks expiry; alerts via Notifications module when EWB nearing expiry or in-transit truck still has EWB attached.
- `EWayBill(lrId, ewbNumber, ewbDate, validTill, partAStatus, partBStatus, currentVehicleNo, lastApiSyncAt, ...)`.

### 8.2 Reports / Dashboards

**Approach:** typed query modules — each report is first-class code (not free-form SQL):

- `Report(name, params schema, columns, filters, sort, permission, exportFormats: [CSV, XLSX])`.
- Lists are paginated. Heavy reports (>10s estimated) run as async jobs via BullMQ → email-when-ready.
- Initial set: LR Booking Report, Pending LR Report (Ack pending + TBB), Customer Ledger, Customer Ageing, Vehicle P&L, Detention Summary, Driver Settlement, Broker Payable, Pump Credit Balance, GSTR-1 JSON, Tally Sync Status, EWB Expiry Watch, SLA Breach.

---

## 9. New Masters Required (beyond the 26 existing)

| Master                                | Purpose                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CustomerLocation`                    | Per-customer pickup points (child of Customer).                                                                                       |
| `Route`                               | Source + destination city pair; drives trip distance + freight (RateMatrix) lookup. (Implemented.)                                    |
| `VehicleType`                         | 32HQ / 38LQ / 6Wheeler / 407 etc., with default freight ranges + detention slab match keys.                                           |
| `Broker`                              | Transporter/clearing-agent parties (LDC broker ack, transporter payments). (Confirm against existing `transport` master — may merge.) |
| `DetentionSlab` + `DetentionSlabTier` | Rule-tree for detention calculation.                                                                                                  |

---

## 10. Cross-Module Conventions

- **Soft delete:** `deletedAt` nullable on all transactional + referenceable tables. Queries auto-filter `deletedAt IS NULL`. Bulk hard-delete only via admin tool.
- **Optimistic concurrency:** `version` int column on every mutable row. `UPDATE ... WHERE id=? AND version=?` increments; service returns 409 on conflict.
- **Background jobs:** BullMQ on Redis for async (emails, Tally bridge, heavy reports, EWB API, antivirus scan). `pg_cron` or `node-cron` for scheduled (doc-expiry scans, SLA checks).
- **Money:** `Decimal` (Prisma) — never `Float`. All monetary fields.
- **Numbering atomicity:** per-branch + per-FY + per-docType counters via `SELECT FOR UPDATE` on a `DocumentSequence` row.
- **Identifiers:** CUIDs everywhere; timestamps ISO strings on the wire.
- **Branch scoping:** every transactional model has `branchId`. `branchFilter(req)` already exists in auth; apply to every list query. Writes pass through `assertBranchAccess`. `UserBranchAssignment(userId, branchId, primaryBranch)` enables multi-branch users (HO super-users assigned to all branches).
- **Event timelines:** every transactional entity has its own `<Entity>Event` audit child for detail-page replay (separate from global audit log).
- **Attachment polymorphism:** single `Attachment` table referenced via `(entityType, entityId)`. Every module that needs files uses it.

---

## 11. Build Phase Order (Vertical-Slice MVP)

| Phase                                | Modules                                                                                                                                             | Outcome                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **0 — Foundation**                   | Notifications, Attachments                                                                                                                          | Silent services. Future modules emit events + accept attachments from Day 1; no retrofit. |
| **A — Ops MVP**                      | Order Booking → LR (Road only) → Vehicle Trip → LR Ack → POD → simple Bill (Freight only) → Receipt                                                 | One real road consignment goes end-to-end from booking to payment. Demo-able value.       |
| **B — Money depth**                  | Bill (full GST + RoadGTA + RoadRail + CreditNote), Receivables (TDS + ageing), Accounts lite-ledger + JournalTemplate + Hamali + TransporterPayment | Real billing + collections work.                                                          |
| **C — Rail + Detention**             | Rake/VP/RR-MR, DC, LDCAck (Supervisor + Broker), DCApproval, DCPayment, DC Detention slab engine                                                    | Rail consignments + broker payments + auto-detention.                                     |
| **D — Asset chain**                  | Maintenance (Job Card + PO), Inventory, Driver Lifecycle (salary + incentive + expiry alerts)                                                       | Workshop + payroll + compliance.                                                          |
| **E — Customer-facing + compliance** | Claims, Customer Complaint (with SLA), EWB API (Part-B + extension), Tally bridge service                                                           | Full customer service + statutory pipes.                                                  |
| **F — Reports + polish**             | All typed reports, GSTR-1 export, dashboards, ageing reports, KPI views                                                                             | Management visibility.                                                                    |

Each phase ships behind a feature flag at the registry level, so the previous phase's flows are never destabilised.

---

## 12. AWS Deployment

**v1 (chosen):** Single EC2 holding ECS + DB (self-hosted Postgres) + Redis, all-in-one container or co-located services.

- **Pros:** cheapest possible (~$30–60/mo); simple ops; matches 200-daily-user scale.
- **Cons + risks (must be acknowledged):**
  - **Single point of failure** — instance failure = total outage.
  - **No automated failover** — manual restore from backup.
  - **Backups are your responsibility** — pg_dump cron → S3 + WAL-G or pgBackRest for PITR. Test restore quarterly.
  - **No horizontal scale headroom** beyond vertical EC2 sizing.

**Upgrade path (when load demands it):**

1. Extract DB to a separate EC2 (or RDS Multi-AZ) — DB is the highest-value, hardest-to-replace component.
2. Move Redis to ElastiCache.
3. Split API + workers into separate Fargate services behind an ALB.
4. Add CloudFront in front for static caching.
5. Add WAF on ALB.

**v1 components on the single EC2:**

- API + workers (same container, per user choice). Node 22, Express 5, Prisma 7.
- Self-hosted Postgres 17 with `pgBackRest` for backups → S3.
- Redis 7 for BullMQ + permission cache + sessions.
- Next.js (web) `output: standalone` running as Node services on the same host.
- nginx or Caddy as TLS-terminating reverse proxy in front.
- TLS via Let's Encrypt (Caddy auto-renews) or ACM if behind a basic ALB.

**Out-of-EC2 dependencies:**

- **S3** for attachments (POD, RC scans, agreements, claims docs, complaint attachments) — pre-signed URLs.
- **AWS SSM Parameter Store (SecureString)** for secrets — free, no rotation but adequate at this scale.
- **AWS SES** for transactional email (Notifications module).
- **Meta Cloud API (WhatsApp Business)** — direct, no BSP. Phone number via Meta Business Manager. Template approvals managed in-house.
- **Self-hosted Grafana + Loki + Tempo** on a small companion VM for observability (per user choice). Sentry (free tier) for error tracking.

**CI/CD:**

- GitHub Actions → build Docker image(s) → push to ECR → SSH deploy to EC2 with rolling restart (since Fargate is out for v1).
- Migrations run pre-deploy as a one-shot container with the new image.
- PR ephemeral preview env deferred (overkill at v1).

---

## 13. Verification & Acceptance Per Phase

- **Phase 0:** unit tests for event matcher + recipient resolver. Manual: emit a test event, verify in-app + email + WhatsApp delivery; verify subscription opt-out works.
- **Phase A:** end-to-end: create Order → approve → generate LR → assign Trip → close Trip → upload POD → Acknowledge LR → generate Bill → record Receipt. Verify all numbers + ledger movements.
- **Phase B:** GST-engine unit tests with the matrix of (billType × placeOfSupply × sellerState). Whirlpool-style split bills generate cleanly. CreditNote flow ends in correct ledger balance.
- **Phase C:** DC Detention slab calc tested against the worked examples in the SOP PDF (Bipin Singh ₹5000 / Big Truck / 407 hourly). Two parallel acks resolve correctly via DCApproval.
- **Phase D:** Job Card consumes Inventory, stock decrements, Moving Avg cost updates. DL expiry triggers all three reminder windows.
- **Phase E:** Claim auto-created from damaged Ack. Broker debit note generated on Approved recovery. Complaint SLA breach escalates correctly. EWB Part-B update succeeds against NIC sandbox.
- **Phase F:** GSTR-1 JSON validates against GSTN spec. All reports paginate + export CSV/XLSX.

---

## 14. Open Questions / Defer-to-Implementation

These don't block the plan but need a 1-pager when their phase begins:

- Exact RateMatrix lookup keys + fallback hierarchy (Item-order pricing especially).
- TripUnloadingPoint vs LR.toBranchId — do we always create one TUP per LR auto, or does ops plan TUPs first then assign LRs?
- Tally bridge protocol (HTTP API on the Tally host vs. shared XML drop folder) — choose at Phase B start based on what SK's Tally setup supports.
- WhatsApp template list + approval timeline (Meta Cloud API requires pre-approved templates for non-session messages).
- Broker vs Transport master overlap — confirm during Phase C whether to merge or keep separate.

---

_Generated from a structured grilling session (PDF SOPs + drawio + legacy code analysis). All decisions captured here are the user's explicit choices._
