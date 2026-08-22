# Accounts Module — Legacy→New Map & Build Plan

> **Purpose.** Step-1 context dump for building the Accounts module in the new ERP (`erp-monorepo`). This documents **exactly how the legacy ASP.NET ERP (`SK_Logistics`) handles each accounting stage today**, what the new repo already has, and the concrete gap/decision list for the rebuild.
>
> **Ground rule (from the user):** We are **not** porting legacy blindly. For each stage: understand what legacy does → decide whether to keep the working logic or design something better. Legacy is reverse-engineered evidence, not a spec.
>
> **Scope note:** The new repo's `cash-planning` subsystem (`CashPlanDay` / `CashPayment` / `CashReceivable` / `Creditor`) is a forward-looking treasury/cash-flow planner and is **explicitly out of scope** for this module — do not try to reconcile Accounts against it. The Accounts module (ledger + billing + receivables + vendor payments + Tally) is greenfield.
>
> Companion docs: [`ERP_MODULE_PLAN_V2.md`](./ERP_MODULE_PLAN_V2.md) §5.3 (Accounts spec), §5.1 (Billing), §5.2 (Receivables); [`MASTER_MODULE_PLAN.md`](./MASTER_MODULE_PLAN.md); [`RBAC_PLAN.md`](./RBAC_PLAN.md).

---

## 1. The legacy accounting spine: a posted double-entry ledger + Tally bridge

Everything in legacy Accounts funnels into **one table — `LGST_AccountLedger`** — and then out to **Tally** via XML. Understanding this is the whole module.

### 1.1 The ledger table (`LGST_AccountLedger`)

One row = **one debit OR one credit line**. A transaction is N rows sharing a `VoucherNo`. Written through `AccountLedger_BL.InsertLedgerEntry(...)` (legacy `SK_Logistic_BL/AccountLedger_BL.cs`).

