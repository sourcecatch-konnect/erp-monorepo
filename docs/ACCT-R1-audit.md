# ACCT-R1 — Audit: is Bill / Receipt / allocation data complete and trustworthy?

**Type:** investigation · **Blocks:** ACCT-R2 → R7
**Status:** _[ ] not run · [ ] run, clean · [x] run, gaps filed (none block the epic — see Findings)_
**Run by:** Claude Code (automated, read-only Prisma scripts — no `psql` available)
**Date:** 2026-09-11 · **DB / environment:** dev/staging (`DATABASE_URL` in `apps/server/.env`, Supabase-hosted Postgres)

---

## Why this exists

Every later ticket assumes that when a bill is finalised and a receipt is recorded +
allocated, the rows are saved correctly and completely. The Customer Statement (R2), the
bill-wise outstanding (R4), and the Ageing report (R5) are all arithmetic on top of these
tables. If the data is wrong, the numbers on screen will be wrong in a way that looks
authoritative. This ticket checks the assumption **before** any calculation or UI work.

## What "trustworthy" means here (the checks below prove or disprove each)

1. Cancelled / voided bills and receipts are flagged as such and do **not** count as active.
2. A receipt that pays two bills has **two** `ReceiptAllocation` rows and both bills show reduced.
3. `Bill.outstandingAmountPaise` (the denormalised column the app mutates) equals a
   first-principles recalculation: `totalAmountPaise − Σ receipt allocations − Σ credit notes`.
4. Every rupee of a POSTED receipt is accounted for: `Σ(amountApplied + tds + damage +
   rateDiff) over its allocations + unallocatedPaise == amountPaise`.
5. TDS deducted at receipt time is stored (`ReceiptAllocation.tdsAmountPaise` + section/cert).
6. The sum of all customers' outstanding matches the company's receivables figure from
   whatever report Accounts uses today.

---

## How to run

```bash
# from repo root — uses the same DATABASE_URL the server uses
psql "$DATABASE_URL" -f docs/sql/acct-r1-audit.sql        # if you split the queries into a file
# or paste the blocks below into psql / TablePlus / DBeaver one at a time
```

All amounts are **paise** (`BigInt`). Divide by 100 for rupees. Dates are `timestamptz`.

Money-in enum values referenced below:
- `Bill.status`: `DRAFT, PENDING_REVIEW, APPROVED, FINALISED, SENT, PARTIALLY_PAID, PAID, CANCELLED`
  — a bill is a **real receivable** only from `FINALISED` onward; `CANCELLED` is dead.
- `Receipt.status`: `DRAFT, PENDING_APPROVAL, POSTED, CANCELLED` — only `POSTED` moved money.
- `JournalEntry.status`: `DRAFT, POSTED, REVERSED`; `voucherType` includes `CREDIT_NOTE, DEBIT_NOTE`.

---

## Step 1 — Pick 5–10 sample customers (mix of paid / partial / unpaid)

```sql
SELECT
  c.id,
  c.name,
  count(*)                                             AS bills,
  count(*) FILTER (WHERE b.status = 'PAID')            AS paid,
  count(*) FILTER (WHERE b.status = 'PARTIALLY_PAID')  AS partially_paid,
  count(*) FILTER (WHERE b.status IN ('FINALISED','SENT')) AS unpaid,
  count(*) FILTER (WHERE b.status = 'CANCELLED')       AS cancelled,
  sum(b.total_amount_paise)        FILTER (WHERE b.status <> 'CANCELLED') AS billed_paise,
  sum(b.outstanding_amount_paise)  FILTER (WHERE b.status <> 'CANCELLED') AS outstanding_paise
FROM "Customer" c
JOIN "Bill" b ON b.billing_customer_id = c.id
GROUP BY c.id, c.name
HAVING count(*) FILTER (WHERE b.status = 'PAID') > 0
   AND count(*) FILTER (WHERE b.status = 'PARTIALLY_PAID') > 0
   AND count(*) FILTER (WHERE b.status IN ('FINALISED','SENT')) > 0
ORDER BY outstanding_paise DESC NULLS LAST
LIMIT 10;
```

> **Note on column names.** The queries use `snake_case` (Postgres default via `@@map`-less
> Prisma → Prisma actually keeps the model field casing). If your DB columns are camelCase
> (`billingCustomerId`, `outstandingAmountPaise`, …), quote them: `b."billingCustomerId"`.
> Confirm once with `\d "Bill"` in psql, then adjust all blocks the same way.

