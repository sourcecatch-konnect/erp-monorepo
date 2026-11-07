# SKERP — Flow Diagrams vs Implementation: Status & Completion Map

> **Purpose.** The three diagrams in `docs/diagrams/` are the agreed picture of the whole
> ERP. This document checks **every box in all three against the code** and turns the
> difference into a sequenced completion plan.
>
> Use it as the entry point before starting any new module: find the box, read its status,
> follow the link to its detailed plan.
>
> **Date:** 2026-11-06 · **Branch:** `ERP-79/LDCBrokerPaymentAndDetentionSlabs`
> **Method:** every node read from the `.drawio` XML, then verified against
> `apps/server/src/modules/`, `schema.prisma`, `apps/web/app/(dashboard)/` and the route
> mounts in `index.ts`. Nothing below is from memory.
>
> **Companions:** [`ACCOUNTS_AUDIT_2026-11-06.md`](./ACCOUNTS_AUDIT_2026-11-06.md) ·
> [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) ·
> [`LDC_PHASE_L0_IMPLEMENTATION_PLAN.md`](./LDC_PHASE_L0_IMPLEMENTATION_PLAN.md) ·
> [`ERP_MODULE_PLAN_V2.md`](./ERP_MODULE_PLAN_V2.md)

**Status key:** ✅ Built · 🟡 Partial · ❌ Missing (no module, no model) · 📄 Needs a
business decision before building

---

## 1. Headline

**The operational spine is built. The money chain is built but not closed. The outer ring
— claims, complaints, Tally, reports — does not exist at all.**

| Band | Boxes | ✅ | 🟡 | ❌ |
|---|---|---|---|---|
| Order → LR → Road/Rail → Delivery (ops) | 24 | 21 | 3 | 0 |
| Billing → Receipt → Ledger (money) | 12 | 9 | 2 | 1 |
| Broker / vendor payment chain | 7 | 4 | 1 | 2 |
| Outer ring (claims, complaints, Tally, reports, GSTR) | 9 | 0 | 1 | 8 |

**Four diagram boxes have no module, no model and no route** — verified by grep returning
zero across `modules/`, `schema.prisma` and `index.ts`:

- **Claims** (`claims` in all three diagrams)
- **Customer Complaint + SLA + Resolution** (a whole swimlane in diagram 2, a whole phase
  panel in diagram 3)
- **Tally Bridge** (the terminal box of the money chain in all three)
- **Reports & Dashboards / GSTR-1** (the full-width band in diagrams 1 and 3)

**Two boxes sit on the critical path of the rail flow and are missing** — `DC
Acknowledgement` and `DC Approval`. This matters more than their size suggests; see §4.1.

---

## 2. Diagram 1 — `erp-business-flow-a3.drawio` (business overview)