| Column                                   | Meaning                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ClientId` / `TransporterId` / `TruckId` | Party identity when the line hits a **party ledger** (FK to a master). Zero when the line hits a named ledger.                                                                                                                                                                                   |
| `LedgerType` (string)                    | Named ledger when not a party — e.g. `FreightCharges`, `Detention`, `Hamali`, `IGST@2.5%`, `TDSReceivable`, `DamageDeduction`, `RateDifference`, `Transportation`, `DetentionExps`, `Commision`, `PrintingStationary`, `TDSContractor`, `FreightPayable`, `Labour_<id>`, a bank name, or `Cash`. |
| `BranchId`                               | Posting branch.                                                                                                                                                                                                                                                                                  |
| `Particular`                             | Narration string.                                                                                                                                                                                                                                                                                |
| `DebitAmount` / `CreditAmount`           | One is non-zero, the other 0.                                                                                                                                                                                                                                                                    |
| `VoucherType`                            | Drives Tally voucher classification — `Sale <BranchShortCode>`, `Cash Receipt <branch>`, `Bank Receipt <branch>`, `Cash Payment <branch>`, `Bank Payment <branch>`, `Journal`, `Logslip`.                                                                                                        |
| `ReferenceType`                          | **Source module** that posted the line — `BillGeneration`, `ClientPaymentEntry`, `TransporterPaymentSlip`, `TransPayment`, `DCPaymentslip`, `DCPayment`, `GRNHamali`, `LedgerPaymentEntry`.                                                                                                      |
| `ReferenceId`                            | PK of the source row in that module (for traceability / delete).                                                                                                                                                                                                                                 |
| `ReferenceNo` + `RefType`                | **Bill-wise allocation.** `RefType="New Ref"` opens a tracked reference (a bill); `RefType="Agst Ref"` consumes it. Value is packed as `"RefNo$Amount[,RefNo$Amount...]"`.                                                                                                                       |
| `VoucherNo`                              | Human voucher id; `Common_BL.GenerateVoucherNo(prefix, branchShortCode)` with prefixes `CR/BR/CP/BP/JV`.                                                                                                                                                                                         |
| `EntryDate`                              | Voucher date.                                                                                                                                                                                                                                                                                    |
| `TallyMasterId`                          | Tally's `LASTVCHID` after successful sync. `0`=not synced→Tally action `Create`; `>0`→action `Alter`.                                                                                                                                                                                            |

**Bill allocation engine** — `AccountLedger_BL.UpdateReferenceAmount(table, refList, amount)`: walks the `RefNo$Amount` list FIFO, consuming `amount` across references, writing back the consumed slice per ref (`LGST_BillLR` etc.). This is how outstanding-per-bill is tracked and how Tally gets bill-wise settlement. **This string-packing is a wart we should replace with real allocation rows.**

### 1.2 Tally export (`TallyXML.aspx` + `AccountLedger_BL.GetTallyXMLVoucher`)

Builds Tally-import XML: `ENVELOPE → BODY → IMPORTDATA → ... → VOUCHER` with `ALLLEDGERENTRIES.LIST` per line, plus `BILLALLOCATIONS.LIST` (from `ReferenceNo`) and `BANKALLOCATIONS.LIST` (for bank vouchers). `Create` vs `Alter` chosen by `TallyMasterId`. Two delivery modes:

1. **Download XML** — file for a date-range + checked voucher types; user imports into Tally manually.
2. **Live transfer** — HTTP `POST` of each voucher to a Tally gateway URL (`TallyUrl` in config); parse `RESPONSE`; on success store `LASTVCHID → TallyMasterId`; on failure surface `LINEERROR`.

This **already works** and is the reference for the new Tally bridge (plan §5.3). Keep the XML shape; add per-entry sync status + retry/reconcile.

---

## 2. Legacy stage-by-stage (what actually happens)

Each screen lives in `SK_Logistic_UI/Accounts/`. "Posts:" = the resulting `LGST_AccountLedger` lines.

### 2.A Billing — `LRToBillGeneration_V1.aspx`

**Flow:** pick Client (or third-party) → Transport Type (`Road` | `Both`=Road+Rail | `RoadGTA`) → Bill Head (Consignor/Consignee) → date → list un-billed LRs (`GetBillNotGeneratedLRList`) → select LRs → per-LR add charges (Detention-Warehouse, Unloading, Freight-Adj-Add; older build also Toll, Multipoint, Incentive, Late-Penalty, Damage, Freight-Adj-Sub) → generate.
**GST logic (in code-behind):**

- `Road` → no GST.
- `Both` → if `LR.FromState == SupplyState` → SGST+CGST else IGST. Rates from `web.config` (`IGST/SGST/CGST`).
- `RoadGTA` → same intra/inter split but GTA rates (`GTAIGST/GTASGST/GTACGST`).
- Rounded `MidpointRounding.AwayFromZero`.
  **Persists:** `BillDetail` (header) + `BillLR` (one row/LR); `BillNumber` via `GenerateBillNumber()` + uniqueness check.
  **Posts (VoucherType `Sale <branch>`):** Dr **Client** = NetAmt (`New Ref`); Cr FreightCharges, Detention, Hamali, FreightAdjustmentAdd, IGST@x%, SGST@x%, CGST@x%.

### 2.B LR freight correction — `UpdateLRFreight.aspx`

Pick client → list LRs (`GetUpdatedLRFreightList`) → edit freight per LR → `UpdateLRFreight(lrDetailId, newFreight)`. **Pre-bill** correction only; **no ledger posting**, no audit beyond success flag. (New plan wants a proper `LRFreightRevision` audit + credit-note path for post-bill changes — §4.2.)

### 2.C Customer receipts — `ClientPaymentEntry.aspx`

Pick outstanding client → list bills (filter by truck/LR/date) → select → per bill enter **ReceivedAmt, TDS, Damage, RateDiff**.
**Persists:** `InsertClientPaymentReceivedEntry` per bill; allocates each amount against the bill's reference via `UpdateReferenceAmount("LGST_BillLR", ...)`.
**Posts:**

- Receipt (Cash/Bank): Dr Bank/Cash = TotalReceived; Cr Client (`Agst Ref` bill list).
- Journal: Dr **TDSReceivable** / Cr Client.
- Journal: Dr **DamageDeduction** / Cr Client.
- Journal: Dr **RateDifference** / Cr Client.

### 2.D Manual journal / direct ledger — `LedgerPaymentEntry.aspx`

Generic balanced posting: LedgerType (Transporter/Client/Truck/Other) → pick ledger → Debit|Credit → pay-by (bank/cash/card) → amount + narration. Shows the ledger's **opening balance**. Writes a balanced pair via `InsertDirectLedgerEntry`. Also voucher print + delete. This is the catch-all that the structured screens don't cover.

### 2.E Transporter (market-vehicle) payment — **3 stages**

1. **`GenerateTransporterPaymentSlip.aspx`** — by date/transporter → unpaid LRs → per-LR enter Detention, Advance, Hamali, Commission, TDS, Damage, Stationary → `BalanceFreight = Freight + Detention − Advance − Hamali − Commission − TDS − Damage − Stationary`. Creates `TransporterPaymentDetail` + `TransporterPaymentLR`. **Status routing:** `payable > MaxPayableAmtApproval` (config) → status `1` (needs approval) else `2` (ready). Posts accrual (`Journal`): Dr Transportation + DetentionExps; Cr Damage, StationHamali, Commision, PrintingStationary, TDS, **Transporter payable** (`Agst Ref`).
2. **`TransporterPaymentApprove.aspx`** — **role-gated, two-tier**: `roleId==4` moves `0→1`; `roleId==1` (admin) moves `1→2`. `UpdatePaymentApproveStatus`. _(Hardcoded role ids — replace with permissions.)_
3. **`TransporterPaymentEntry.aspx`** — pick approved slip → enter PaidAmt + mode + date → `InsertTransporterPaymentEntry` (supports **partial**: tracks `pendingAmt`). Posts settlement: Dr Transporter (`Agst Ref` slip), Cr Bank/Cash.

### 2.F DC / LDC (broker / rail clearing) payment — **3 stages**

1. **`DCApproval.aspx`** — pick broker + payment mode → each DC shows its **two parallel acknowledgements (Supervisor + Broker) side-by-side** → operator selects one ack (radio) + edits Freight, Shortage, Damage, Parking, Detention, DetentionDays, Other, Labour → `InsertDCApproved` → derives **FreightPayable**. (This is the legacy reverse-engineering behind plan §4.4 `DCApproval`.)
2. **`DCPaymentSlip.aspx`** — pick broker + mode → approved DCs → select → `DCPayslip` + `DCPayslipChallan`. Books **differential** journal lines (Detention/Parking/Other diffs vs the approval) then: Dr FreightPayable (`Agst Ref`), Cr Broker = NetAmt, Cr **TDSContractor**. `NetAmt = TotalFreightPayable − TDS`.
3. **`DCPaymentEntry.aspx`** — pick payslip → PaidAmt + mode → `InsertDCPaymentEntry` (partial → pending). Posts Dr Broker, Cr Bank/Cash.

### 2.G Hamali (station labour) payment — **single stage, three sources**

`HamaliPaymentGRN` (origin GRN unloading), `HamaliPaymentDGRN` (delivery GRN), `HamaliPaymentVPLoading` (rake VP loading). Pick labour + date-range → pending hamali list → select → apply **TDS %** → `UpdateGRNHamaliPayment` → `PaymentNo`. Posts: Dr **`Labour_<id>`** = TotalHamali; Cr TDSContractor = TDS; Cr Bank/Cash = NetPayable.

### 2.H Tally — `TallyXML.aspx`

See §1.2. Download XML (manual import) **and** live HTTP transfer with master-id tracking + per-voucher success/error summary.

---

## 3. What the new ERP already has

| Area                                                                                         | Status in `erp-monorepo`                                                                                                                     |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Money chain core (Bill, Ledger, JournalEntry, Receipt, Tally, Hamali/Transporter/DC payment) | **None.** No `Bill`/`Ledger`/`Journal`/`Invoice`/`Tally`/`LRCharge`/customer-`Receipt` models in `schema.prisma`. Fully greenfield.          |
| Numbering primitive                                                                          | ✅ `DocumentSequence(branchCode, fyCode, docType, nextSeq)` + helpers (`generateLRNumbers`) — reuse for bill/voucher numbers.                |
| Branch / FY / RBAC / audit / soft-delete / optimistic-concurrency conventions                | ✅ Established (see `CLAUDE.md`, `MASTER_MODULE_PLAN.md`).                                                                                   |
| `Customer` master flags relevant to billing                                                  | ✅ `allowReceipt`, `noTDSApplyAmount` exist; GSTIN/state on customer.                                                                        |
| Vendor/labour masters                                                                        | ✅ `Transport`, `Labour`, `Creditor`, `Pump`, `Driver`. (Plan §9: confirm Broker vs Transport overlap.)                                      |
| LR freight source                                                                            | `LRGroup.baseFreightAmount` (BigInt) + `LorryReceipt`. **No `LRCharge` table yet** despite plan §4.2 — billing input wiring is a dependency. |
| Cash-planning / treasury                                                                     | ✅ Exists — **out of scope** per user.                                                                                                       |
| Permissions for accounts                                                                     | **None.** Only `cashplanning.*`. Need a new `accounts.*` / `bill.*` / `receipt.*` family.                                                    |

---

## 4. The build map — what we have to do (new repo)

Grouped by sub-module. Each row: legacy reference → new work → key decision. All follows the `modules/<feature>/` + `features/<feature>/` vertical-slice pattern (not the master CRUD factory — these are transactional).

### 4.1 Ledger core (the spine — build first)

- **New:** `Ledger` (chart of accounts; mirrors Tally names; party ledgers auto-created per customer/transport/broker/labour/pump + named GL ledgers), `JournalEntry` (voucherNumber, voucherDate, voucherType, narration, branchId, status `Draft|Posted|TallySynced`, tallyMasterId), `JournalEntryLine` (ledgerId, debit, credit, party FK, `brokerTag`). Plan §5.3.
- **Replace the `RefNo$Amount` string** with a real `LedgerAllocation(creditLineId, billRef/sourceRef, amountApplied)` table — proper bill-wise settlement, queryable outstanding.
- **`JournalTemplate`/posting service**: one typed function per posting pattern (bill, receipt, transporter slip/settlement, DC slip/settlement, hamali, manual). Every txn module posts through it — no ad-hoc `InsertLedgerEntry` scattered across screens.
- **Decision:** keep legacy's hybrid party-FK _or_ named-GL-string identity on a line? → Recommend a single `ledgerId` FK with `Ledger.kind = PARTY | GL` and party FK on the ledger row, not on every line.

### 4.2 Billing / GST (`Bill`)

- **Confirmed LR-to-Bill UX:** Bill Head (`Consignor | Consignee`) → Transport Type → Client → Show LR. There is no third-party Bill Head in the new ERP. The Client dropdown contains only customers that have acknowledged, pending-to-bill LRs for the selected Bill Head, type, branch and cutoff date.
- **Payer decision:** Accounts decides Consignor versus Consignee only when creating LR-to-Bill, after POD/acknowledgement and after receiving payer information. The chosen Bill Head and client are frozen when the draft is created; they are not changed later.
- **Derived fields:** branch comes from the user's branch scope, Bill To/GSTIN/address come from the selected customer master, and Place of Supply comes from the LR destination state. LRs with different destination states cannot be combined in one bill.
- **New:** `Bill` + `BillLine` (**M:N LR↔Bill** per plan §5.1 — solves the Whirlpool split-bill case the legacy 1:1 `BillLR` can't) + frozen `BillTaxLine`. Numbering `SKT/B/<branch>/<FY>/<seq>` via `DocumentSequence`.
- **GST engine:** pure function `(billType, sellerState, placeOfSupply, isReverseCharge) → taxLines[]`. Port legacy's intra/inter + Road/Both/RoadGTA rules, but **rates from config/system table, not `web.config`**.
- **Posting:** Dr customer / Cr revenue + GST split (template from §4.1). Immutable once finalised; corrections via `CreditNote`.
- **Decision:** legacy bills the LR's flat freight + per-line manual charges. New plan wants typed `LRChargeType`. Confirm the charge taxonomy and whether charges originate on the LR (preferred) or are entered at bill time (legacy).

### 4.3 Receivables (`Receipt`)

- **New:** `Receipt` + `ReceiptAllocation(billId, amountApplied, tds, tdsSection, tdsCert...)` (plan §5.2). Port legacy's per-bill **TDS / Damage / RateDiff** deductions as allocation/adjustment lines. On-account credit for unallocated. Customer ledger + ageing buckets.
- **Posting:** receipt + the three legacy journals (TDSReceivable, DamageDeduction, RateDifference).

### 4.4 Vendor-payment **3-stage primitive** (unify Transporter + DC + Hamali + JobCard)

- Legacy has **4 near-identical** Slip→Approve→Disburse implementations. **Build ONE primitive** (plan §5.3): `VendorPaymentSlip(type, payeeRef, lines[], grossPayable, deductions, netPayable, status)` → `Approval` (threshold-gated by **permission**, not `roleId`) → `Disbursement` (partial-pay aware, posts settlement). Discriminate by `type = TRANSPORTER | LDC_BROKER | HAMALI | JOBCARD`.
- Keep legacy's deduction maths (transporter balance-freight formula; DC differential-vs-approval lines; hamali TDS%) as per-type calculators feeding the same primitive.
- **Decision:** confirm the approval threshold(s) — legacy used a single `MaxPayableAmtApproval` config with two role tiers (4 then 1). Map to `accounts.payment.approve` (+ maybe a high-value tier).

### 4.5 DC ack/approval feeder (depends on Rail module §4.4)

- `DCApproval` consuming the **two parallel acks** belongs with Rail/DC (Phase C), but its _output_ (broker FreightPayable) feeds 4.4. Sequence accordingly.

### 4.6 Tally bridge

- Reuse legacy XML shape (§1.2). New: `JournalEntry.tallySyncStatus` + retry/reconcile worker (BullMQ), bridge config per Tally host, fallback XML export. Derive `tallyVoucherType` from line ledger kinds (cash/bank/sale/journal/logslip).

### 4.7 RBAC + numbering glue

- New permission family: `accounts.ledger.*`, `bill.{view,create,finalise,generate_invoice}`, `creditnote.*`, `receipt.{view,create}`, `accounts.payment.{view,create,approve,disburse}`, `accounts.tally.sync`. Add to `packages/types/src/permissions.ts` + seed.
- Numbering via `DocumentSequence` docTypes: `BILL`, `CN`, `RCPT`, `VPAY`, `JV`, `CR/BR/CP/BP`.

---

## 5. Open decisions (resolve before/while building)

1. **Money type.** Existing cash models use **`BigInt` paise**; plan §10 says **`Decimal`**. Pick one for Accounts and be consistent. (Recommend matching the existing BigInt-paise convention to avoid mixed-unit math, or migrate — but decide explicitly.)
2. **Ledger line identity** — single `ledgerId` FK (recommended) vs legacy's party-FK-or-named-string hybrid. (§4.1)
3. **Allocation model** — dedicated `*Allocation` rows (recommended) vs porting the `RefNo$Amount` string. (§4.1)
4. **Charge origin** — typed charges on the LR (preferred) vs entered at bill time (legacy). (§4.2)
5. **One unified vendor-payment primitive** (recommended) vs four separate tables like legacy. (§4.4)
6. **Approval thresholds & tiers** — single config + permission, or multi-tier. (§4.4)
7. **Build order.** Suggest: Ledger core → Bill+GST → Receipt → unified Vendor-Payment (Transporter+Hamali first; DC after Rail) → Tally bridge. Matches plan Phase B, defers DC to Phase C.
8. **GST rate source** — system-config table (recommended) replacing `web.config` app-settings.

---

## 6. Legacy file index (for deeper dives)

| Stage               | UI code-behind (`SK_Logistic_UI/Accounts/`)                                                | Core BL                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Ledger engine       | —                                                                                          | `SK_Logistic_BL/AccountLedger_BL.cs` (`InsertLedgerEntry`, `UpdateReferenceAmount`, `GetTallyXMLVoucher`) |
| Billing             | `LRToBillGeneration_V1.aspx.cs` (+ `.aspx` for fields)                                     | `BillDetail_BL`, `BillLR_BL`                                                                              |
| LR freight edit     | `UpdateLRFreight.aspx.cs`                                                                  | `RateContract_BL`                                                                                         |
| Customer receipts   | `ClientPaymentEntry.aspx.cs`                                                               | `ClientPaymentReceivedEntry_BL`                                                                           |
| Manual journal      | `LedgerPaymentEntry.aspx.cs`                                                               | `AccountLedger_BL`                                                                                        |
| Transporter pay (3) | `GenerateTransporterPaymentSlip` / `TransporterPaymentApprove` / `TransporterPaymentEntry` | `TransporterPaymentDetail_BL`, `TransporterPaymentLR_BL`, `TransporterPaymentEntry_BL`                    |
| DC/broker pay (3)   | `DCApproval` / `DCPaymentSlip` / `DCPaymentEntry`                                          | `DCApproved_BL`, `DCPayslip_BL`, `DCPayslipChallan_BL`, `DCPaymentEntry_BL`                               |
| Hamali pay          | `HamaliPaymentGRN` / `HamaliPaymentDGRN` / `HamaliPaymentVPLoading`                        | `Hamali_BL`, `GRN_BL`                                                                                     |
| Tally export        | `TallyXML.aspx.cs`                                                                         | `AccountLedger_BL.GetTallyXMLVoucher`                                                                     |

Legacy DB tables seen: `LGST_AccountLedger`, `LGST_BillLR`, `BillDetail`, `BillLR`, `TransporterPaymentDetail`, `TransporterPaymentLR`, `DCApproved`, `DCPayslip`, `DCPayslipChallan`, `LGST_GRNDetails`.