Record the chosen IDs here:

| # | Customer ID | Name | Why chosen |
|---|-------------|------|------------|
| 1 |             |      |            |
| 2 |             |      |            |
| … |             |      |            |

---

## Step 2 — Full trace for one customer (repeat per sample customer)

Set the id once:

```sql
\set cust '"PUT_CUSTOMER_ID_HERE"'
```

### 2a. Every bill

```sql
SELECT b.id, b.bill_number, b.status, b.bill_date, b.due_date,
       b.total_amount_paise, b.paid_amount_paise, b.outstanding_amount_paise,
       b.cancelled_at, b.cancelled_by_id, b.finalised_at, b.fy_code, b.branch_id
FROM "Bill" b
WHERE b.billing_customer_id = :cust
ORDER BY b.bill_date, b.created_at;
```

### 2b. Every receipt + its allocations

```sql
SELECT r.id AS receipt_id, r.receipt_number, r.status, r.received_at,
       r.amount_paise, r.unallocated_paise,
       ra.bill_id, ra.amount_applied_paise, ra.tds_amount_paise, ra.tds_section,
       ra.tds_cert_number, ra.damage_amount_paise, ra.rate_diff_amount_paise
FROM "Receipt" r
LEFT JOIN "ReceiptAllocation" ra ON ra.receipt_id = r.id
WHERE r.customer_id = :cust
ORDER BY r.received_at, r.created_at, ra.created_at;
```

### 2c. Credit / debit notes + manual journal adjustments on this customer's party ledger

```sql
SELECT je.id, je.voucher_type, je.voucher_number, je.voucher_date, je.status,
       jl.debit_paise, jl.credit_paise, je.narration
FROM "Ledger" led
JOIN "JournalLine" jl  ON jl.ledger_id = led.id
JOIN "JournalEntry" je ON je.id = jl.journal_entry_id
WHERE led.kind = 'PARTY'
  AND led.customer_id = :cust
  AND je.voucher_type IN ('CREDIT_NOTE','DEBIT_NOTE','JOURNAL')
ORDER BY je.voucher_date, je.created_at;
```

> If 2c returns **zero rows for every sample customer**, that is a finding, not a pass:
> it means credit notes are not being captured anywhere (see Gap G3 template below).

### 2d. Hand-build the statement and compare

On paper / in a sheet: opening 0 → +`total_amount_paise` per non-cancelled bill (by
`bill_date`) → −`(amount_applied + tds + damage + rate_diff)` per POSTED-receipt allocation
(by `received_at`) → ± journal lines from 2c. The final balance **must equal**
`Σ outstanding_amount_paise` over this customer's non-cancelled bills (query 3a).

---

## Step 3 — Integrity checks (run across the WHOLE table, not just samples)

### 3a. Bill outstanding drift — denormalised column vs first-principles

`LedgerAllocation` also carries every RECEIPT voucher's own bill settlement (as an
AGAINST_REF row) and every reversal voucher's flipped mirror (posting.service.ts
`reverseJournal` always reverses as `voucherType: 'JOURNAL'`, `reversesId` set) — the `cn` CTE
below **must** filter to `voucher_type = 'CREDIT_NOTE'` or it double-counts receipts already
summed in `alloc` and wrongly re-applies a cancelled receipt's reversal (verified against real
data on 2026-09-11 — the app's own `perBillOutstanding()` already scopes this correctly; this
query needs the same filter to match it).