| # | Box | Status | Evidence / gap |
|---|---|---|---|
| — | Customer / Shipper requests transport | ✅ | External actor |
| 1 | Order Booking | ✅ | `modules/order`, `/orders` |
| 2 | Approval (freight + credit warning) | ✅ | Order approval flow |
| 3 | LR | ✅ | `modules/lorry-receipt`, `modules/lr-group` |
| — | Instant LR | ✅ | `LRSource.INSTANT` |
| 4A | Road Movement (trip, driver, route, log slip) | ✅ | `modules/trip`, `trip-expense`, `vehicle-journey`, `log-slip` |
| 4B | Rail Movement (rake, VP, RR/MR, DC, railhead charges) | ✅ | `rail-rake`, `rail-rake-operation`, `vp-schedule`, `vp-loading`, `rail-branch-grn`, `delivery-challan` |
| — | **DC Detention** (slab + approved) | 🟡 | Slab engine and calc ✅ (`modules/detention`). **"approved" ❌** — there is no detention approval chain; the figure is approved implicitly when the payment slip is approved |
| 5 | Delivery & POD | ✅ | `lr-delivery.route.ts`, attachments |
| 6 | Billing / GST Invoice (+ split) | ✅ | `modules/billing`, `BillingTaxRule`, `splitBillsByChargeType` |
| 7 | Receipts (payment, allocation, TDS) | 🟡 | ✅ built; **on-account/advance receipts ❌** (audit E-5) |
| 8 | Accounts Ledger (customer, vendor, broker, vehicle P&L) | ✅ | `modules/ledger`, double-entry, statements, ageing, vehicle P&L via log slip |
| — | **Tally Prime** | ❌ | **No module.** Columns + a UI badge only (audit D-9) |
| — | **Reports & Dashboards** (11 named reports) | ❌ | No `reports` module. `modules/dashboard` has widgets only. **No Trial Balance** (audit F-1) |
| — | Masters 26+ | ✅ | All present |
| — | New Masters (locations, vehicle types, brokers, detention slabs) | ✅ | CustomerLocation ✅ · VehicleType ✅ · DetentionSlab ✅ (this branch) · **Broker — satisfied by the existing `Transport` master by decision (Q24), not a gap.** See §4.3 |
| — | Users / Roles / Branch Access | ✅ | `modules/admin`, RBAC + branch scope |
| — | Notifications | ✅ | `modules/notifications` |
| — | Attachments | ✅ | `modules/attachments` |
| — | Maintenance (job cards, service bills) | ✅ | `job-card`, `service-bill` |
| — | Inventory (spares) | ✅ | `spare-*`, `purchase-order`, `spare-inward`, `supplier-replacement` |
| — | Driver Lifecycle | ✅ | `driver`, `driver-finance`, `driver.sweeps.ts` (expiry) |
| — | **Claims** | ❌ | **No module, no model.** Plan exists: `CLAIMS_JIRA.md` |
| — | **Customer Complaint** | ❌ | **No module, no model** |
| — | E-way Bill | 🟡 | `modules/ewaybill` ✅ with Part-B pending/update; NIC live API integration unverified |

---

## 3. Diagram 2 — `erp-data-flow.drawio` (role swimlanes)

Lane-by-lane. Only differences from §2 are listed.

**Sales & Booking** — all ✅.

**Road Operations** — Vehicle Trip ✅ · Unloading Points ✅ · Trip Close + Log Slip ✅ ·
Transporter Payment (market vehicle) ✅ (`VendorPaymentSlip type=TRANSPORTER`).

**Rail Desk** — VP Schedule ✅ · RR/MR ✅ · VP Loading ✅ · Rake Arrival/Departure ✅ ·
GRN at Branch Station ✅ · Issue DC ✅ · Railhead Charges ✅ *(recorded, but **not posted to
the ledger** — audit D-8)* · **DC Acknowledgement ❌** · **DC Approval ❌** · DC Detention 🟡
· DC/LDC Payment to broker ✅.

**Destination & Delivery** — LR Acknowledgement ✅ · POD Upload ✅ · Delivered/Closed ✅.

**Accounts & Billing** — LR to Bill ✅ · Receipt 🟡 · Accounts Ledger ✅ · **Tally Prime ❌**
· Transporter Payment ✅ · Hamali Payment ✅.

**Workshop & Maintenance** — PO ✅ · Inward Stock ✅ · Inventory ✅ · Job Card ✅ · Service
Bill ✅ · Service Payment ✅ · Driver salary/advance/incentive ✅.

**Customer Care & Compliance** — E-way Bill 🟡 · **Claims ❌** · **Customer Complaint ❌**.

---

## 4. Diagram 3 — `erp-flow-v2.drawio` (module flow map) — the gaps it alone reveals

Diagram 3 is the most detailed and surfaces items the other two do not.

