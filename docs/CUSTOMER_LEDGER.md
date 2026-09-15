# Customer Ledger, Ageing & Statement (EPIC ACCT-R)

Design note for the Debtor statement + Ageing tab shipped under EPIC ACCT-R.
Companion to [`ACCT-R1-audit.md`](./ACCT-R1-audit.md) and [`ACCOUNTS_LEDGER_BUILD.md`](./ACCOUNTS_LEDGER_BUILD.md).

## Problem

`/ledger` → **Debtor** tab read the `LedgerEntry` table — an append-only IN/OUT
cash-movement mirror written by `recordLedgerEntry(...)` on **Receipt** posting and cash
payments only. Bill finalisation never writes a `LedgerEntry` (it posts a double-entry
SALES `JournalEntry` + a `CashReceivable`), so the tab showed receipts with no invoices —
never a real outstanding balance.

## Data sources (this epic)

Read **directly** from the operational tables — not `LedgerEntry`, not a full `JournalLine`
reconstruction (that's ACCT-R9, deferred):

| Statement line | Table | Sign (Dr-positive balance) |
|---|---|---|
| Bill | `Bill` where `status ∈ {FINALISED, SENT, PARTIALLY_PAID, PAID}` | Dr `totalAmountPaise` |
| Receipt | `Receipt` where `status = POSTED` + its `ReceiptAllocation[]` | Cr `Σ(amountApplied + tds + damage + rateDiff)` |
| Credit / Debit note, manual JV | `JournalLine` on the customer's PARTY `Ledger`, entry `status = POSTED`, `voucherType ∈ {CREDIT_NOTE, DEBIT_NOTE, JOURNAL}` | Cr `creditPaise` − Dr `debitPaise` |

SALES and RECEIPT vouchers also hit the party ledger — the `voucherType` filter keeps them
out so bills/receipts aren't double-counted.

**Reversal vouchers are also excluded** (`reversesId: null` in the adjustment-lines query).
`reverseJournal()` (`posting.service.ts`) always reverses a cancelled bill's SALES voucher or
a cancelled receipt's RECEIPT voucher as a fresh `voucherType: "JOURNAL"` entry with
`reversesId` pointing at the original — indistinguishable from a genuine manual JV by
`voucherType`/`sourceType` alone. Without this guard, a cancellation is double-handled: once
correctly (the cancelled Bill/Receipt row is simply excluded by its own `status` filter) and
once incorrectly (its reversal echo re-read as an independent adjustment, re-adding the
cancelled amount). Found via a real-data spot check on 2026-09-11 — see
[`ACCT-R1-audit.md`](./ACCT-R1-audit.md#findings).

**On-account cash** (`Receipt.unallocatedPaise`) is reported in the totals block
(`onAccountPaise`) but does **not** move the running balance, so `closingBalance` stays
equal to `Σ` bill-wise outstanding (the Ageing / R4 identity).

## Modules

| Path | Role |
|---|---|
| `apps/server/src/modules/ledger/customer-statement.compute.ts` | Pure: `composeStatement`, `computeBillOutstanding`. No Prisma — unit-tested. |
| `apps/server/src/modules/ledger/ageing.compute.ts` | Pure: `bucketFor`, `bucketBills`. |
| `apps/server/src/modules/ledger/customer-statement.service.ts` | DB layer → `buildCustomerStatement` (R2), `perBillOutstanding` (R4). |
| `apps/server/src/modules/ledger/ageing.service.ts` | DB layer → `buildAgeingReport` (R5). |
| `apps/server/src/modules/ledger/statement-export.ts` | `buildStatementHtml` (→ puppeteer PDF), `buildStatementXlsx` (exceljs). |
| `apps/server/src/modules/ledger/ledger.route.ts` | Routes below, all `can(PERMS.LEDGER.VIEW)`. |
| `apps/web/features/ledger/LedgerPage.tsx` | Debtor tab → statement; new **Ageing** tab; branch + FY + date filters. |
| `apps/web/features/ledger/components/LedgerTable.tsx` | `variant="statement"` path (Bank/Cash/Creditor/Expense unchanged). |
| `apps/web/features/ledger/components/AgeingTable.tsx` | Per-customer bucket grid. |
| `apps/web/features/ledger/components/StatementExportButton.tsx` | PDF / Excel download. |

### Endpoints

```
GET /ledger/customers/:id/statement?branchId=&fyCode=&from=&to=      -> CustomerStatementView
GET /ledger/customers/:id/bills-outstanding?branchId=&fyCode=&to=    -> BillOutstandingRow[]
GET /ledger/ageing?branchId=&fyCode=&asOf=                           -> AgeingReportView
GET /ledger/customers/:id/statement/pdf?<statement filters>          -> application/pdf
GET /ledger/customers/:id/statement/xlsx?<statement filters>         -> xlsx
```

Branch scoping: an explicit `branchId` is access-checked (`assertBranchAccess`); otherwise
the caller's `branchFilter(req)` scope applies to the Bill / Receipt / JournalEntry reads.

## Reconciliation identities (enforced by `__tests__/reconciliation.test.ts`)

```
Σ statement closing (per customer)
  == Σ bill-wise outstanding (R4)
  == Σ ageing buckets (R5)
  == expected receivables figure
opening(1 Apr) == closing(31 Mar)          (FY boundary)
cancelled bill / reversed receipt          contributes 0 everywhere
```

Run: `pnpm --filter @skerp/server test` (also runs in CI — `.github/workflows/ci.yml`).

## Ageing buckets

`effectiveDue = bill.dueDate ?? bill.billDate`; `daysOverdue = floor((asOf − effectiveDue)/day)`:
`≤ 0 → Not due`, `1–30`, `31–60`, `61–90`, `> 90`. Only bills with `outstanding > 0` are
bucketed.

## Verified against real data (2026-09-11)

Spot-checked the actual `buildCustomerStatement` / `perBillOutstanding` / `buildAgeingReport`
functions (not a reimplementation) against the dev/staging DB, read-only:

- Σ statement closing == Σ bill-wise outstanding == Ageing grand total == `Σ
  CashReceivable.totalAmount` (source=BILL, the app's existing receivables tracker) — all
  exactly **₹3,74,825** across every customer with a bill.
- Generated a real PDF + Excel export for a 22-line customer and read the PDF back — layout,
  running balance, and totals all correct (Date / Particulars / Type / Voucher # / Debit /
  Credit / Balance, matching the Debtor tab's own columns).
- See `apps/server/_acct_r1_audit.ts` and `_acct_r_spotcheck.ts` (ad-hoc, read-only scripts —
  same convention as `_trace_receipt_credit.ts`; not part of the build).

## Not in scope

Creditor tab (needs vendor-payable data — ACCT-R8), Customer/Vehicle P&L (needs cost data),
switching ledgers to `JournalLine` as source of truth (ACCT-R9).
