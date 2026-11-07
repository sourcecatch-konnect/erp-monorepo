# Accounts Module — Deep Technical & Accounting Audit

**Date:** 2026-11-06 · **Scope:** the whole Accounts surface (ledger, billing, receipts,
vendor payments, cash, reports, Tally) · **Mode:** read-only audit. No application code was
created or modified.

**Branch audited:** `ERP-79/LDCBrokerPaymentAndDetentionSlabs` (working tree, including
uncommitted LDC/detention changes).

**Companion:** [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) carries the LDC-specific
workflow, the gap specifications (G1–G6), the phased plan and the **15 open business
questions (Q1–Q15)**. The two documents were cross-checked for accounting consistency on
2026-11-06; the reconciliation of the two is recorded in that file's §11. Where this audit
recommends an accounting treatment and that plan raises a question about it, **the question
governs** — no treatment here is approved.

**What was actually executed**

| Command | Result |
|---|---|
| `pnpm --filter @skerp/server test` | **246 passed / 25 files**, 31.3s — genuinely run |
| `pnpm check-types` | **9/9 tasks successful** — genuinely run |
| Database queries | **Not run.** No `psql`; no production credentials were used. Every data-level claim below is marked *Needs Verification* |

> Note: `CLAUDE.md` says "There is no test runner wired into turbo right now… Don't claim
> 'tests pass' — there's nothing to run." That is **outdated**: `apps/server/package.json`
> has `"test": "vitest run"` and 246 tests pass. (Finding D-11.)

---

## A. Executive Summary

**Is the accounting architecture fundamentally correct?** **Yes.** This is a real
double-entry system, not a money-log with accounting vocabulary. The spine
(`Ledger` / `JournalEntry` / `JournalLine` / `LedgerAllocation`) is modelled correctly,
`postJournal` refuses to write an unbalanced or one-sided voucher before any INSERT,
database CHECK constraints back the application rules, every money amount is `BigInt`
paise with no floating-point arithmetic in any posting path, posting is atomic with the
business action that causes it, and reversal is symmetric (lines swapped, allocations
mirrored `NEW_REF ↔ AGAINST_REF`). Concurrency is handled deliberately — `pg_advisory_xact_lock`
on bills in the receipt path, on the slip in the disbursement path, `clientRequestId`
idempotency on disbursements, version guards on slip transitions. The unified
vendor-payment primitive replaced legacy's four near-identical implementations exactly as
`ACCOUNTS_MODULE_MAP.md` §4.4 recommended, with permission-based approval instead of
legacy's hardcoded `roleId==4 then ==1`.

The quality of thought is visible in the code: the comments explain *why*, several
previous audit findings were found by spot-checking real data and fixed, and the
known-defective areas are flagged in-source rather than hidden.

**Is it safe for real business usage?** **For the core receivable and payable cycle, yes
— with four caveats that should be closed before anyone relies on the reports for money
decisions.** The bill → receipt → outstanding cycle is correct end to end and I could not
break it on paper. The risks are concentrated in (a) the credit/debit-note path, which
silently desynchronises three different outstanding figures, (b) a vendor accrual that
credits an account nothing ever debits, (c) the absence of any trial balance or runtime
reconcile, so an error like (a) or (b) can run for months unnoticed, and (d) Tally, which
is UI-only — a status badge that can never change.

**Biggest risks, in order**