| Box | Status | Note |
|---|---|---|
| Lite Ledger (P0) | ✅ | `LedgerEntry` — but now half-retired (audit G-4); diagram should be updated |
| RateMatrix + Credit Check (soft) | ✅ | |
| **LR Freight Revision** (separate perm + audit) | ❌ | `grep "model LRFreightRevision"` → **0**. `ERP_MODULE_PLAN_V2.md` §5.8 specifies it; the permission and audit table do not exist |
| Credit Note `SKT/CN` | 🟡 | Built — but writes **no `LedgerAllocation`** and **no GST reversal** (audit D-1, E-2). **This is the single most urgent defect in the system** |
| ReceiptAllocation + TDS Cert (Form 16A) | 🟡 | Allocation ✅; `tdsSection`/`tdsCertNumber` captured but **not enforced**, and no Form-16A/26AS report (audit F-11) |
| Customer Ledger + Ageing | ✅ | Correct, with the reversal-echo guard |
| **Claim → Claim Recovery → Broker Debit Note** | ❌ | Entire chain absent |
| JournalEntry (N lines, broker-tagged) | ✅ | |
| **JournalTemplate** | ❌ | Not built as a table; equivalent exists as 20 typed functions in `posting.service.ts` — **a better design; update the diagram, don't build the table** |
| 3-Stage Payment Primitive | ✅ | Exactly as drawn — `VendorPaymentSlip` → approval → disbursement |
| Hamali Payments (3 sources) | ✅ | `GRN_HAMALI`, `RAIL_BRANCH_GRN`, `VP_LOADING` |
| **Tally Bridge (HTTP + XML fallback)** | ❌ | |
| **GSTR-1 JSON Export** | ❌ | |
| Doc Expiry Cron (60/30/7 + hard block) | 🟡 | `driver.sweeps.ts` exists; the **hard block on trip-create at expiry** needs verification |
| Replacement List → Replacement Inward | ✅ | `supplier-replacement` |
| SLA Cron + Escalation, Resolution, Email Ingestion | ❌ | Depend on the missing Complaint module |
| Whirlpool `splitBillsByChargeType` | ✅ | |

### 4.1 The one flow-order discrepancy that matters

All three diagrams draw the rail money path as:

```
Issue DC → Railhead Charges → DC Acknowledgement (Supervisor ‖ Broker)
         → DC Approval (pick trusted version) → DC Detention → DC/LDC Payment
```

**The implementation does:**

```
Issue DC → [LDC payment slip: detention computed inline from LR dates] → Payment
```

Two differences, not one:

1. **The acknowledgement and approval stages are skipped entirely** (known: `LDC_WORKFLOW_PLAN.md` G4, audit F-12). The diagrams place them *on the critical path*, which settles a question I had left open — **Q8 ("is this stage wanted now?") is effectively answered "yes" by all three diagrams.** I have not closed Q8 on that basis alone, because the diagrams show intent rather than a scheduling decision, but the design question is settled.
2. **Detention is drawn *after* DC Approval, not before it.** This is new and is *not*
   covered by the existing LDC plan. The planned `DCAcknowledgement` carries
   `reportingDate`, `deliveryDate` and `collectionDate` — so under the diagrams, **the
   approved acknowledgement's dates are what drive the detention calculation**. Today the
   engine takes its dates from `LRDelivery.reportedAt` / `unloadingAt` and
   `DeliveryChallan.reportDate`. Those are different sources, and when supervisor and
   broker disagree about dates, the diagram's flow is the one that resolves it.

   **📄 This needs a decision (new — Q18):** when DC Approval exists, do the approved ack's
   dates replace the LR-derived dates as the detention input, or does the LR data stay
   authoritative with the ack used only for the money heads? This changes where
   `resolveDetentionWindow` gets its input and must be settled **before L5 is designed**.

### 4.3 "Broker" = the existing `Transport` master · **Q24 CONFIRMED — do not build a Broker master**

The diagrams list `Broker` under *New Masters* and `transporters` under the existing
*Masters 26+*, which reads as two separate masters. **It is not.** Confirmed by the
business on 2026-11-06:

> When a truck is hired for the railhead→destination leg, it comes from the **Transport
> master**, and that party is referred to as the **broker**. "Broker" is the role a
> transporter plays on the last mile, not a separate entity.

**Decision: no `Broker` model, no broker module, no migration.** The existing wiring is
correct as built and must not be changed:

