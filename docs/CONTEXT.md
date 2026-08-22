# SKERP — Project Context & Domain

> Companion to [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md). Captures **business domain**, **legacy system context**, **glossary**, and the **"why" behind specific plan decisions** — the stuff that doesn't fit in an architecture doc but a new contributor (human or AI) needs to actually understand the system.
>
> Treat this as **stable context**. The plan changes; this doc grows.

---

## 1. About SK Translines

S K Translines Pvt. Ltd. is a multi-branch **road + rail freight forwarder** based in India (Maharashtra). Operates from branches in **Jalgaon, Pune, Mumbai, Nashik, Guwahati, Kolkata, Pondicherry, Hyderabad, Old Katta**, and others. Moves goods for both enterprise clients (Whirlpool, Britannia, CEAT, Samsonite, Nilons, Parle, Haier, Goodyear, LG, NILONS, Jain Irrigation, etc.) and general/walk-in freight.

Uses both **own fleet** (Vehicle master) and **market vehicles** (hired through brokers/transporters). Long-haul typically goes by rail (rake + VPs); first/last mile by truck.

Accounts are kept in **Tally Prime** (statutory source). The ERP feeds Tally.

Scale assumption for v1: ~6–10 branches, 500–1500 LRs/day at peak, 50–200 concurrent users daily.

---

## 2. Glossary

Domain terms used throughout the plan + codebase. Memorise these — they appear everywhere.

| Term                     | Meaning                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LR**                   | Lorry Receipt — the core transport document, one per consignment. Legal proof of goods accepted for carriage.                                                      |
| **Order Booking**        | Customer's request to move goods (Truck-hire or Item type). Spawns N LRs after Confirm.                                                                            |
| **Consignor**            | Sender of goods (usually the booking customer).                                                                                                                    |
| **Consignee**            | Receiver of goods. May or may not be a known customer.                                                                                                             |
| **POD**                  | Proof of Delivery — signed delivery receipt (paper, scanned into ERP). Required to bill.                                                                           |
| **GRN**                  | Goods Receipt Note — goods physically received at a branch (origin or destination).                                                                                |
| **TBB**                  | "To Be Billed" — Payment Mode meaning the booking customer will be invoiced later (vs Paid up-front or To Pay at delivery).                                        |
| **Rake**                 | A full goods train (multiple wagons) operated by Indian Railways. SK books own rakes.                                                                              |
| **VP**                   | Vehicle Placement — one wagon's worth of cargo space on a rake. A rake has several VPs (e.g. 7 VPs).                                                               |
| **RR**                   | Railway Receipt — Indian Railways' legal doc per VP. Entered into ERP from paper.                                                                                  |
| **MR**                   | Money Receipt — IR's receipt for railway freight SK paid. Entered into ERP from paper.                                                                             |
| **DC**                   | Delivery Challan — transport doc handed over at the railhead when goods move from rake → truck for last-mile delivery. One DC covers many LRs.                     |
| **LDC**                  | Local Delivery Challan (legacy: `LGST_DChallan`). Same concept as DC; the "L" prefix surfaces in screen names like "LDC Ack".                                      |
| **DC/WC at Rail Head**   | A combined form capturing **Demurrage Charges** (DC, for rake detention at railhead) and **Warpage Charges** (WC). Also captures **Waivel** (waiver of demurrage). |
| **Demurrage**            | Charge by Indian Railways for holding a rake/wagon beyond free time. Currently ₹150/hr per the SOP.                                                                |
| **Warpage**              | Charge for damaged goods during rail transit, paid to/by IR.                                                                                                       |
| **Waivel**               | A waiver granted (letter-based) on demurrage. Reduces what SK owes IR.                                                                                             |
| **Detention**            | Charge by SK to **the customer** for trucks/wagons held beyond free time at consignor/consignee site. Different from Demurrage (which is paid TO IR).              |
| **Hamali**               | Manual labour for loading/unloading goods. Three flavours: at origin GRN, at branch GRN, at VP Loading (rail).                                                     |
| **Broker / Transporter** | External party providing trucks (market vehicles) and clearing-agent services at railheads. SK pays them via the Slip → Entry → Approval workflow.                 |
| **GTA**                  | Goods Transport Agency — a legal classification under Indian GST. GTA services have special GST rules (5%/12% rate, RCM option).                                   |
| **RCM**                  | Reverse Charge Mechanism — for GTA services, the **consignor** (not the transporter) pays GST to the government. SK doesn't collect GST in this case.              |
| **Place of Supply**      | The destination state for GST purposes. Drives intra-state (CGST+SGST) vs inter-state (IGST).                                                                      |
| **CGST / SGST / IGST**   | Central / State / Integrated GST. For SK (Maharashtra), Maharashtra → Maharashtra = 2.5%+2.5%; Maharashtra → other state = 5% IGST.                                |
| **HSN / SAC**            | Tax classification codes — HSN for goods, SAC for services. Transport services typically `9965` (GTA) or `9967`.                                                   |
| **TDS**                  | Tax Deducted at Source — customer withholds ~2% (section 194C) from payments to SK. Reclaimed via Form 26AS reconciliation.                                        |
| **Log Slip**             | Internal trip closure document — official record that a vehicle finished a trip with end-km, end-time, expenses. Generated after Trip Close.                       |
| **Happay Card**          | Prepaid card given to drivers for fuel/toll expenses. Reconciled against trip expenses.                                                                            |
| **EWB**                  | E-way Bill — government-mandated transit pass (NIC portal) for goods > ₹50k. Customer generates Part A; transporter updates Part B (vehicle + transporter ID).     |
| **TRANSIN**              | Transporter ID issued by GSTN for EWB Part B updates.                                                                                                              |
| **FY**                   | Financial Year (India: April → March). E.g. FY26-27 means April 2026 – March 2027.                                                                                 |
| **Docket**               | Courier waybill number — tracks paperwork (POD originals) being couriered back to HO via DTDC/Shree Maruti etc.                                                    |
| **Retention**            | Amount the consignee holds back from freight payment until conditions met (rare; SK still tracks).                                                                 |