1. **A credit note or debit note desynchronises outstanding across three surfaces.** The
   `Bill.outstandingAmountPaise` column, the Customer Statement, and the bill-wise
   outstanding / Ageing reports will give three different answers for the same customer
   (D-1). The documented identity in `CUSTOMER_LEDGER.md` ("closingBalance stays equal to
   Σ bill-wise outstanding") breaks the moment one note exists.
2. **`TRANSPORTER_ADVANCE_RECOVERY` is credited by every transporter and LDC accrual, and
   nothing ever debits it** (D-2). This is already known to the team — the source comment
   says "do not wire the advance deduction line into production posting until that's
   resolved," and the code does it anyway. Cash paid as advance is absent from the books
   and a CURRENT_ASSET head accumulates an unbacked credit balance.
3. **There is no trial balance, no account-wise GL ledger, and no reconcile job.** You
   cannot, today, ask the system "do the books balance?" or "show me the TDS Payable
   ledger." For a system whose stated purpose is to feed Tally, that is the biggest
   functional gap (F-1, F-2).
4. **Tally integration does not exist** (D-9/F-6) — no XML, no transport, no sync worker.
   Everything upstream is ready for it.

Nothing I found suggests the architecture should be redesigned. Every finding is a
bounded fix inside the existing design.

---

## B. Documentation vs Implementation

| Feature | Documented requirement | Actual implementation | Status | Evidence |
|---|---|---|---|---|
| Double-entry spine | `Ledger`/`JournalEntry`/`JournalLine`/`LedgerAllocation`, Dr=Cr asserted, `DRAFT→POSTED` (`ACCOUNTS_LEDGER_BUILD.md` §1) | Exactly as specified, including every "review round 2" correction (`CONTRA`/`DEBIT_NOTE` added, `reversesId @unique`, `tallySyncStatus` a separate state machine, no `openingBalance*` on `Ledger`) | **Correct** | `posting.service.ts:243-322`; `schema.prisma:3500-3570` |
| Replace legacy `RefNo$Amount` string | Real allocation rows (§4.1, decision 3) | `LedgerAllocation` with `NEW_REF`/`AGAINST_REF`, DB CHECK `amountPaise > 0`, one-reference CHECK | **Correct** | `migrations/20260904000000_.../migration.sql:169-173`, `20260921000000_.../migration.sql:184` |
| Money type | `BigInt` paise (decision 1, overriding plan §10's `Decimal`) | `BigInt` paise everywhere in posting; no float in any voucher path | **Correct** | `posting.service.ts` throughout; `billing.service.ts:258` `taxForRate` |
| Ledger line identity | Single `ledgerId` FK + `Ledger.kind = PARTY\|GL` (decision 2) | As specified; 7 party kinds (customer/transport/creditor/labour/pump/sparePartSupplier/driver) | **Correct** | `posting.service.ts:71-186` |
| Party ledgers | Lazy get-or-create (decision 4) | `getOrCreatePartyLedger`, idempotent, P2002-recovering | **Correct** | `posting.service.ts:107-186` |
| Bill finalise posts SALES | Atomic; a FINALISED bill always has a POSTED voucher (decision 3) | Voucher posted first inside the tx; failure rolls back the finalise | **Correct** | `billing.route.ts:1510-1532` |
| GST engine | Rates from a config table, not `web.config`; Road=no GST, intra=CGST+SGST, inter=IGST; round to rupee | `calculateBill` reads `BillingTaxRule` (bps), BigInt half-up rounding | **Correct** | `billing.service.ts:479-583` |
| GST rule selection | `BillingTaxRule` keyed by `(billType, chargeMechanism)` — the schema carries a composite index for it | Lookup filters on `billType` only; `chargeMechanism` ignored | **Incorrect** | `billing.service.ts:533-543` vs `schema.prisma:2619` |
| Reverse charge | "only RoadGTA asks for Forward/Reverse Charge when needed" (plan §5.1) | Enum + column + index exist; `chargeMechanism` hardcoded `FORWARD_CHARGE` for all non-ROAD bills | **Missing** (documented as conditional) | `billing.route.ts:687-690` |
| Receipts with TDS/damage/rate-diff | Port legacy's three journals as allocation/adjustment lines (§4.3) | Dr Bank + Dr TDS_RECEIVABLE/DAMAGE_DEDUCTION/RATE_DIFFERENCE, Cr customer, one `AGAINST_REF` per bill; deductions force `PENDING_APPROVAL` | **Correct** | `posting.service.ts:470-550`; `receipt.route.ts:231-247, 360-385` |
| On-account / unallocated receipt | "On-account credit for unallocated" (§4.3); `onAccountPaise` reported in the statement | `Receipt.unallocatedPaise` exists, defaults 0, and **is never written** — `amountPaise` is *derived* as Σ `amountAppliedPaise`, so a lump-sum advance cannot be recorded | **Missing** | `receipt.route.ts:244-248`; `grep unallocatedPaise` → 3 read sites, 0 writes |
| Lump-sum auto-allocation | Listed as "Not yet built" in `ACCOUNTS_LEDGER_BUILD.md` | Still not built | **Missing** (doc accurate) | — |
| Credit note | `reverseJournal` + `CREDIT_NOTE` plumbing; UI later | `BillCreditNote` + `postBillCreditNoteVoucher` + route, both CN and DN | **Partially implemented** — no `LedgerAllocation`, no GST reversal | `posting.service.ts:1055-1092`; `billing.route.ts:1693-1790` |
| Unified vendor-payment primitive | ONE `VendorPaymentSlip(type,…)` → Approval → Disbursement, permission-gated, partial-pay aware (§4.4) | Exactly that: `TRANSPORTER \| LDC_BROKER \| HAMALI`, accrual on approve, per-disbursement settlement voucher, idempotent, advisory-locked | **Correct** | `vendor-payment.route.ts:712-757, 1016-1100`; `posting.service.ts:1426-1640` |
| Vendor GL codes | "PLACEHOLDER codes pending Accounts' written sign-off"; advance line explicitly *not* to be wired | All 7 codes seeded and in use, **including** the advance line the comment forbids | **Incorrect** | `posting.service.ts:1308-1326` vs `:1505`; `seed-ledger.ts:127-164` |
| Cancelled bill keeps outstanding (ACCT-R1 **G1**) | Filed as "its own bug ticket" | **Fixed** — cancel now sets `outstandingAmountPaise: 0n` with a comment naming the issue. No historical backfill found | **Documentation outdated** (fix shipped); backfill **Needs Verification** | `billing.route.ts:1627-1636` |
| TDS section/cert storage (ACCT-R1 **G2**) | Needed for TDS compliance reporting | Columns exist (`tdsSection`, `tdsCertNumber`, `tdsCertDate`) and are captured on create; whether they are *required* when TDS > 0 is not enforced | **Partially implemented** | `receipt.route.ts:340-346`; no validator `.refine` enforcing it |
| Bill due date (ACCT-R1 **G3**) | Ageing needs real due dates | Now **required**: finalise refuses a bill with no `dueDate`, with a comment naming the legacy drafts | **Documentation outdated** (fixed) | `billing.route.ts:1466-1470` |
| `paidAmountPaise` semantics (ACCT-R1 **G4**) | "worth a doc comment on the `Bill` model" | Still no comment on the model | **Documentation outdated** | `schema.prisma` `Bill` |
| Customer Statement / Ageing | Read operational tables, exclude reversal echoes (`CUSTOMER_LEDGER.md`) | As documented, with the `reversesId: null` guard that fixed the ₹1,05,210 inflation | **Correct** | `customer-statement.service.ts:79-135` |
| Legacy `LedgerEntry` coexistence | Keep in parallel; migrate report views in Phase 5 | Bank/Cash, Creditor, Driver and Expense views **already** read `JournalLine`; only `ledgerForCustomer` still reads `LedgerEntry`, and it is dead in the UI | **Partially implemented** (ahead of doc) | `ledger.service.ts:121, 176, 195, 239` |
| Vendor Statement | Not in the original map (VP-8) | Reads `VendorPaymentSlip`/`Disbursement` directly, with explicit ACCRUAL+REVERSAL rows for cancelled slips | **Correct** | `vendor-statement.service.ts:1-200` |
| Opening balances | "a balanced Opening-Balance JOURNAL voucher (own phase)" | Built **for cash/bank accounts only** — typed real balance, difference posted against `OPENING_BALANCE` suspense, correction reverses and re-posts | **Partially implemented** — no customer/vendor/GL opening balances | `opening-balance.service.ts:1-200` |
| Chart of Accounts / Manual Journal / Day Book | Phase 4 | All three built and routed | **Correct** (Day Book truncates — D-7) | `ledger.route.ts:296-520` |
| Trial Balance | Implied by a double-entry book of record; required by this audit's §7 | **Does not exist anywhere** in server, web or types | **Missing** | `grep -ri trial` → 0 accounting hits |
| Account-wise GL ledger | §7 of this audit; natural companion to Chart of Accounts | No endpoint. Only cash-account / customer / creditor / driver / expense views | **Missing** | `ledger.route.ts` route list |
| Money-out coverage (8a-1…8a-4) | Cash Planning done; `TripExpense` approve, `DriverAdvance` create, `RailRakeChargePayment` confirm, LogSlip "still open" | LogSlip **done** (consolidated voucher at journey close, deliberately absorbing TripExpense/DriverAdvance); Driver finance **done**; `RailRakeChargePayment` **still unposted** | **Documentation outdated** for LogSlip/driver; **Missing** for rail rake | `log-slip.route.ts:530`; `posting.service.ts:1138-1240, 1737-1812`; `grep railRakeChargePayment` → only `deleteMany` |
| Cash Planning "explicitly out of scope" | `ACCOUNTS_MODULE_MAP.md` scope note | Now fully integrated — posts PAYMENT vouchers, and `booksOpenings` derives the day's opening from `JournalLine` | **Documentation outdated** | `cash-planning.service.ts:414-444` |
| Tally bridge | Reuse legacy XML shape, sync status, retry worker, reconcile (§4.6) | `tallySyncStatus` / `tallyMasterId` / `tallySyncError` / `tallySyncAttempts` columns + a UI badge. **Zero** writers, no XML, no transport, no worker, no route, no permission | **Missing** (UI-only placeholder) | `grep "tallySyncStatus\s*:"` excluding selects → **no results** |
| Accounts permission family | `accounts.*`, `bill.*`, `receipt.*`, `accounts.tally.sync` (§4.7) | `BILLING.*` (10), `RECEIPT.*` (4), `ACCOUNTS.PAYMENT.*` (5), `LEDGER.*` (4), `DRIVER_FINANCE.*`, `WORKSHOP.*`. No `tally.sync` (nothing to gate) | **Correct** for what exists | `packages/types/src/permissions.ts:462-500` |
| Every accounting route gated | Never expose a money route ungated | **All** routes in ledger/billing/receipt/vendor-payment carry `can(...)` — verified by script | **Correct** | `awk` scan over the four route files → 0 ungated |
| Branch scoping on reports | `branchFilter(req)` on every branch-scoped read | Statement / bills-outstanding / Ageing / Day Book scope correctly; the five legacy ledger reads (`cash-accounts/:id`, `customers/:id`, `creditors/:id`, `drivers/:id`, `expenses`) have **no** branch scoping | **Partially implemented** | `ledger.route.ts:94-127` vs `:139-146, 438-448` |
| Reconcile check | "the allocation sum is audit-grade truth and what a reconcile check compares against" (§1.5) | No reconcile endpoint, job, or script. Only a **unit test** of the pure compute functions | **Missing** | `ledger/__tests__/reconciliation.test.ts` is pure-function only |

---

## C. Complete Accounting Workflow — and where it breaks

```
                 ┌──────────────── RECEIVABLE SIDE ────────────────┐
LR + LRCharge
   └─> Bill DRAFT ─ approve ─> APPROVED
         └─ finalise (one tx) ─> billNumber + calculateBill()
                 ├─> postSalesVoucher:  Dr Customer / Cr income GLs / Cr OUTPUT_*GST / ±ROUND_OFF
                 │      └─> LedgerAllocation NEW_REF (bill, total)            ✔
                 ├─> Bill.outstandingAmountPaise = total                      ✔ (denormalised)
                 └─> CashReceivable upsert                                    ✔
   Receipt (POST or approve, one tx, advisory-locked per bill)
                 ├─> postReceiptVoucher: Dr Bank + Dr TDS/Damage/RateDiff / Cr Customer
                 │      └─> LedgerAllocation AGAINST_REF per bill             ✔
                 ├─> Bill.outstanding −= settled; paid += cash                ✔
                 ├─> CashReceivable + CashReceivableReceipt                    ✔
                 ├─> CashAccountAdjustment (cash-planning mirror)              ✔
                 └─> LedgerEntry (legacy single-entry log)                     ✔ parallel
   Credit / Debit note
                 ├─> postBillCreditNoteVoucher: Dr/Cr SALES_ADJUSTMENT / Cr/Dr Customer ✔
                 ├─> LedgerAllocation                                          ✘ NEVER WRITTEN  ← D-1
                 ├─> output GST reversal                                       ✘ NEVER POSTED   ← E-2
                 └─> Bill.outstanding ±= amount (read-modify-write, unlocked)  ✘ RACE           ← D-3
   Reports
                 ├─> Customer Statement  ← Bill + Receipt + party-ledger CN/DN/JV lines  ✔
                 ├─> Bill-wise outstanding (R4) ← Bill − ReceiptAllocation − LedgerAllocation(CN) ✘ CN/DN invisible
                 ├─> Ageing (R5)          ← same inputs                        ✘ same
                 └─> Trial balance                                             ✘ DOES NOT EXIST ← F-1

                 ┌──────────────── PAYABLE SIDE ───────────────────┐
LR_GROUP / GRN hamali / VP loading / DeliveryChallan
   └─> VendorPaymentSlip DRAFT ─ submit ─> (maker-checker) ─> APPROVED
         └─> postVendorSlipAccrual (one tx, version-guarded, idempotent)
                 ├─> Dr FREIGHT_EXPENSE + DETENTION_EXPENSE / HAMALI_EXPENSE   ✔
                 ├─> Cr TDS_PAYABLE, COMMISSION/HAMALI/DAMAGE/STATIONERY_RECOVERY ✔
                 ├─> Cr TRANSPORTER_ADVANCE_RECOVERY                           ✘ NO MATCHING Dr ← D-2
                 └─> Cr payee + LedgerAllocation NEW_REF (slip, net)            ✔
   Disbursement (advisory-locked, clientRequestId-idempotent, partial-aware)
                 ├─> postVendorDisbursement: Dr payee / Cr funding Cash-Bank    ✔
                 └─> LedgerAllocation AGAINST_REF (slip, paid)                  ✔
   Vendor Statement ← slips + disbursements (not a JournalLine sweep)           ✔

                 ┌──────────────── OTHER MONEY-OUT ────────────────┐
CashPayment approve            ─> postPaymentVoucher  Dr creditor|expense / Cr bank   ✔
  … with no branch or account  ─> no voucher at all                                   ✘ accepted gap
Manual cash adjustment         ─> CashAccountAdjustment + LedgerEntry, NO voucher     ✘ D-6
LogSlip close                  ─> postLogSlipVoucher (vehicle P&L overlay)            ✔
Driver salary / advance / payout ─> postDriverSalaryRun / postDriverMoneyOut          ✔
Job Card / Service Bill / Spare Inward / Supplier Replacement ─> own vouchers         ✔
RailRakeChargePayment CONFIRMED ─> nothing                                            ✘ D-8

                 ┌──────────────── TALLY ──────────────────────────┐
JournalEntry.tallySyncStatus = NOT_SYNCED ──────X  no writer, no XML, no transport    ✘ D-9
```

**Broken connections, in one line each:** credit/debit notes never reach the allocation
trail or the GST ledgers; the transporter advance has a credit with no debit; manual cash
adjustments and rail-rake payments never reach the books; nothing reads the allocation
trail to verify the denormalised outstanding column; nothing reaches Tally.

---

## D. Critical Bugs

### D-1 · Credit and debit notes are invisible to bill-wise outstanding and Ageing — **Critical**

- **Files:** [posting.service.ts:1055-1092](apps/server/src/modules/ledger/posting.service.ts#L1055-L1092) (no `allocations`), consumed by [customer-statement.service.ts:289-302](apps/server/src/modules/ledger/customer-statement.service.ts#L289-L302) and [ageing.service.ts:75-82](apps/server/src/modules/ledger/ageing.service.ts#L75-L82)
- **Root cause:** `postBillCreditNoteVoucher` calls `postJournal` **without an
  `allocations` array**. Both report layers compute a bill's credit-note relief from
  `LedgerAllocation where refType='AGAINST_REF' AND journalEntry.voucherType='CREDIT_NOTE'`
  — a table nothing ever populates for notes. Verified: `grep -n allocations
  posting.service.ts` shows allocation writers at lines 425 (SALES), 540 (RECEIPT), 1284
  (reversal mirror), 1516 (vendor accrual), 1626 (vendor disbursement). **The credit-note
  voucher is the only money-moving voucher against a bill with no allocation.** The
  reverse case is also broken: a `DEBIT_NOTE` raises `Bill.outstandingAmountPaise` but the
  reports query `voucherType: "CREDIT_NOTE"` only, so a debit note is never added back.
- **Business impact:** after any credit note, the Customer Statement, the bill-wise
  outstanding panel, the Ageing report and the `Bill` column give **different** answers for
  the same customer. Ageing — the report collections are chased from — **overstates** debt
  by the credit-note amount, so staff chase money that was already written off. A debit
  note **understates** it. `CUSTOMER_LEDGER.md`'s stated identity (`closingBalance = Σ
  bill-wise outstanding`) is false whenever a note exists.
- **Example:** bill ₹52,500 → receipt ₹30,000 + TDS ₹500 (settled ₹30,500) → credit note
  ₹2,000.
  - `Bill.outstandingAmountPaise` = 52,500 − 30,500 − 2,000 = **₹20,000** ✔
  - Customer Statement closing = **₹20,000** ✔ (reads the party-ledger CN line)
  - `perBillOutstanding` = 52,500 − 30,500 − **0** = **₹22,000** ✘
  - Ageing bucket = **₹22,000** ✘
- **Why tests don't catch it:** `reconciliation.test.ts` feeds `creditNotes` into *both*
  compute functions as fixtures, so the pure math is proven right while the DB layer that
  never supplies those rows is untested. 246 passing tests say nothing about this.
- **Recommended fix:** pass an allocation on the customer line of the note voucher —
  `AGAINST_REF` for `CREDIT_NOTE`, `NEW_REF` for `DEBIT_NOTE` — and extend both report
  queries to `voucherType: { in: ["CREDIT_NOTE", "DEBIT_NOTE"] }`, signing `NEW_REF` as an
  increase. Then backfill allocations for notes already posted.
- **Needs Verification:** how many `BillCreditNote` rows exist in each environment (sets
  whether this is live corruption or a latent defect).

### D-2 · `TRANSPORTER_ADVANCE_RECOVERY` is credited with no matching debit — **Critical**

- **Files:** [posting.service.ts:1505](apps/server/src/modules/ledger/posting.service.ts#L1505) (`credit(VENDOR_ADVANCE_RECOVERY_CODE, totals.advancePaise)`), against its own prohibition at [posting.service.ts:1308-1326](apps/server/src/modules/ledger/posting.service.ts#L1308-L1326)
- **Root cause:** the source comment states plainly — *"VENDOR_ADVANCE_RECOVERY_CODE is
  only correct if transporter advances are debited to this same ledger wherever they're
  paid out — as of this writing no such flow exists… Do not wire the advance deduction
  line into production posting until that's resolved."* The line is wired. A repo-wide grep
  for the code outside `posting.service.ts` finds only `seed-ledger.ts` and the read-only
  diagnostic `prisma/ldc-inventory.ts` — **no flow debits it.** Advances live on
  `LRGroup`/`GRN`/`DeliveryChallan.advanceAmount` and are handed over in cash with no
  voucher.
- **Business impact:** (1) cash that physically left the business as an advance is not in
  the books, so Bank/Cash is overstated by the outstanding advance total; (2)
  `TRANSPORTER_ADVANCE_RECOVERY`, seeded as `CURRENT_ASSET`, accumulates a growing
  **credit** balance — a negative asset that will be queried by any auditor and cannot be
  explained from the ledger; (3) each voucher still balances, so a trial balance (if one
  existed) would not flag it.
- **Example:** freight ₹1,00,000, detention ₹5,000, advance ₹20,000 already paid, TDS 1%.
  Accrual posts Dr FREIGHT_EXPENSE 1,00,000 + Dr DETENTION_EXPENSE 5,000; Cr
  ADVANCE_RECOVERY 20,000 + Cr TDS_PAYABLE 1,050 + Cr Transporter 83,950. Expenses are
  right, the payee balance is right, but ₹20,000 of real cash is missing from the books
  and ₹20,000 sits as an unbacked credit.
- **Correct treatment:** three candidate options, set out with their entries in **E-1** and
  identically in [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §3 G3. **Option A** —
  post `Dr TRANSPORTER_ADVANCE_RECOVERY / Cr Cash-Bank` at hand-over so the accrual's
  credit clears it to zero — is this audit's **recommendation, [PROPOSED, NOT APPROVED]**.
  The choice is Accounts', tracked as **Q5**.
- **Scope note:** the identical defect exists first-mile — the TRANSPORTER calculator takes
  its advance from `LRGroup.marketAdvanceAmount`
  ([transporter-truck.ts:127](apps/server/src/modules/vendor-payment/calculators/transporter-truck.ts#L127),
  [transporter.ts:97](apps/server/src/modules/vendor-payment/calculators/transporter.ts#L97)),
  also a captured figure and not a payment record. **Fix it once in the
  vendor-payment/ledger layer for both**, not per payee type.
- **Historical data — hard constraint:** neither `DeliveryChallan.advanceAmount` nor
  `LRGroup.marketAdvanceAmount` is ever disbursed through any flow, so **no payment records
  exist to verify a historical advance against.** Those columns assert that cash was handed
  over; they are not evidence of it. **No historical advance entry may be generated from
  them.** Correction must be an Accounts-authored, separately evidenced journal — Q7.
- **Note:** the team already built `prisma/ldc-inventory.ts` to size this ("← unbacked
  credit balance, needs a correcting entry"). It references `docs/LDC_WORKFLOW_PLAN.md`,
  which **does not exist in the repo** — the plan is missing or unpushed.
- **Needs Verification:** run `pnpm --filter @skerp/server ldc:inventory` for the live
  magnitude.

### D-3 · Credit-note outstanding update is a lost-update race — **High**

- **File:** [billing.route.ts:1696-1788](apps/server/src/modules/billing/billing.route.ts#L1696-L1788)
- **Root cause:** `bill.outstandingAmountPaise` is read **before** `db.$transaction`
  opens, and `newOutstanding = bill.outstandingAmountPaise + delta` is written **inside**
  it, with no `pg_advisory_xact_lock` on the bill and no `version` guard on the update.
  The receipt path locks the same column correctly (`receipt.route.ts:256-262`); the note
  path does not.
- **Business impact:** a receipt and a credit note posted concurrently against one bill
  lose one of the two updates. The ledger stays correct (both vouchers post), so the
  damage is a silently wrong `outstandingAmountPaise` that no report can detect.
- **Example:** bill outstanding ₹22,000. Operator A posts a ₹2,000 credit note (reads
  22,000); Operator B's ₹5,000 receipt commits first (column → ₹17,000); A commits
  22,000 − 2,000 = **₹20,000**. The ₹5,000 receipt vanishes from the column.
- **Fix:** take the same advisory lock, re-read the bill inside the transaction, and apply
  a relative update.

### D-4 · GST rule lookup ignores `chargeMechanism` — **High (latent)**

- **File:** [billing.service.ts:533-543](apps/server/src/modules/billing/billing.service.ts#L533-L543)
- **Root cause:** `billingTaxRule.findFirst` filters `billType`, `isActive` and the
  effective-date window, then `orderBy: { effectiveFrom: "desc" }`. It never filters
  `chargeMechanism`, although `BillingTaxRule.chargeMechanism` is a required column, the
  bill records its own `chargeMechanism`, and `schema.prisma:2619` carries the composite
  index `[billType, chargeMechanism, effectiveFrom, isActive]` precisely for this lookup.
- **Business impact:** `POST /billing/tax-rules` accepts `REVERSE_CHARGE` (the validator
  allows it). The moment an admin configures a reverse-charge rule for a bill type that
  also has a forward-charge rule, bills can be taxed with the wrong rule — whichever has
  the later `effectiveFrom` wins. On a reverse-charge rule that is GST at 0% on a
  forward-charge bill (under-collected output tax, a filing exposure) or forward GST on a
  reverse-charge bill (tax charged that the customer is meant to pay).
- **Why it is latent, not live:** no code path ever sets `chargeMechanism =
  REVERSE_CHARGE` on a bill, so today only forward rules are realistically configured.
  Nothing prevents the configuration, however, and nothing warns.
- **Fix:** add `chargeMechanism: bill.chargeMechanism` to the `where`, and make
  `calculateBill` take it as a parameter rather than inferring forward charge.

### D-5 · Reversal vouchers mix one financial year's `fyCode` with another's date — **Medium**

- **File:** [posting.service.ts:1263-1272](apps/server/src/modules/ledger/posting.service.ts#L1263-L1272)
- **Root cause:** the contra is posted with `voucherDate: new Date()` (today) but
  `fyCode: original.fyCode` (the reversed voucher's year).
- **Business impact:** cancelling a FY 2025-26 bill in FY 2026-27 produces a voucher dated
  in 2026-27 and tagged 2025-26. The Day Book (date-filtered) shows it this year; any
  `fyCode`-filtered report shows it last year; neither view balances against the other.
  It also re-opens a closed period's figures from a later year.
- **Fix:** decide one rule and apply it — either date the contra on the original's date
  (keeping the period intact) or derive `fyCode` with `fyCodeFor(voucherDate)` and accept
  a cross-year reversal. Dating it on the original is the conventional choice when the
  period is still open; `fyCodeFor(today)` when it is closed.

### D-6 · Manual cash-account adjustments never reach the double-entry books — **Medium**

- **File:** [cash-planning.route.ts:696-724](apps/server/src/modules/cash-planning/cash-planning.route.ts#L696-L724)
- **Root cause:** the endpoint writes `CashAccountAdjustment` + a legacy `LedgerEntry` row
  and posts **no** `JournalEntry`. `buildDayView` then deliberately adds these on top of
  the journal-derived opening ("Cash Planning items that never reached the books" —
  `cash-planning.service.ts:139-150`), so Cash Planning's closing balance includes them
  while the Bank/Cash ledger (`ledgerForAccount`, journal-based) does not.
- **Business impact:** "Manual add funds" and "Correction" entries move the operational
  cash position without touching the accounting books. The Bank Book and Cash Planning
  diverge permanently by their total, and the money never reaches Tally.
- **Mitigating design:** this is handled honestly rather than hidden — Cash Planning's
  opening comes from `booksOpenings` (the journal), so the two systems are reconciled
  *by construction* except for exactly these entries. That makes this a bounded gap, not
  a structural inconsistency.
- **Fix:** post a `JOURNAL` voucher (`Dr/Cr Cash-Bank` against a cash-discrepancy GL) in
  the same transaction, then drop the special case from `buildDayView`.

### D-7 · Day Book silently truncates at 500 vouchers — **Medium**

- **File:** [ledger.route.ts:443-458](apps/server/src/modules/ledger/ledger.route.ts#L443-L458)
- **Root cause:** `take: 500` with no `skip`, no `count`, no pagination metadata and no
  indication in the response that rows were dropped.
- **Business impact:** the Day Book is the register an accountant reads to tie out a
  period. A branch posting more than 500 vouchers in the selected range gets a
  silently incomplete book that still looks authoritative. Totals computed from it are
  wrong with no warning.
- **Fix:** paginate like every other list route (`parseListQuery` + `sendOk(res, data,
  meta)`), or at minimum return the total and a `truncated` flag.

### D-8 · Rail rake charge payments post nothing — **Medium**

- **Files:** [rail-rake-operation.route.ts:368-386](apps/server/src/modules/rail-rake-operation/rail-rake-operation.route.ts#L368-L386); `schema.prisma` `RailRakeChargePayment` (no `journalEntryId`)
- **Root cause:** demurrage / wharfage / warpage payments to Indian Railways are created
  nested with `status: CONFIRMED`, `confirmedById`, `confirmedAt` and an `amount` in
  paise, and no posting function is ever called. `grep railRakeChargePayment` across the
  server finds only two `deleteMany` calls.
- **Business impact:** real cash paid to IR is absent from the ledger. Rail expense is
  understated and the bank balance in the books is overstated by the total of confirmed
  rake payments, unless the same payment is *also* hand-keyed into Cash Planning — in
  which case it is at risk of being double-counted instead.
- **Fix:** add `RailRakeChargePayment.journalEntryId` and post `Dr <rail charge expense> /
  Cr Cash-Bank` on confirm, reversing on un-confirm/delete, following the
  `postPaymentVoucher` pattern.
- **Needs Verification:** whether operations currently key these into Cash Planning too
  (double-count risk) or not at all (missing-expense risk).

### D-9 · Tally integration is a UI-only placeholder — **Medium (High as a business gap)**

- **Evidence:** `grep -rn "tallySyncStatus\s*:\|tallyMasterId\s*:\|tallySyncedAt\s*:"` over
  `apps/server/src`, excluding `select` blocks, returns **no results** — nothing writes any
  Tally field. Meanwhile [BillAccountingCard.tsx:53-58](apps/web/features/billing/components/BillAccountingCard.tsx#L53-L58) renders a "Tally" row with SYNCED/FAILED branches, and `voucher.types.ts:50-54` types all five fields.
- **Business impact:** the UI displays a sync state that can never change from
  `NOT_SYNCED`, which reads to a user as "sync is configured but pending" rather than
  "not built." Accounts still rekeys every voucher into Tally by hand.
- **Fix:** either build the bridge (F-6) or label the field "Not synced — Tally export not
  configured" so the UI stops implying a pipeline exists.

### D-10 · Five ledger report endpoints have no branch scoping — **Medium**

- **File:** [ledger.route.ts:94-127](apps/server/src/modules/ledger/ledger.route.ts#L94-L127)
- **Root cause:** `/ledger/cash-accounts/:id`, `/customers/:id`, `/creditors/:id`,
  `/drivers/:id` and `/expenses` call their service functions with only an id and a date
  range. No `branchFilter(req)`, no `assertBranchAccess`. The newer endpoints in the same
  file do both (`:139-146`, `:438-448`).
- **Business impact:** any user holding `ledger.view` — including a branch-scoped
  operator — can read every branch's cash, creditor, driver and expense movements. Not a
  permission bypass (the permission is enforced) but a breach of the branch-isolation model
  that `RBAC_PLAN.md` applies everywhere else.
- **Fix:** scope the underlying `journalLine` queries by `journalEntry.branchId` using
  `branchFilter(req)`, as the Day Book does.

### D-11 · `ledgerForCustomer` is a stale endpoint that returns a knowingly wrong balance — **Medium**

- **Files:** [ledger.route.ts:101-105](apps/server/src/modules/ledger/ledger.route.ts#L101-L105) → [ledger.service.ts:175-181](apps/server/src/modules/ledger/ledger.service.ts#L175-L181)
- **Root cause:** `CUSTOMER_LEDGER.md` opens by describing this exact read as the bug it
  fixed — `LedgerEntry` only ever receives receipts, never bill finalisations, so the view
  shows payments with no invoices. The fix shipped as a **new** endpoint
  (`/customers/:id/statement`); the broken one was never retired and sits behind the same
  `ledger.view` permission. `ledgerForCreditor` and `ledgerForAccount` beside it were both
  migrated to `JournalLine`; this one was not.
- **Impact — corrected severity:** the web wrapper `ledger.service.ts:forCustomer` exists
  but has **zero callers** (`grep forCustomer` → one definition, no usage), and
  `LedgerPage`'s Debtor tab uses the statement. So **no user-facing screen shows the wrong
  number today.** The risk is a live API endpoint that returns a wrong debtor balance to
  any future caller, integration or report built against it.
- **Fix:** delete the route, the service function and the dead web wrapper, or point the
  route at `buildCustomerStatement`.

### D-12 · Documentation defects that mislead the next developer — **Low**

- `CLAUDE.md` — "There is no test runner wired into turbo… Don't claim tests pass." A
  `vitest` suite of 246 tests exists and passes.
- `ACCOUNTS_MODULE_MAP.md` §3 — "Money chain core: **None.** Fully greenfield." Billing,
  receipts, the double-entry ledger, vendor payments and six more voucher types exist.
  `ACCOUNTS_LEDGER_BUILD.md` says it supersedes §3/§4, but §3 itself still reads as
  current.
- `ACCOUNTS_MODULE_MAP.md` scope note — "cash-planning is **explicitly out of scope** —
  do not try to reconcile Accounts against it." Cash Planning now posts PAYMENT vouchers
  and derives its openings from `JournalLine`; it *is* part of Accounts.
- `ACCOUNTS_LEDGER_BUILD.md` — four migrations described as "written but NOT applied."
  All four directories exist in `prisma/migrations`, so they were applied at some point.
- `ACCOUNTS_LEDGER_BUILD.md` §1.1 — the `JournalStatus` block still lists
  `TALLY_SYNCED`; the corrections section above it says the enum is
  `DRAFT|POSTED|REVERSED`. Both are in the same file.
- `docs/LDC_WORKFLOW_PLAN.md` — referenced by `prisma/ldc-inventory.ts`, does not exist.
- ACCT-R1 findings G1 and G3 are recorded as open; both are fixed in code.

---

> **D-13 and D-14 were added on 2026-11-06 during the cross-check against
> [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md).** They were found while tracing the LDC
> chain end to end, are squarely in this audit's scope (vendor-payment module), and are
> appended rather than inserted so the existing D-numbers stay stable for anything that
> already cites them.

### D-13 · A paid vendor-payment slip cannot be corrected — the flow it defers to does not exist — **High**

- **Files:** [posting.service.ts:1649-1652](apps/server/src/modules/ledger/posting.service.ts#L1649-L1652); [vendor-payment.route.ts:1155-1160](apps/server/src/modules/vendor-payment/vendor-payment.route.ts#L1155-L1160)
- **Root cause:** `reverseVendorSlipAccrual` refuses when `slip.paidPaise > 0` with *"use
  the refund/payment-reversal flow"*, and the cancel route refuses with *"A partially or
  fully paid slip cannot be cancelled here — use the separate refund/payment-reversal
  flow."* `grep -rn "refund" modules/vendor-payment/` returns **only those two error
  strings**. The flow was never built.
- **Business impact:** once any amount is disbursed against a slip — transporter, LDC
  broker or hamali — there is no in-system way to correct a wrong detention figure, an
  overpayment, or a slip raised against the wrong source document. The only recourse is a
  manual journal, which moves the ledger but leaves the slip's `paidPaise`, its status and
  its `LedgerAllocation` trail wrong. That breaks the per-slip reconciliation identity in
  §H-3 permanently, so the reconcile job (P0-4) would report it as drift forever with no
  way to clear it.
- **Example:** a ₹5,000 detention is paid on an LDC slip, then the LR's unloading date is
  corrected and the real figure is ₹2,000. The slip is `PAID`, so it can be neither
  cancelled nor re-accrued. The ₹3,000 overpayment sits on the broker's ledger with no
  document explaining it.
- **Recommended solution:** scope a correction path. Its shape depends on a business
  decision — recover on the next slip (a deduction head), demand a refund (a money-in
  voucher against the payee), or write off. Tracked as **Q15** in
  [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §7; **not an engineering choice.**
- **Scope note:** this is vendor-payment-wide, not LDC-specific. LDC merely surfaced it.

### D-14 · An omitted `detentionPaise` pays the broker zero detention — **High**

- **Files:** [vendor-payment.schema.ts:33](packages/validators/src/accounts/vendor-payment.schema.ts#L33); [vendor-payment.route.ts:281-285](apps/server/src/modules/vendor-payment/vendor-payment.route.ts#L281-L285)
- **Root cause:** `moneyPaise` is `z.coerce.bigint().nonnegative().default(0n)`, so
  `detentionPaise` on a slip-line input is **optional and defaults to zero**. The LDC
  branch then applies `min(clientValue, serverSlabValue)` — treating the client's number as
  the broker's claim and paying the lesser. An absent field is therefore indistinguishable
  from a filed claim of ₹0, and the broker is paid **no detention at all** even when the
  slab computed a figure.
- **Business impact:** silent under-payment of a vendor. The slip balances, the voucher
  balances, and nothing warns. The only thing preventing it today is that the sole existing
  client pre-fills the claim box with the slab amount
  ([LDCSlipWizard.tsx:76-79](apps/web/features/vendor-payment/LDCSlipWizard.tsx#L76-L79)).
  A second screen, a bulk import, a mobile client or a retry rebuilt from a trimmed payload
  would underpay with no trace.
- **Example:** slab computes ₹5,000 detention. A client posts the line with
  `freightPaise` and `advancePaise` but no `detentionPaise`. Zod fills `0n`;
  `min(0, 500000) = 0`; the accrual books ₹0 detention expense and the broker is short
  ₹5,000.
- **Recommended solution:** make the claim explicit and absence meaningful —
  `claimedDetentionPaise` nullish, with the server using the slab when it is absent.
  Specified as **G6** in [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §3 and recommended
  as the first implementation task (L0-1). No schema change, no business question.

---

## E. Accounting Mistakes

### E-1 · The advance recovery credit with no debit (D-2)

**Principle:** an advance to a transporter is an **asset** until the freight is accrued. It
needs a debit when the cash leaves and a credit when the accrual absorbs it. Today only the
credit is posted, so the asset is never created and the cash outflow is never recorded.

**Three candidate treatments, using the real ledger codes.** These are the same three
options, with the same letters, as [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §3 G3 —
the two documents must not drift on this.

**Option A — post the advance at hand-over** *(recommended **[PROPOSED, NOT APPROVED]**)*
```
Hand-over:  Dr TRANSPORTER_ADVANCE_RECOVERY   advance
                Cr <funding Cash-Bank>            advance
Accrual:        Cr TRANSPORTER_ADVANCE_RECOVERY   advance   ← clears the asset to zero
```
Keeps today's accrual unchanged and is the only option that records the cash outflow on the
day it happened. Needs a capture point for *when/how* the advance was paid, which does not
exist yet.

**Option B — drop the advance line from the accrual; the payee ledger carries it**
```
Hand-over:  Dr <payee party ledger>  advance / Cr <funding Cash-Bank>  advance
Accrual:    Cr <payee>  gross (freight + detention − TDS), advance NOT deducted
```

**Option C — leave today's posting, add the §H-5 wrong-side-GL check, correct by periodic
journal** *(stop-gap; does not record the cash outflow)*.

**Status:** **the choice is an Accounts decision, tracked as Q5 in
[`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §7, and is not approved.** Option A is
this audit's recommendation only. Nothing may be implemented, and no historical entry may
be generated, before Q5–Q7 are answered in writing — see D-2's scope note and §J-5.

### E-2 · Credit notes do not reverse output GST — **High for GST compliance**

- **File:** [posting.service.ts:1081-1090](apps/server/src/modules/ledger/posting.service.ts#L1081-L1090); input schema [billing.schema.ts:119-123](packages/validators/src/billing/billing.schema.ts#L119-L123) carries only `amountPaise`
- **Current entry:** `Dr SALES_ADJUSTMENT (full amount) / Cr Customer (full amount)`.
- **Correct treatment:** a credit note against a taxable invoice must reverse the
  proportionate output tax, because the customer's receivable falls by the tax-inclusive
  amount while the government's claim falls by the tax component:
  ```
  Dr SALES_ADJUSTMENT   taxable portion
  Dr OUTPUT_IGST        (or OUTPUT_CGST + OUTPUT_SGST)   tax portion
      Cr Customer       full note amount
  ```
- **Impact:** output GST liability stays overstated by the tax in every credit note, and
  `SALES_ADJUSTMENT` silently absorbs tax that belongs in a duties-and-taxes head. The
  GSTR-1 credit-note table cannot be derived from these vouchers. Under Indian GST a
  credit note must carry its own taxable value and tax breakup — the schema has nowhere to
  put them.
- **Fix:** add `taxableAmountPaise` and per-component tax to `BillCreditNote` (mirroring
  `BillTaxLine`), derive the split from the bill's own treatment, and post the three-line
  voucher.

### E-3 · `paidAmountPaise` is not "amount settled", and nothing says so

ACCT-R1's G4 explained it: `paidAmountPaise` accumulates only `amountAppliedPaise` (cash),
while `outstandingAmountPaise` falls by the **full** settlement including TDS, damage and
rate difference. So `total ≠ paid + outstanding` for any bill with a deduction — correct
behaviour, dangerous naming. ACCT-R1 recommended a doc comment on the model; none was
added. Any future report computing "settled" as `paidAmountPaise` will understate it by
every deduction ever taken.

**Worked example (all amounts verified against the code paths):** bill ₹52,500; receipt
₹30,000 cash + ₹500 TDS. `paidAmountPaise` = ₹30,000; `outstandingAmountPaise` = ₹22,000;
`total` = ₹52,500. 30,000 + 22,000 = ₹52,000 ≠ ₹52,500 — the missing ₹500 is the TDS,
correctly sitting in `TDS_RECEIVABLE`.

### E-4 · Receipt cancellation can leave a bill in the wrong status — **Low**

[receipt.route.ts:812-819](apps/server/src/modules/receipt/receipt.route.ts#L812-L819) sets
`status: restoredOutstanding >= bill.totalAmountPaise ? "FINALISED" : "PARTIALLY_PAID"`.
If the bill also carries a credit note, restored outstanding can never reach the total, so
a bill with every receipt cancelled stays `PARTIALLY_PAID` while nothing has been paid.
Cosmetic for the money (the amounts are right) but it misreports on every status-filtered
list.

### E-5 · On-account / advance customer receipts cannot be recorded — **High as a workflow gap**

`Receipt.amountPaise` is **derived** as `Σ allocations.amountAppliedPaise`
([receipt.route.ts:244-248](apps/server/src/modules/receipt/receipt.route.ts#L244-L248)), so
a receipt can never exceed what it allocates. `unallocatedPaise` therefore stays 0
forever, and the statement's `onAccountPaise` is always zero. In a transport business
customers routinely pay a round lump sum against several bills, or pay in advance of
billing. Today the operator must wait for the bills or split the payment manually.

**Correct treatment:** allow `amountPaise > Σ applied`, post the remainder as `Cr Customer`
(advance), and let a later allocation move it against bills. The schema column already
exists; only the route and voucher need it. The one thing to get right is the voucher's
bank line, which today is `Σ amountApplied` and would need to become the full cash
received.

### What is accounting-correct (verified line by line, do not change)

- **Sales voucher.** Dr customer = total; income netted per GL code so one head hit by an
  addition and a deduction collapses to a single line; tax per component; round-off either
  direction; `NEW_REF` for the full total. Numeric check: freight ₹50,000 + IGST 5% →
  Dr Customer 52,50,000 paise, Cr FREIGHT_INCOME 50,00,000, Cr OUTPUT_IGST 2,50,000.
  Balances; round-off 0.
- **Receipt voucher.** Dr Bank (cash only) + Dr TDS/Damage/RateDiff, Cr customer = sum of
  the debits, `AGAINST_REF` per bill at the **full** settled amount. Numeric check:
  ₹30,000 + ₹500 TDS → Dr Bank 30,00,000, Dr TDS_RECEIVABLE 50,000, Cr Customer 30,50,000.
  Balances; outstanding falls ₹30,500. Correct.
- **Deductions force approval.** Any TDS/damage/rate-diff sends the receipt to
  `PENDING_APPROVAL`, the bill's outstanding is not touched until approval, and the
  ceiling is re-validated at approval time. Correct maker-checker on money.
- **Reservation of pending receipts.** A bill with a `PENDING_APPROVAL` receipt cannot
  receive a second one — prevents double allocation of the same outstanding.
- **Vendor accrual and settlement.** Expense/recovery heads match legacy's balance-freight
  formula; the payee's `NEW_REF` is the net payable; each partial disbursement posts its
  own `AGAINST_REF`. Correct.
- **Reversal symmetry.** Lines swapped, allocations mirrored both ways, original marked
  `REVERSED`, at-most-once enforced by `reversesId @unique` and an early return.
- **Opening balances.** Difference-based (`typed − ERP balance before the date`), posted
  against a suspense head, excluded from its own base calculation via `notOpeningBalance`,
  correction reverses then re-posts. Subtle and right.
- **Reversal-echo exclusion.** `reversesId: null` in the statement's adjustment query —
  the fix for a real ₹1,05,210 overstatement. Do not remove it.
- **No floating-point money.** `taxForRate` and the round-off use BigInt half-up
  arithmetic. `rupeesToPaise = Math.round(value * 100)` is the only float touchpoint and is
  correctly rounded at the boundary.

---

## F. Missing Features

| # | Feature | Why it is needed | Status |
|---|---|---|---|
| F-1 | **Trial Balance** | The one report that proves the books balance. Nothing in server, web or types. Without it D-2-class errors are undetectable | Missing |
| F-2 | **Account-wise GL ledger** | A Chart of Accounts you cannot drill into. No way to view `TDS_PAYABLE`, `OUTPUT_IGST`, `FREIGHT_INCOME` movements | Missing |
| F-3 | **Party opening balances** | Only cash/bank have them. Every customer's and vendor's pre-ERP balance has nowhere to go — a blocker for cutover from the legacy system | Missing |
| F-4 | **Runtime reconcile** | `ACCOUNTS_LEDGER_BUILD.md` §1.5 names the allocation sum as the audit-grade truth "a reconcile check compares against." Only a unit test of pure functions exists | Missing |
| F-5 | **On-account / advance receipts** (E-5) | Customers pay lump sums; the column exists, the path does not | Missing |
| F-6 | **Tally bridge** (D-9) | XML builder, HTTP transport, `tallyMasterId` tracking, retry worker, per-voucher error surface, reconcile, `accounts.tally.sync` permission | Missing |
| F-7 | **Period / FY close** | `POST /ledger/journal` accepts any `voucherDate`, including a prior year already reported. No lock | Missing |
| F-8 | **Posted-voucher immutability** | No DB trigger or application guard stops a future code path from editing a `POSTED` voucher's lines | Missing |
| F-9 | **Balanced-voucher DB constraint** | `postJournal` enforces Dr=Cr in application code only. A deferred CHECK or trigger would make an unbalanced voucher unrepresentable | Missing |
| F-10 | **Reverse-charge billing** (D-4) | Enum, column and index exist; no path sets it. Documented as conditional ("when needed") | Missing |
| F-11 | **TDS compliance reporting** | ACCT-R1 G2: amounts stored, `tdsSection`/cert captured but not enforced when TDS > 0. No 26AS-style report, no TDS payable register | Partially implemented |
| F-12 | **DC acknowledgement / approval stage** | `ERP_MODULE_PLAN_V2.md` §4.4 + `CONTEXT.md` §5.2: two parallel acks (supervisor + broker) reconciled at `DCApproval`, described as the anti-fraud control. LDC slips are built straight from an `ISSUED` challan; **five** deduction heads — shortage, damage, parking, other expenses, labour — are consequently absent from the LDC payable. Structurally that is **four new columns**: `damagePaise` already exists on `VendorPaymentSlipLine` (used by TRANSPORTER) but is forced to zero for LDC by `ZERO_LINE_COMPONENTS`. See `LDC_WORKFLOW_PLAN.md` §3 G5 | Missing |
| F-13 | **Cash Book / Bank Book as named reports** | `ledgerForAccount` serves both, keyed by the account's own `type`. Usable, but there is no dedicated Cash Book / Bank Book with opening-movement-closing framing | Partially implemented |
| F-14 | **Journal Register** | Day Book covers it for a date range, truncated at 500 (D-7). No voucher-type register with totals | Partially implemented |
| F-15 | **Branch-wise financial reports** | Vouchers carry `branchId` and the Day Book filters on it, but there is no branch P&L / branch trial balance | Missing |

---

## G. Architectural Improvements

### Necessary corrections (do these)

1. **One source of truth for a bill's outstanding.** Today there are four:
   `Bill.outstandingAmountPaise`, `ReceiptAllocation`, `LedgerAllocation`, and
   `CashReceivable.totalAmount`. Keep the column as the fast denormalised copy — that
   decision is sound and documented — but make the allocation trail authoritative and add
   F-4 to assert they agree. D-1 is exactly the failure this prevents.
2. **Collapse the two allocation trails for receipts.** A receipt writes both a
   `ReceiptAllocation` (read by every report) and a `LedgerAllocation` `AGAINST_REF` (read
   by nothing). Either make the reports read `LedgerAllocation` uniformly — which would
   have made D-1 impossible, since notes and receipts would share one path — or document
   `LedgerAllocation` as Tally-bill-allocation plumbing only.
3. **Make allocations mandatory for any voucher that touches a party-with-references.** A
   lint-level or type-level rule ("a voucher whose party line is a debtor/creditor must
   carry an allocation") turns D-1 from a silent omission into a compile or runtime error.
4. **Retire the parallel `LedgerEntry` writes.** Four of the five report views already read
   `JournalLine`. The remaining writes produce a log that is written and (for bank/cash,
   creditor, driver and expense) no longer read — drift that nothing can detect. Finish the
   Phase 5 migration, drop `recordLedgerEntry`, delete `ledgerForCustomer` (D-11).
5. **Branch-scope the five legacy ledger reads** (D-10).
6. **Paginate the Day Book** (D-7).

### Optional improvements

7. **`getGLLedger` in a loop.** `postSalesVoucher` and `postReceiptVoucher` call it once
   per GL code sequentially inside the transaction. `postVendorSlipAccrual` already
   batches all 8 codes into one `findMany` with a nice comment explaining why — apply the
   same treatment to the other two.
8. **Cache the chart of accounts.** GL ledgers change almost never and are read on every
   voucher; the `cached()` helper used for detention slabs fits exactly.
9. **Consistent money representation in Cash Planning.** `buildDayView` converts paise to
   JS `Number`. Integer-exact below 2^53 (₹90 trillion) so not a bug, but it is the one
   place the `BigInt` paise convention is dropped.
10. **`Number(amountPaise)` in `driver-salary-allocation.compute.ts:40`** rounds a share to
    whole rupees via float. Deliberate (whole-rupee salary shares) but worth a comment
    stating the rounding policy and who absorbs the remainder.
11. **Index review.** `JournalLine` has `@@index([ledgerId])`; the party and GL ledger
    reads filter `ledgerId` + `journalEntry.voucherDate`, which cannot use a single index.
    A composite or a denormalised `voucherDate` on `JournalLine` would help once volume
    grows. Not urgent.
12. **Auditability.** Vouchers record `createdById`/`postedById`, and `recordAuditEntry`
    is used in vendor payments. Billing and receipts rely on `statusHistory` instead.
    Unifying on the audit log would make "who changed this money" answerable in one place.
13. **Service separation.** `posting.service.ts` is ~1,850 lines and 20 voucher builders.
    It works and the shared `postJournal` core is the right design; splitting per domain
    (`posting/sales.ts`, `posting/vendor.ts`, …) over a shared core would ease review. Not
    a correctness concern — do not do this while P0 fixes are in flight.

---

## H. Test and Reconciliation Gaps

**Existing accounting tests (all 246 pass, verified):**

| File | Covers |
|---|---|
| `ledger/__tests__/customer-statement.test.ts` | `composeStatement`, running balance, row ordering |
| `ledger/__tests__/ageing.test.ts` | `bucketFor`, `bucketBills` |
| `ledger/__tests__/reconciliation.test.ts` | ACCT-R7 identities: Σ statement closing = Σ bill-wise = Σ ageing; cancelled bill/reversed receipt contribute nothing; FY-boundary opening |
| `ledger/__tests__/vendor-statement.test.ts` | `composeVendorStatement` |
| `ledger/__tests__/driver-finance.lines.test.ts` | Driver voucher line construction |
| `vendor-payment/__tests__/*` (5 files) | Eligible-source streaming, slip list query, source locking, transporter owner/truck calculators |
| `detention/__tests__/detention.engine.test.ts` | Detention window + slab banding |

**The structural gap:** every accounting test is a **pure-function unit test**. There is
not one test that exercises `postJournal`, `postSalesVoucher`, `postReceiptVoucher`,
`postVendorSlipAccrual` or `reverseJournal` against a database — not even an in-memory or
transactional-rollback harness. That is precisely why D-1 survives a green suite: the
compute functions are proven correct *given* credit-note rows, and nothing tests that the
DB layer produces them.

**Missing tests, by the scenarios requested:**

| Scenario | Covered? | What is needed |
|---|---|---|
| Full payment | Partially (compute only) | Integration: receipt → voucher lines → bill `PAID` |
| Partial payment | Partially | Same, asserting `PARTIALLY_PAID` + residual outstanding |
| Multiple invoice allocation | **No** — ACCT-R1 G5 noted no real multi-bill receipt exists | One receipt, three bills, three `AGAINST_REF` rows, three bills reduced |
| Receipt with TDS | Compute only | `PENDING_APPROVAL` path → approve → Dr TDS_RECEIVABLE present, settled = cash + TDS |
| Receipt cancellation | Compute only | Reversal mirrors allocations; bill reopens; E-4 status case |
| Vendor advance | **No** | The D-2 scenario. A test asserting the advance-recovery ledger nets to zero would have caught it |
| Vendor payment / partial | **No** (calculators only) | Accrual → two partial disbursements → slip `PAID`, allocations sum to net |
| Payment reversal | **No** | `reverseVendorSlipAccrual` on an unpaid slip; refusal when paid |
| **Credit note** | **No** | Would catch D-1 directly: post a note, assert an allocation exists and `perBillOutstanding` drops |
| Manual journal | **No** | Balanced accepted, unbalanced rejected, inactive ledger rejected |
| Duplicate posting | **No** | Re-approve a slip → same `accrualJournalEntryId`; replay a `clientRequestId` → one disbursement |
| Concurrent transactions | **No** | Two receipts on one bill under the advisory lock; D-3's receipt-vs-credit-note race |
| Branch-wise accounting | **No** | Voucher `branchId` correctness + D-10's scoping |
| FY boundaries | Partially (one compute test) | D-5: a reversal across 31 March |

**Reconciliation mechanisms that should exist (none do at runtime):**

1. `Σ JournalLine.debitPaise = Σ JournalLine.creditPaise` per branch, per FY, and globally
   — the trial-balance identity (F-1).
2. Per bill: `Σ NEW_REF − Σ AGAINST_REF = Bill.outstandingAmountPaise`. Would catch D-1
   and D-3 the day they happen.
3. Per slip: `Σ NEW_REF − Σ AGAINST_REF = netPayablePaise − paidPaise`.
4. Per cash account: journal balance = `CashAccountAdjustment`-derived Cash Planning
   closing. Would quantify D-6.
5. Every GL head with a one-sided lifetime balance where the account group implies
   otherwise — a `CURRENT_ASSET` in permanent credit. Would have flagged D-2 immediately.
6. Orphan checks: a `FINALISED`+ bill with no `journalEntryId`; a `POSTED` receipt with no
   voucher; a `POSTED` voucher whose own lines do not balance.
7. `Σ Bill.outstandingAmountPaise` (receivable statuses) = `Σ CashReceivable.totalAmount`
   = the Ageing grand total — ACCT-R1's Step 4, which held exactly on 2026-09-11 and
   should run continuously, not once.

The ACCT-R1 one-off Prisma scripts (`_acct_r1_audit.ts`, `_acct_r_spotcheck.ts`,
`_acct_r6_export_check.ts`) and `prisma/ldc-inventory.ts` are good raw material — they
should become a maintained `pnpm accounts:reconcile` command rather than
underscore-prefixed throwaways at the app root.

---

## I. Prioritized Implementation Roadmap

### P0 — Financial correctness (do first, in this order)

| # | Task | Depends on | Why this order |
|---|---|---|---|
| P0-1 | **D-1** — write `LedgerAllocation` on credit/debit note vouchers; extend both report queries to include `DEBIT_NOTE` with `NEW_REF` signing; backfill notes already posted | — | Reports are wrong today for any customer with a note. Smallest change, largest correctness gain |
| P0-2 | **D-2** — decide and implement the advance posting (post at hand-over, or drop the accrual line); post correcting entries for the existing unbacked balance | Run `ldc:inventory` first for magnitude | Cash and a balance-sheet head are both wrong; the team already has the diagnostic |
| P0-3 | **D-3** — advisory-lock + re-read the bill in the credit-note transaction | P0-1 touches the same handler — do them together | Same file, same review |
| P0-4 | **F-4 / H-2** — reconcile endpoint or job for identities 1, 2, 3, **5** and 6. Identity 5 (a GL head whose lifetime balance sits on the wrong side of its group) is the one that would have surfaced D-2, so it belongs in the first cut | P0-1, P0-2 (so it starts green) | Turns the next D-1 into an alert instead of a six-month silence |
| P0-5 | **D-4** — add `chargeMechanism` to the tax-rule lookup | — | Independent, ten-line fix, closes a tax-filing exposure |
| P0-6 | **D-5** — settle the reversal date / `fyCode` rule | — | Needed before any period close or Tally sync is meaningful |
| P0-7 | **D-14** — make the detention claim explicitly nullish; server falls back to the slab when absent | — | Confirmed vendor under-payment reachable through the API. No schema change, no business question. Equals `LDC_WORKFLOW_PLAN.md` **L0-1** |

### P1 — Missing essential accounting functionality

| # | Task | Depends on |
|---|---|---|
| P1-1 | **F-1 Trial Balance** (by branch, by FY, with group subtotals) | P0-4 shares the aggregation |
| P1-2 | **F-2 Account-wise GL ledger** with drill-through from Chart of Accounts | F-1 |
| P1-3 | **E-2** credit-note GST reversal — schema (`taxableAmountPaise` + tax components) then voucher | P0-1 (same voucher builder) |
| P1-4 | **F-3 Party opening balances** as balanced `OPENING_BALANCE` journals | F-1 (to prove the cutover balances) |
| P1-5 | **F-5 / E-5** on-account receipts + lump-sum auto-allocation | — |
| P1-6 | **D-8** rail rake charge payment posting | — |
| P1-7 | **D-6** manual cash adjustment → `JOURNAL` voucher | D-8 (same pattern) |
| P1-8 | **F-11** enforce `tdsSection` when TDS > 0; TDS payable/receivable registers | — |
| P1-9 | **F-12** DC acknowledgement + approval stage, and the five missing LDC deduction heads (four new columns) — specified as `LDC_WORKFLOW_PLAN.md` phases L4/L5 | Rail/DC module |
| P1-10 | **D-13** correction / refund path for a paid vendor-payment slip | Q15; shares the deduction-head machinery with P1-9 |

### P2 — Reconciliation, reliability, audit

| # | Task | Depends on |
|---|---|---|
| P2-1 | Integration test harness for the posting service (transactional rollback), then the H-table scenarios — credit note, vendor advance, duplicate posting and concurrency first | P0-1…P0-3 define the expected behaviour |
| P2-2 | **D-7** paginate the Day Book; **F-14** journal register with totals | — |
| P2-3 | **D-10** branch-scope the five legacy reads | — |
| P2-4 | **D-11** delete the stale customer-ledger endpoint + dead web wrapper | — |
| P2-5 | **F-7** period / FY close lock | P0-6 |
| P2-6 | **F-8 / F-9** posted-voucher immutability + balanced-voucher DB constraint | P2-1 (tests first) |
| P2-7 | Retire the parallel `LedgerEntry` writes (G-4), finishing Phase 5 | P2-3, P2-4 |
| P2-8 | **D-12** documentation pass: correct `CLAUDE.md`, `ACCOUNTS_MODULE_MAP.md` §3 and its scope note, the duplicated `JournalStatus`, close ACCT-R1 G1/G3, add the `paidAmountPaise` comment (E-3), restore or remove `LDC_WORKFLOW_PLAN.md` | — |

### P3 — Performance and architecture

| # | Task |
|---|---|
| P3-1 | Batch `getGLLedger` in sales/receipt vouchers (G-7); cache the chart of accounts (G-8) |
| P3-2 | Index review on `JournalLine` (G-11) |
| P3-3 | Unify on the audit log for money mutations (G-12) |
| P3-4 | Optional: split `posting.service.ts` per domain over the shared core (G-13) — **not** while P0 work is open |
| P3-5 | **F-13 / F-15** Cash Book / Bank Book framing; branch-wise P&L |

### P4 — Future

| # | Task | Depends on |
|---|---|---|
| P4-1 | **F-6 Tally bridge**: XML builder reusing the legacy shape, `BILLALLOCATIONS` from `LedgerAllocation`, `BANKALLOCATIONS` for bank vouchers, `Create` vs `Alter` by `tallyMasterId`, HTTP transport, retry worker, `accounts.tally.sync` permission, fallback XML download, SKERP↔Tally reconcile | **Everything in P0 and P1-1/P1-3/P1-4.** Syncing wrong numbers to the statutory book is worse than not syncing. `BILLALLOCATIONS` needs D-1 fixed; GST mapping needs E-2 fixed; a cutover needs F-3 |
| P4-2 | Replace the UI's misleading Tally badge (D-9) — do this in P2 regardless, as a label change |
| P4-3 | **F-10** reverse-charge billing, when the business needs it | D-4 |
| P4-4 | GSTR-1 / GSTR-3B extract from the voucher data | E-2, F-1 |

---

## J. Final Verdict

**1. What is correctly implemented and should not be changed**

The double-entry core (`postJournal`'s validation, the schema, the CHECK constraints), the
sales and receipt vouchers, the allocation model, reversal symmetry, the unified
vendor-payment primitive with its accrual/disbursement pair, the concurrency controls
(advisory locks, `clientRequestId` idempotency, version guards), the difference-based cash
opening balances, the BigInt-paise money discipline, the GST calculation arithmetic, the
Customer Statement with its reversal-echo guard, the Vendor Statement's operational-table
approach, the Cash Planning books-derived openings, and the decision to keep
`Bill.outstandingAmountPaise` as a denormalised copy. All of it is sound. Several pieces —
the vendor-payment primitive, the reversal-echo fix, the opening-balance design — are
better than what the documentation asked for.

**2. What is implemented incorrectly and must be fixed**

D-1 (credit/debit notes missing from the allocation trail — the one finding I would call
urgent), D-2 (advance recovery credited with no debit, against the code's own written
warning), D-3 (unlocked read-modify-write on the credit-note path), D-4 (tax rule selected
without `chargeMechanism`), D-5 (reversal `fyCode`/date mismatch), **D-14 (an omitted
`detentionPaise` pays a broker zero detention)**, E-2 (credit notes do not reverse output
GST).

**3. What is incomplete**

Tally (columns and a badge, nothing behind them). Trial balance and account-wise GL ledger
(absent). Party opening balances (cash/bank only). On-account receipts (column exists, path
does not). Rail rake payments and manual cash adjustments (unposted). The DC ack/approval
stage and the five LDC deduction heads that depend on it. **The correction/refund path for
a paid vendor-payment slip, which two code paths already defer to (D-13).** TDS compliance
reporting. Period close. Integration tests for the posting service.

**4. What has architectural problems**

Only one real one: **multiple sources of truth for the same number, with nothing checking
them against each other.** Four representations of a bill's outstanding; two allocation
trails for receipts, of which one is read and one is not; a legacy single-entry log still
written but mostly no longer read. The design intends the allocation trail to be
authoritative and the column to be a fast copy — a good design — but nothing enforces it,
and D-1 is the direct consequence. Everything else I would class as cleanup, not
architecture.

**5. Hidden financial risks**

- **D-1 is silent.** Vouchers balance, the column is right, and only the reports lie. No
  existing check can surface it.
- **D-2 is silent and compounding.** Every transporter and LDC slip adds to an unbacked
  credit balance, and cash that left the business is simply not in the books. It grows
  with volume.
- **No trial balance** means no answer to "do the books balance?" — a class of error
  (one-sided GL heads, orphan vouchers) cannot be detected at all today.
- **A green test suite is misleading.** 246 passing tests and a clean typecheck coexist
  with D-1, because every accounting test is a pure-function test fed hand-built fixtures.
- **ACCT-R1's reconciliation held exactly once, on 2026-09-11, before credit notes
  existed.** It is a snapshot, not a control.
- **D-14 is silent and client-dependent.** The only thing standing between an omitted
  field and an under-paid broker is one screen's pre-fill. Nothing server-side notices.
- **D-13 makes every payment one-way.** Once disbursed, a slip cannot be corrected in the
  system, so errors become undocumented manual journals — and permanent drift in the
  per-slip reconciliation identity once P0-4 ships.
- **Needs Verification:** the magnitude of D-1 and D-2 in live data; whether any existing
  LDC line carries a ₹0 detention the slab would have priced above zero (D-14's live
  impact, `LDC_WORKFLOW_PLAN.md` Q14); and whether the G1 historical cancelled-bill rows
  were ever backfilled after the code fix.

**6. What to fix first**

P0-1 (credit-note allocations), then P0-2 (the advance posting decision), then P0-4 (the
reconcile job). The first two correct what is wrong; the third ensures you learn about the
next one in a day rather than a quarter.

**7. Target architecture for the Accounts module**

Keep exactly what exists and close the loop around it:

- **One book of record.** `JournalEntry` + `JournalLine`, every money event posting through
  `postJournal`, no exceptions — rail rake payments, manual cash adjustments and
  branchless cash payments included.
- **One allocation trail.** `LedgerAllocation` as the authoritative bill-wise and
  slip-wise settlement record, written by *every* voucher that opens or consumes a
  reference. `ReceiptAllocation` keeps its receipt-detail role; the denormalised
  `outstandingAmountPaise` stays as the fast copy, continuously reconciled against the
  trail rather than trusted.
- **A reconcile layer that runs, not a document that describes one.** The seven identities
  in §H as a scheduled job and an on-demand endpoint, with the trial balance as its public
  face.
- **A complete report surface over the vouchers:** trial balance, account-wise ledger, day
  book (paginated), cash and bank books, customer and vendor statements, ageing,
  outstanding, branch-wise views — all reading `JournalLine` and `LedgerAllocation`, with
  the legacy `LedgerEntry` deleted.
- **A period model:** FY lock, posted-voucher immutability enforced in the database, and
  corrections only through reversal and credit/debit notes.
- **Tally as a pure export of a ledger already proven correct** — never as the place errors
  are discovered.

---

## Audit Coverage Summary

| Area | Status | Notes |
|---|---|---|
| `ACCOUNTS_MODULE_MAP.md` | **Inspected** | Read in full |
| `ACCOUNTS_LEDGER_BUILD.md` | **Inspected** | Read in full |
| `CUSTOMER_LEDGER.md` | **Inspected** | Read in full |
| `ACCT-R1-audit.md` | **Inspected** | Read in full incl. findings G1–G5 |
| `ERP_MODULE_PLAN_V2.md` §4.4-4.6, §5.1-5.3 | **Inspected** | Accounting + DC/detention sections |
| `CONTEXT.md` §5.2-5.8 | **Inspected** | Decision records |
| Other docs (`CLAIMS_JIRA`, `easy-guide/16-18`, `developer-guide/*`) | **Partially Inspected** | Grepped for accounting statements; not read end to end |
| `posting.service.ts` (~1,850 lines) | **Inspected** | All 20 voucher builders read; sales/receipt/payment/vendor/credit-note/reversal read line by line |
| `postJournal` core | **Inspected** | Validation, batching, allocation indexing |
| `billing.route.ts` — finalise / cancel / credit note | **Inspected** | Lines 1427-1790 |
| `billing.service.ts` — `calculateBill`, `refreshLRBillingStatus` | **Inspected** | GST + rounding verified numerically |
| `billing.route.ts` — draft/approve/charge-approve/tax-rule routes | **Partially Inspected** | Gating verified; business logic not traced |
| `receipt.route.ts` — create / approve / cancel | **Inspected** | Lines 150-880 |
| `vendor-payment.route.ts` — submit / approve / disburse / cancel | **Inspected** | Lines 240-1180 |
| `vendor-payment/calculators/*` (transporter, truck, hamali, ldc-broker, claims) | **Partially Inspected** | `ldc-broker.ts` fully; others by interface + tests |
| `ledger.route.ts` (20 endpoints) | **Inspected** | All gates verified by script; day-book/journal/voucher handlers read |
| `ledger.service.ts` | **Inspected** | All five report reads |
| `customer-statement.service.ts` / `.compute.ts` | **Inspected** | Including the credit-note query that proves D-1 |
| `ageing.service.ts` / `.compute.ts` | **Inspected** | Same credit-note defect confirmed |
| `vendor-statement.service.ts` / `.compute.ts` | **Partially Inspected** | Service read; compute by its tests |
| `opening-balance.service.ts` | **Inspected** | Lines 1-170 |
| `cash-planning.route.ts` / `.service.ts` | **Partially Inspected** | Posting, adjustments, `booksOpenings`, `buildDayView` read; day/receivable CRUD not |
| `log-slip` posting | **Inspected** | `postLogSlipVoucher` + call site |
| `driver-finance` / `salary-run` posting | **Partially Inspected** | Posting functions read; service flows by signature |
| `job-card` / `service-bill` / `spare-inward` / `supplier-replacement` | **Partially Inspected** | Voucher functions exist and are wired with reversal; Dr/Cr not verified line by line |
| `trip-expense` / `driver-advance` | **Inspected** | Confirmed intentionally unposted, absorbed by the log-slip voucher |
| `rail-rake-operation` charges / payments / waivers | **Inspected** | Confirmed unposted (D-8) |
| `detention` engine + service (this branch's work) | **Inspected** | Audited in the preceding session |
| `schema.prisma` accounting models | **Inspected** | `Ledger`, `JournalEntry`, `JournalLine`, `LedgerAllocation`, `Bill*`, `Receipt*`, `VendorPayment*`, `CashAccount*` |
| Migrations — CHECK constraints, indexes | **Inspected** | All CHECKs enumerated |
| Migration *applied* status | **Cannot Verify** | Directories exist; no DB access. `ACCOUNTS_LEDGER_BUILD.md`'s "NOT applied" notes are stale but unconfirmable from here |
| Production / staging **data** state | **Requires Runtime Verification** | Every data claim marked *Needs Verification*. Use `_acct_r1_audit.ts`, `_acct_r_spotcheck.ts`, `prisma/ldc-inventory.ts` |
| Permissions registry + route gating | **Inspected** | Scripted scan: 0 ungated accounting routes |
| Branch scoping | **Inspected** | D-10 confirmed |
| Test suite | **Inspected** | 246 tests run and passing; coverage gaps mapped in §H |
| Typecheck | **Inspected** | 9/9 tasks pass |
| Web accounting screens | **Partially Inspected** | Ledger/billing/receipt feature files, Tally badge, dead `forCustomer` wrapper. No client-side money arithmetic found; UI rendering not reviewed in depth |
| Tally integration | **Inspected** | Confirmed absent server-side; UI-only |
| Background jobs / workers | **Inspected** | No accounting worker exists (no Tally sync, no reconcile job) |
| Trial balance / GL ledger reports | **Inspected** | Confirmed absent |

**Not inspected (declared, not silently skipped):** the web UI's rendering and state
handling for accounting screens beyond service calls; `billing.route.ts`'s draft/approve
half; the workshop voucher builders' individual Dr/Cr heads; `claims.ts` and the
eligible-source streaming internals; PDF/XLSX statement export (`statement-export.ts`);
notification and dashboard widgets that read money.

**Audit status: complete for the server-side accounting logic**, which is where every
correctness risk lives. Two areas remain open by necessity: live data verification
(requires a database) and the web UI's presentation layer (lower risk — no money
arithmetic happens client-side).