| Relation | Status |
|---|---|
| `DeliveryChallan.transportId` → `Transport` | ✅ correct — the DC's broker |
| `DetentionSlab.transportId` → `Transport` | ✅ correct — the slab's broker scope |
| `VendorPaymentSlip.transportId` → `Transport` | ✅ correct — the LDC broker payee |
| `Ledger.transportId` → `Transport` | ✅ correct — the broker's party ledger |

This also closes the open item in `ERP_MODULE_PLAN_V2.md` §9 (*"Confirm against existing
`transport` master — may merge"*): **merged, by decision.** The diagrams' *New Masters* box
should be amended to drop `Broker`, or annotate it as "= Transport".

**Still genuinely missing and broker-related:** `JournalEntryLine.brokerTag` (plan §290 —
*"Broker tag on every line that touches broker activity, per legacy requirement for
broker-wise Tally posting"*). `grep brokerTag` → **0**. Not needed until the Tally bridge
(Stage 4.4); noted so it is not forgotten then.

### 4.2 Built but absent from all three diagrams

These exist and work; the diagrams are out of date, not the code:

`tracking` · `one-lap-tracker` · `my-work` · `training` · `feedback` · `mrrr` ·
`cash-planning` (a whole treasury subsystem, now posting PAYMENT vouchers) ·
`vehicle-cost` / `vehicle-journey` · `agreements` · Chart of Accounts / Manual Journal /
Day Book / Opening Balances screens.

**Recommendation:** add Cash Planning and the Books-of-Account screens to diagram 1 — they
are user-facing finance surfaces that a reader of the diagram would wrongly assume absent.

---

## 5. What the diagrams change about the plan

1. **They confirm the DC Ack/Approval stage is core, not optional.** It is drawn on the
   critical path in all three. LDC phase L5 moves from "largest, is it wanted?" to
   "required to match the agreed flow".
2. **They add Q18** (§4.1) — detention's input dates after approval exists.
3. **They confirm detention has a customer-billing side.** Both diagram 1 and diagram 2
   draw `DC Detention → Billing` ("detention charge"). Today that works only by an
   operator hand-entering an `LRCharge` of type `DETENTION`; the slab engine prices the
   *broker payable* only, by deliberate design (`detention.service.ts`: customer is not a
   match scope). **📄 Q19: should customer detention also be priced from a slab, or stay
   manual?** The diagrams do not say, and I will not guess.
4. **They do not change anything about L0–L4**, which remain correct as planned.

---

## 6. Completion roadmap

Ordered by *risk removed per unit of work*, not by diagram position. Items marked 📄 cannot
start until the named question is answered.

### Stage 1 — Close the money chain (highest risk, smallest work)

| # | Work | Why first | Ref |
|---|---|---|---|
| 1.1 | **Credit/debit note `LedgerAllocation`** | Outstanding and Ageing are wrong today for any customer with a note. Smallest change, largest correctness gain | Audit D-1 / P0-1 |
| 1.2 | **Detention claim fallback** | ✅ **DONE** this session (L0-1) | Audit D-14 |
| 1.3 | **Reversal date / FY** | ✅ **DONE** this session, provisional (L0-2) | Audit D-5 |
| 1.4 | **Credit-note lock** (race) | Same handler as 1.1 | Audit D-3 |
| 1.5 | **GST rule `chargeMechanism`** | 10-line fix, tax-filing exposure | Audit D-4 |
| 1.6 | 📄 **Transporter advance posting** | Cash leaving the business is unrecorded, first-mile *and* last-mile | Audit D-2 · **Q5** |
| 1.7 | **Reconcile job** (5 identities incl. wrong-side GL) | Turns the next D-1 into an alert, not a silent quarter | Audit P0-4 |

### Stage 2 — The reports the business cannot close books without

| # | Work | Ref |
|---|---|---|
| 2.1 | **Trial Balance** (branch, FY, group subtotals) | Audit F-1 |
| 2.2 | **Account-wise GL ledger** with drill-through | Audit F-2 |
| 2.3 | **Party opening balances** — blocker for legacy cutover | Audit F-3 |
| 2.4 | Day Book pagination; Journal Register | Audit D-7, F-14 |
| 2.5 | Rail rake charge payment posting | Audit D-8 |

### Stage 3 — Finish LDC (the module in flight)

L0 ✅ done · L1 📄 **Q1** · L2 📄 **Q3** · L3 📄 **Q5–Q7** · L4 📄 **Q11, Q15** ·
L5 📄 **Q8–Q10, and now Q18**. See [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §6.

### Stage 4 — The missing outer ring

| # | Work | Note |
|---|---|---|
| 4.1 | **Claims** | `CLAIMS_JIRA.md` already specifies it; C7 explicitly waits on the LDC merge |
| 4.2 | **Customer Complaint + SLA + Resolution** | Largest greenfield module left. No plan doc exists yet — needs one before coding |
| 4.3 | **LR Freight Revision** | Small; `ERP_MODULE_PLAN_V2.md` §5.8 |
| 4.4 | **Tally Bridge** | **Must come after Stages 1–2.** Syncing wrong numbers into the statutory book is worse than not syncing. Needs D-1 (bill allocations), E-2 (GST on notes), F-3 (opening balances) |
| 4.5 | **GSTR-1 export** | After 4.4 |
| 4.6 | **Reports module** (the 11 named reports) | Several are thin wrappers once 2.1/2.2 exist |

### Stage 5 — Hardening

Period/FY close (F-7) · posted-voucher immutability (F-8/F-9) · integration-test harness
(P2-1) · retire the parallel `LedgerEntry` (G-4) · branch-scope the five legacy ledger
reads (D-10).

---

## 7. Open business decisions

Carried forward, plus two new ones from the diagrams. **None is assumed.**

| # | Question | Blocks |
|---|---|---|
| Q1 | Which `paymentBy` values make a broker a payee? | LDC L1 |
| Q3 | Which detention warnings block submission? | LDC L2 |
| Q4 | Confirm the no-house-slab rule | LDC L2 |
| Q5–Q7 | Transporter advance treatment, funding source, historical correction | Stage 1.6, LDC L3 |
| Q8–Q10 | DC ack/approval scope, accrual point, grandfathering | LDC L5 |
| Q11, Q15 | Deduction-head GLs (**all ten codes**); overpayment recovery | LDC L4 |
| Q13, Q14 | Claim above slab; audit existing ₹0 detention lines | LDC L0 follow-up |
| Q16 ✅ | **ANSWERED: current date, original untouched, `reversesId` kept for audit, FY/closed-period rules respected.** This is Option 2 — the provisional L0-2 code implemented Option 1 and **must be corrected** | L0.1 |
| Q17 | In-flight draft LDC slips (resolve by count query) | LDC L0 deploy |
| **Q18** ✅ | **ANSWERED: approved DC Acknowledgement dates are the source of truth; unapproved dates must not drive the final calculation.** The pure engine is unaffected — only `detention.service.ts` changes its date source | LDC L5 |
| **Q19** ✅ | **SUPERSEDED 2026-11-06. Final answer: customer detention needs NO slab and NO calculation.** It stays hand-entered as `LRAcknowledgement.detentionAmount`, taxable, exactly as today (Q21, Q22 confirm this). Detention slabs serve the **broker only** — which is what is already built. **Phase L6 is cancelled**; no `appliesTo` discriminator, no migration, and the double-billing risk disappears. `LRChargeSource.DETENTION_CALCULATION` stays dormant | — (closed) |

---

## 8. Recommended next step

**Finish closing the money chain (Stage 1) before opening any new module.** Specifically
1.1 → 1.4 → 1.5 → 1.7, which need **no business decisions at all** and remove the three
defects that silently corrupt customer-facing numbers today.

LDC can resume in parallel the moment **Q1** is answered — L1 is otherwise ready, and its
display half is already in place.

Do not start Tally, Claims or Complaints yet: Tally depends on Stage 1 and 2 being correct,
and Claims depends on the LDC merge by its own plan's sequencing.