```sql
WITH alloc AS (
  SELECT ra.bill_id,
         sum(ra.amount_applied_paise + ra.tds_amount_paise
             + ra.damage_amount_paise + ra.rate_diff_amount_paise) AS settled_paise
  FROM "ReceiptAllocation" ra
  JOIN "Receipt" r ON r.id = ra.receipt_id
  WHERE r.status = 'POSTED'
  GROUP BY ra.bill_id
),
cn AS (
  SELECT la.bill_id, sum(la.amount_paise) AS cn_paise
  FROM "LedgerAllocation" la
  JOIN "JournalEntry" je ON je.id = la.journal_entry_id
  WHERE la.ref_type = 'AGAINST_REF' AND je.status = 'POSTED' AND je.voucher_type = 'CREDIT_NOTE'
  GROUP BY la.bill_id
)
SELECT b.id, b.bill_number, b.status,
       b.total_amount_paise,
       b.outstanding_amount_paise                                   AS denormalised,
       b.total_amount_paise
         - coalesce(alloc.settled_paise, 0)
         - coalesce(cn.cn_paise, 0)                                 AS recomputed,
       b.outstanding_amount_paise
         - (b.total_amount_paise - coalesce(alloc.settled_paise,0) - coalesce(cn.cn_paise,0)) AS diff_paise
FROM "Bill" b
LEFT JOIN alloc ON alloc.bill_id = b.id
LEFT JOIN cn    ON cn.bill_id = b.id
WHERE b.status <> 'CANCELLED'
  AND b.outstanding_amount_paise
      <> b.total_amount_paise - coalesce(alloc.settled_paise,0) - coalesce(cn.cn_paise,0)
ORDER BY abs(b.outstanding_amount_paise
             - (b.total_amount_paise - coalesce(alloc.settled_paise,0) - coalesce(cn.cn_paise,0))) DESC;
```

**Expected:** 0 rows. Any row = the column and reality disagree → Gap G1.

### 3b. `total = paid + outstanding` on every non-cancelled bill

```sql
SELECT id, bill_number, status, total_amount_paise, paid_amount_paise, outstanding_amount_paise
FROM "Bill"
WHERE status <> 'CANCELLED'
  AND total_amount_paise <> paid_amount_paise + outstanding_amount_paise;
```

**Expected:** 0 rows.

### 3c. Receipt fully accounted for

`Receipt.amountPaise` is **cash received only** — `receipt.route.ts` sets it to
`Σ amountAppliedPaise` at creation. TDS/damage/rate-difference are *non-cash* deductions
applied to the bill, not part of the receipt's own amount, so they must **not** be included
here (an earlier draft of this check did include them and produced false positives — verified
against real data on 2026-09-11, see Findings).

```sql
WITH s AS (
  SELECT r.id, r.receipt_number, r.amount_paise, r.unallocated_paise,
         coalesce(sum(ra.amount_applied_paise), 0) AS cash_applied_paise
  FROM "Receipt" r
  LEFT JOIN "ReceiptAllocation" ra ON ra.receipt_id = r.id
  WHERE r.status = 'POSTED'
  GROUP BY r.id, r.receipt_number, r.amount_paise, r.unallocated_paise
)
SELECT *, amount_paise - (cash_applied_paise + unallocated_paise) AS diff_paise
FROM s
WHERE amount_paise <> cash_applied_paise + unallocated_paise
ORDER BY abs(amount_paise - (cash_applied_paise + unallocated_paise)) DESC;
```

**Expected:** 0 rows.

### 3d. Allocations pointing at a cancelled bill

```sql
SELECT ra.id, ra.receipt_id, ra.bill_id, b.status AS bill_status, r.status AS receipt_status,
       ra.amount_applied_paise
FROM "ReceiptAllocation" ra
JOIN "Bill" b    ON b.id = ra.bill_id
JOIN "Receipt" r ON r.id = ra.receipt_id
WHERE b.status = 'CANCELLED';
```

**Expected:** 0 rows, OR every such row belongs to a `CANCELLED` receipt (allocation was
reversed with the bill). Anything else = Gap G2.

### 3e. Cancelled bills / receipts must carry their cancellation metadata

```sql
SELECT 'bill' AS kind, id, bill_number AS number FROM "Bill"
WHERE status = 'CANCELLED' AND (cancelled_at IS NULL OR cancelled_by_id IS NULL)
UNION ALL
SELECT 'receipt', id, receipt_number FROM "Receipt"
WHERE status = 'CANCELLED' AND (cancelled_at IS NULL OR cancelled_by_id IS NULL);
```

**Expected:** 0 rows.

### 3f. Cancelled bill still showing outstanding > 0

```sql
SELECT id, bill_number, status, outstanding_amount_paise
FROM "Bill"
WHERE status = 'CANCELLED' AND outstanding_amount_paise <> 0;
```

**Expected:** 0 rows (or a documented, understood reason).

### 3g. Multi-bill receipts — the "splits correctly" check