---

## 3. Legacy System Landscape

SK currently runs **two ASP.NET ERPs** — that's not a typo, two. They're not well integrated.

| URL                          | Internal name              | Used for                                                                                                              |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `http://l.sktranslines.com/` | "Snehal123" (ERP)          | Direct enterprise shippers (Samsonite, Whirlpool, Britannia). Has full Order → LR → Trip → Rail → DC → Accounts flow. |
| `http://35.154.123.37/`      | "Snehalj" / "Dumb website" | General freight, walk-in clients, "Generate Instant LR" (no prior order). Smaller subset of features.                 |

Database tables seen in legacy code (relevant examples): `LGST_DChallan`, `LGST_DCAcknowledgment`, `LGST_DCApproved`. Mostly stored procedures over SQL Server.

**The legacy code is the functional reference, never the architectural reference.** It demonstrates _what_ SK needs to do, not _how_ to model it. From `docs/ERP_DEVELOPMENT_PLAN.md` §2 and `CLAUDE.md`: do not port the dynamic `/:masterName` engine; do not port the runtime field-config metadata; do not port the `Float` money columns; do not port the `db push`-style schema management.

**Communication outside the ERP:** SK ops uses a WhatsApp group with branch supervisors (e.g. "Sanjay Sharma (Station)") for things the system can't track — chasing missing GRN, escalating stuck trips. The new ERP should reduce this with the Notifications module, but expect WhatsApp coordination to remain part of the workflow.

---

## 4. End-to-End Narrative (the happy path)

Read this as a story. Each numbered step maps to a module in the plan.