```sql
SELECT ra.receipt_id, r.receipt_number, count(*) AS bills_paid,
       sum(ra.amount_applied_paise) AS total_applied_paise
FROM "ReceiptAllocation" ra
JOIN "Receipt" r ON r.id = ra.receipt_id
WHERE r.status = 'POSTED'
GROUP BY ra.receipt_id, r.receipt_number
HAVING count(*) > 1
ORDER BY bills_paid DESC
LIMIT 20;
```

Pick 2–3 of these, open query 2b for their customer, and confirm **each** referenced bill's
`outstanding_amount_paise` dropped by that allocation's settled amount.

### 3h. TDS storage sanity

```sql
SELECT
  count(*)                                              AS allocations_total,
  count(*) FILTER (WHERE tds_amount_paise > 0)          AS with_tds,
  count(*) FILTER (WHERE tds_amount_paise > 0 AND (tds_section IS NULL OR tds_section = '')) AS tds_missing_section,
  sum(tds_amount_paise)                                 AS tds_total_paise
FROM "ReceiptAllocation";
```

Confirm with Accounts: does `with_tds` roughly match how often customers deduct TDS? Is
`tds_missing_section` acceptable? TDS with no section/cert is Gap G4.

### 3i. Bills with no due date (affects Ageing bucketing)

```sql
SELECT count(*) FILTER (WHERE due_date IS NULL) AS no_due_date,
       count(*)                                 AS total
FROM "Bill"
WHERE status IN ('FINALISED','SENT','PARTIALLY_PAID','PAID');
```

If `no_due_date > 0`, R5 needs a rule (proposal: treat as due on `bill_date`). Note the count.

---

## Step 4 — Company-wide receivables reconciliation

**Scope to `status IN (FINALISED, SENT, PARTIALLY_PAID, PAID)`, not merely "non-cancelled".**
A DRAFT/PENDING_REVIEW/APPROVED bill also carries a nonzero `outstandingAmountPaise` (it just
isn't billed yet) — including those inflates this sum against every other report in the app.
(Found on the first live run of this audit, 2026-09-11: scoping by "non-cancelled" alone gave
₹9,77,529 vs. CashReceivable's ₹3,74,825; re-scoping to the receivable statuses made all three
figures below match exactly.)

```sql
-- A) sum of the denormalised outstanding column (what R4/R5 will roll up)
SELECT sum(outstanding_amount_paise) AS outstanding_col_paise
FROM "Bill" WHERE status IN ('FINALISED','SENT','PARTIALLY_PAID','PAID');

-- B) first-principles (total - settled - credit notes), same CTEs as 3a
WITH alloc AS (
  SELECT ra.bill_id, sum(ra.amount_applied_paise + ra.tds_amount_paise
         + ra.damage_amount_paise + ra.rate_diff_amount_paise) AS settled_paise
  FROM "ReceiptAllocation" ra JOIN "Receipt" r ON r.id = ra.receipt_id
  WHERE r.status = 'POSTED' GROUP BY ra.bill_id
),
cn AS (
  SELECT la.bill_id, sum(la.amount_paise) AS cn_paise
  FROM "LedgerAllocation" la JOIN "JournalEntry" je ON je.id = la.journal_entry_id
  WHERE la.ref_type = 'AGAINST_REF' AND je.status = 'POSTED' AND je.voucher_type = 'CREDIT_NOTE'
  GROUP BY la.bill_id
)
SELECT sum(b.total_amount_paise - coalesce(alloc.settled_paise,0) - coalesce(cn.cn_paise,0)) AS outstanding_recomputed_paise
FROM "Bill" b
LEFT JOIN alloc ON alloc.bill_id = b.id
LEFT JOIN cn ON cn.bill_id = b.id
WHERE b.status IN ('FINALISED','SENT','PARTIALLY_PAID','PAID');

-- C) the current receivables tracker
SELECT sum(total_amount) AS cash_receivable_paise
FROM "CashReceivable" WHERE source = 'BILL';
```

Fill in:

| Source | Figure (₹) |
|---|---|
| A — `Σ Bill.outstandingAmountPaise` (receivable-status bills) | |
| B — first-principles recompute | |
| C — `Σ CashReceivable.totalAmount` (source = BILL) | |
| D — **the report Accounts actually uses today** (name it: __________) | |

A, B, C, D should agree (to the paise, or within a documented rounding tolerance). Any
mismatch is a finding and its size sets how urgent it is.

---

## Findings

**RESULT: gaps found — none block the epic, but 5 are worth filing.** Run 2026-09-11 against
the dev/staging DB (via `apps/server/_acct_r1_audit.ts`, a Prisma-Client version of the SQL
above — no `psql` on this machine; same checks). 41 bills, ~5 customers with any bill activity.

**Step 4 reconciliation — clean once correctly scoped.** A = B = C = **₹3,74,825** exactly,
after scoping to `status IN (FINALISED, SENT, PARTIALLY_PAID, PAID)` (see the correction note
on Step 4 above — the first run used "non-cancelled" and got ₹9,77,529, which was *this
audit's own* bug, not a data problem). Also verified by calling the real `buildAgeingReport()`
and `perBillOutstanding()` against every customer with bills — ageing grand total matches
Σ bill-wise outstanding exactly (`_acct_r_spotcheck.ts`).

**A real correctness bug was found and fixed during this audit** (not a data gap — a bug in
this epic's own R2 code, caught by spot-checking `buildCustomerStatement()` against real data):
a cancelled receipt's/bill's reversal voucher (`reverseJournal()` in `posting.service.ts`
always posts it as `voucherType: "JOURNAL"`, `reversesId` set to the original) was being read
back in as if it were an independent manual adjustment, re-adding the cancelled amount on top
of already correctly excluding the cancelled Bill/Receipt row. Fixed in
`customer-statement.service.ts` by adding `reversesId: null` to the adjustment-lines query.
Confirmed fixed: a customer whose statement was inflated by ₹1,05,210 (exactly one cancelled
receipt's amount) now matches its bill-wise outstanding exactly.

| ID | Query | Result | What it means | Blocks epic? |
|----|-------|--------|---------------|------|
| G1 | 3f | **10 of 10 CANCELLED bills** still carry `outstandingAmountPaise ≠ 0` | The bill-cancel route never zeroes this column. This epic is unaffected (R2/R4/R5 all filter `status` before ever reading the column), but anything else that reads `Bill.outstandingAmountPaise` directly without a status filter would over-count. | No — file as its own bug ticket. |
| G2 | 3h | **9 of 9** allocations with TDS > 0 have `tdsSection = NULL` | Matches the epic's own example gap ("TDS amount not stored anywhere") — the amount *is* stored, the section/certificate needed for TDS compliance reporting is not. Not used by this epic. | No |
| G3 | 3i | **15 of 15** FINALISED+ bills have `dueDate = NULL` | Every bill in this dataset ages from `billDate`, not a real due date (the fallback documented in R5). Today's Ageing tab is really "days since billed" for 100% of live bills — worth flagging to Accounts as a data-entry gap, not a code gap. | No — code has the documented fallback; the *usefulness* of Ageing depends on due dates actually being set going forward. |
| G4 | 3b | 6 of 15 receivable-status bills have `total ≠ paid + outstanding` | Semantic, not a bug: `Bill.paidAmountPaise` only accumulates cash applied (`amountAppliedPaise`); `outstandingAmountPaise` is reduced by the *full* settlement (cash + TDS + damage + rate-diff). So `paidAmountPaise` cannot be read as "how much of total is settled" — only as "cash collected." This epic doesn't use `paidAmountPaise` anywhere. | No — but worth a doc comment on the `Bill` model so a future reader doesn't assume otherwise. |
| G5 | 3g | **0** receipts span >1 bill in this dataset | Can't verify the "multi-bill split" AC from real data yet — no such receipt exists here. Not a gap, just untested territory; re-check once a real multi-bill receipt exists. | No |

**Clean:** 3a (0 drift), 3c (0 mismatches, after correcting the check's own formula — see note
on 3c above), 3d (0 live allocations against a cancelled bill), 3e (0 cancelled docs missing
metadata).

### Notes / context from Accounts

_(free text — what the team knows that the data alone doesn't say; not yet filled in)_

---

## Sign-off

- [x] Queries run against the dev/staging DB on 2026-09-11 (via Prisma script, `psql` unavailable)
- [x] Findings section completed
- [ ] G1–G5 filed as their own bug tickets and linked here
- [ ] Accounts reviewer: ______________  — agrees R2 can start (recommended: yes, given the
      reconciliation holds exactly and no gap found touches this epic's calculations)