1. **Order Booking.** A customer (say Whirlpool) phones the Jalgaon branch and asks for 3 trucks from their Indospace Pune warehouse to Guwahati. Branch ops opens the ERP, picks the customer, fromBranch=Jalgaon, toBranch=Guwahati, pickupDate, pickupLocation (Whirlpool's Indospace Pune CustomerLocation), orderType=Truck, truckQuantity=3, vehicleType=32HQ. Submits → status `PendingApproval`.
2. **Order Confirm.** Jalgaon branch manager reviews. System auto-calculates freight from RateMatrix (₹140k as per the SOP example). Approver fills contact person (name/mobile/email), accepts → status `Confirmed`. Customer doesn't get notified (no customer portal); internal employees do via Notifications.
3. **Create LRs (up to 3).** Sales creates the first LR from the Order. Tabs: Order Details (auto), LR Details (consignor=Whirlpool snapshot, consignee=Whirlpool Guwahati warehouse), Item Details (multi-line goods), LR Freight Details (charges). Save → Finalise → LR# `SKT/JAL/26-27/00001` issued.
4. **Path split.** Long-haul Jalgaon→Guwahati typically goes by rail. So the LR has `mode=RoadRail`. SK has booked own rake `JAL/GHT/00089`. The LR is consolidated onto a VP via VPAssignment at VP Loading time.
5. **Rail leg.** VP Schedule → Generate RR/MR (data entry of railway receipts) → VP Loading (physical) → Rake Arrival/Departure dates entered → Finalise VP Schedule → GRN at Branch Station (Guwahati) → DC issued at railhead → DC/WC at Rail Head form filled (demurrage, waivel, warpage) → DC Acknowledgement (both Supervisor at Guwahati godown AND the broker who hauled the last mile, independently) → DCApproval (manager picks which ack to trust) → DCPayment to broker via 3-stage Slip→Entry→Approval.
6. **Last mile.** Broker truck delivers DC's LRs to consignees.
7. **LR Acknowledgement.** Guwahati branch ops opens LR Ack screen, enters received qty, damage qty, shortage qty, observed detention days, POD docket number (paper POD couriered back to HO via DTDC), uploads POD scan. LR moves to `Acknowledged` → `Delivered`.
8. **POD courier tracking.** Separate sub-tracker: PODDispatch record per LR captures docket #, courier vendor, dispatch date, expected receipt at HO.
9. **DC Detention calc.** Cron or trigger picks up the DC's dates, runs the slab engine (Bipin Singh slab, 32HQ slab, or 407 hourly slab per matchKeys), stores a DetentionCalc snapshot. Goes through Operator → Accounts → Manager approval.
10. **Bill.** After POD acknowledgement, Accounts is told whether the consignor or consignee will pay. Accounts opens "LR to Bill", selects Bill Head (`Consignor` or `Consignee`), Transport Type, then a Client drawn only from customers with acknowledged pending LRs. Accounts selects the LR(s); the system derives Bill To/GST details and Place of Supply = Assam from the Guwahati destination. Freight is locked (sourced from LR). GST engine: Maharashtra → Assam = 5% IGST under the documented RoadRail forward-charge rule. Whirlpool has `splitBillsByChargeType=true`, so two bills generate when both groups of charges exist: one for Freight (₹25k example), one for Detention/Hamali/additional charges (₹3k example), both linked to the same LR. Numbers `SKT/B/JAL/26-27/00xxx`.
11. **Receipt.** Whirlpool pays a month-end transfer covering 5 bills minus TDS. Receipt entered, allocated across bills via ReceiptAllocation rows (each with `tdsAmount` and later `tdsCertNumber` from Form 16A). Customer ledger updates.
12. **Tally posting.** Every journal entry (LR bill, receipt, broker payment, hamali, etc.) is tagged broker-wise (per legacy requirement). Bridge service syncs to Tally Prime.
13. **Anything wrong?** Damage qty > 0 at step 7 auto-creates a Claim. Customer calls complaining → Complaint module ticket, polymorphic-linked to the LR + Bill. SLA tracked.

---

## 5. Key Business Rules — the "Why" behind plan decisions

These are the surprising rules. New contributors should understand the _reason_, not just the rule.

### 5.1 One LR can have multiple Bills (Whirlpool requirement)

**Plan rule:** M:N between LR and Bill via `BillLine`.

**Why:** Legacy enforced 1 LR : 1 Bill. When Whirlpool demanded a separate Freight Bill (₹25k) and a separate Detention/Hamali Bill (₹3k) against the same LR, ops invented **fake/dummy LR numbers** as a workaround. Plan must support split-by-charge-type natively, gated by a `Customer.splitBillsByChargeType` flag.

**Source:** "Detailed ERP Software Updation Requirement for Whirlpool Billing Process" PDF.

### 5.2 Two parallel DC Acknowledgements (Supervisor + Broker)

**Plan rule:** `DCAcknowledgement` has `ackType: Supervisor | Broker`. Two rows per DC, not sequential.

**Why:** Discovered via legacy code analysis (`DCAckCollection.aspx`, `DCAcknowledgment.aspx`). SK supervisor at the godown acks what was actually received. The broker who hauled the load files their own claim (often inflated). Approver picks which version to trust at DCApproval → drives broker payable. **Mismatch detection prevents fraud.**

### 5.3 LDC = Local Delivery Challan (not "Loaded DC")

**Why noted:** The acronym was unclear from PDFs alone. Confirmed via legacy code (`LGST_DChallan` table). LDC and DC refer to the **same document type** — "LDC" appears in screen titles like "LDC Ack" but it's just a DC.

### 5.4 No 10-minute wait in the new system

**Plan rule:** Log Slip generation is synchronous on Trip Close.

**Why:** Legacy SOP literally instructs operators to "wait exactly 10 minutes after clicking Trip Close before generating the log slip" because background ledger values need to update. This is an eventual-consistency hack. New system runs all calcs (expense totals, KM, distance, P&L) in one transaction so Log Slip is ready immediately.

**Source:** "S K Translines Pvt. Ltd. | Complete Vehicle Log Slip Process Guide" PDF.

### 5.5 Customer is the EWB originator, not SK

**Plan rule:** EWB is manually attached to LR; API used for Part-B updates + validity tracking only.

**Why:** SK is the **transporter**, not the consignor. Customer (Whirlpool, etc.) generates the e-way bill on the NIC portal. SK gets the EWB number, attaches it to the LR, and uses the EWB transporter API to update Part-B (vehicle no, TRANSIN) and extend validity when trucks run late.

### 5.6 "HO is just a branch"

**Plan rule:** No special-case code for HO. Multi-branch users via `UserBranchAssignment`.

**Why:** Keeps permission middleware uniform. A HO super-user gets assignments to every branch via seed data, not a code path. Avoids two-mode logic that drifts.

### 5.7 Detention has many slab shapes — must be data, not code

**Plan rule:** `DetentionSlab` + `DetentionSlabTier` rule-tree, matched by (party, broker, vehicleType, freightRange).

**Why:** SOP documents at least three different slab patterns: "Bipin Singh" (day-wise, first+last free, ramped ₹1000 → ₹1500), "Big Truck 32HQ/38LQ" (day-wise, first+last free, flat ₹1500/day, freight range 9–11k), "Small/407" (**hour-wise**, first 24h free, ₹1000/24h thereafter, freight range 4–8k). Future parties will have their own variants. Hardcoding any of this means a developer change per customer.

**Source:** "Detailed DC Detention Working Process" PDF.

### 5.8 LR Freight is locked on Bill but revisable on LR (separately)

**Plan rule:** Bill copies LR freight read-only. To change freight after LR finalisation, use the separate `lr.freight.revise` permission and `LRFreightRevision` audit table. Bills already generated are NOT auto-updated — issue a Credit Note + new Bill.

**Why:** GST law makes invoice fields immutable after issuance. But typos + renegotiation are real. The split lets ops fix the LR cleanly while keeping historical bills intact and giving a deliberate path (credit note) for invoice correction.

**Source:** "ERP Software Tutorial – Bill Generation Process" PDF mentions "update LR Freight" as a separate option.

### 5.9 Notifications go to **employees only**, not customers

**Plan rule:** Notifications module dispatches to internal users only. No customer notifications in v1.

**Why:** User explicit decision. No customer portal in v1; customer learns via existing channels (phone/email/WhatsApp from sales team). All system alerts route to SK employees with subscription overlay for opt-out of non-critical alerts.

### 5.10 Customer Complaint is "detailed, better than legacy"

**Plan rule:** Full helpdesk-style entity with polymorphic linking, threaded messages, SLA + escalation, RCA + Preventive Action + CSAT score.

**Why:** User explicitly requested "I want a detailed customer complaint manager module which will be much more better than legacy stuff". Legacy had a single-table complaint with no SLA, no thread, no RCA. New module is greenfield design — go big.

### 5.11 Pumps act as both vendors AND barter counterparties

**Plan rule:** Pump master + ledger; JournalTemplate `PumpBarter` posts 3 lines (client freight credit, vehicle freight debit, commission expense).

**Why:** "Jai Anand Transport" is both a pump (sells diesel) and a transporter (a client of SK). They offset: SK transports their goods (revenue) and SK fuels at their pump (expense). The 5% commission on freight is a real auto-posted line per the Log Slip SOP. Pumps need: diesel rate, VAT TIN, credit limit, PAN — i.e. full vendor-like profile.

**Source:** Log Slip Process PDF + Petrol Pump master PDF.

### 5.12 Single workshop at HO (for now)

**Plan rule:** Inventory schema is per `(partId, branchId)` but v1 has only one branch row (HO). Single global stock pool in practice.

**Why:** User clarified mid-grill that SK has only one workshop, at HO. Schema keeps the dimension so future workshop expansion is a data change, not a migration.

---

## 6. Client-Specific Quirks (the named ones)

| Client                                                 | Quirk                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Whirlpool**                                          | Requires separate Freight Bill + separate Detention/Hamali Bill against the same LR. Drives `Customer.splitBillsByChargeType` flag. Bills via legacy "Snehal123" environment in old system. |
| **Britannia, Samsonite**                               | Direct ERP shippers — same "Snehal123" environment, "Update LR Finalised" flow.                                                                                                             |
| **Walk-in / general freight**                          | "Generate Instant LR" path with no parent order. v1 supports this via `LR.orderId nullable`.                                                                                                |
| **Jai Anand Transport**                                | Pump + transporter + barter counterparty (see §5.11).                                                                                                                                       |
| **Goodyear, LG, Haier, Nilons, Jain Irrigation, CEAT** | Standard enterprise flow — orders → LRs → bills.                                                                                                                                            |

---

## 7. Critical Non-Obvious Decisions

A grab-bag of small but important calls captured during the grill:

- **Order numbering: per-branch + per-FY**, zero-padded — e.g. `SKT/JAL/26-27/00001`. Same scheme for LR (separate counter) and Bill (`SKT/B/...`) and CreditNote (`SKT/CN/...`). Atomic via `SELECT FOR UPDATE` on a `DocumentSequence` row.
- **Two detention fields on Ack** — `LRAcknowledgement.observedDetentionDays` (what destination ops eyeballed) AND `DetentionCalc.detentionDays` (formal calc from dates). They should match; mismatches flag for accounts to investigate.
- **POD courier tracking is a separate sub-entity** — not just fields on LR Ack. Has its own status: dispatched → in-transit → received at HO. Powers "where is the signed POD for LR X?" queries.
- **Customer credit-limit check is SOFT** — at Confirm, approver sees "Customer at ₹5L of ₹4L limit, confirm anyway?" and proceeds with logged reason. Doesn't block.
- **Vehicle availability is denormalised** — `Vehicle.currentStatus` column updated by service-layer on trip + maintenance state changes. Truth is derived from active trip/maintenance rows; column is a cache. Periodic reconciliation job catches drift.
- **Doc expiry blocks trip creation** — DL, RC, Insurance, Permit, Fitness, PUC. 60/30/7-day-before warnings via Notifications; hard block at expiry.
- **TripUnloadingPoint stays** — even if 95% of trips are single-drop. Powers per-stop dwell-time, route ordering, planned-vs-actual reporting.
- **Cancelling an Order is blocked** if any non-cancelled LR exists on it. User must cancel LRs first.
- **LR cancellation post-finalisation** is a separate concern — not yet fully spec'd; flag at implementation time.

---

## 8. Cost / Infra Stance (the user's preference)

Captured here because it'll re-surface every time someone proposes infra:

The user is **cost-sensitive on infra** and pushed back hard when proposals tilted enterprise. For v1: single EC2 holding ECS + self-hosted Postgres + Redis. No WAF, no CloudFront, no Multi-AZ. ~$30–60/mo. Accepts SPOF risks. Upgrade path documented in [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §12.

When proposing infra: lead with lean option, present enterprise upgrades only as the "when load demands it" path, always include $/mo in trade-offs.

---

## 9. What's Authoritative Where

| Question                                                                 | Read this                                                        |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| What entities exist, what's their shape, what fields?                    | [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §4–§8             |
| What's the phase order?                                                  | [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §11               |
| Cross-module conventions (soft delete, money, jobs, branch scope, etc.)? | [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §10               |
| AWS deployment topology?                                                 | [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §12               |
| How to verify a phase ships correctly?                                   | [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) §13               |
| Master CRUD architecture, no-dynamic-engine rule?                        | [MASTER_MODULE_PLAN.md](MASTER_MODULE_PLAN.md)                   |
| How do I manually understand/test the current Order -> LR flow?          | [CURRENT_ORDER_LR_FLOW_GUIDE.md](CURRENT_ORDER_LR_FLOW_GUIDE.md) |
| Auth/permission/branch-scoping patterns?                                 | [RBAC_PLAN.md](RBAC_PLAN.md)                                     |
| Stack + design system + folder rules?                                    | [../CLAUDE.md](../CLAUDE.md)                                     |
| Domain meaning of LR/VP/DC/Hamali/etc.?                                  | **This file, §2**                                                |
| Why a specific plan decision was made?                                   | **This file, §5**                                                |
| Who SK is, what they do, what the legacy looks like?                     | **This file, §1 + §3**                                           |
| The happy-path narrative end-to-end?                                     | **This file, §4**                                                |
| Client-specific quirks (Whirlpool etc.)?                                 | **This file, §6**                                                |

[ERP_DEVELOPMENT_PLAN.md](ERP_DEVELOPMENT_PLAN.md) is **superseded** for module scope/ordering by `ERP_MODULE_PLAN_V2.md` but kept for historical context.

---

## 10. Maintenance Notes for This File

- **Update when:** new business rules surface, new client quirks emerge, terminology changes, legacy system facts are corrected.
- **Don't update for:** transient implementation decisions (those belong in code comments or commit messages), bug-fix details, in-flight work status.
- **Add a new section if:** a new domain area (e.g. customs/import-export, insurance claims chains, government contracts) gets added to scope.
- **Keep narrative tone** — this doc is for humans who need to understand the business. The plan is for humans who need to build it.
