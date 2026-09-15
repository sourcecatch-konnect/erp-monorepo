# ACCT-R1 gaps — ready-to-file tickets

Drafted from the findings in [`ACCT-R1-audit.md`](./ACCT-R1-audit.md#findings) (audit run
2026-09-11). None of these block EPIC ACCT-R itself — R2/R4/R5 already filter around them —
but the epic's own AC says gaps must be "filed as their own bug tickets and linked here," not
silently worked around. Paste each block below into whatever tracker you use (Jira/Linear/etc.)
as its own ticket, then replace the `[ ]` in `ACCT-R1-audit.md`'s sign-off with links to the
filed tickets.

---

## G1 — Cancelling a bill doesn't zero `outstandingAmountPaise`

**Type:** Bug · **Priority:** Medium · **Found by:** ACCT-R1 audit, query 3f (2026-09-11)

**Description:** 10 of 10 `CANCELLED` bills in the dev/staging DB still carry a nonzero
`outstandingAmountPaise`. The bill-cancel route/service never zeroes this denormalised column
when it flips status to `CANCELLED`.

**Impact:** EPIC ACCT-R is unaffected — `buildCustomerStatement`, `perBillOutstanding`, and
`buildAgeingReport` all filter `status` before ever reading this column. But *any other* code
that reads `Bill.outstandingAmountPaise` directly without a status guard will over-count
receivables by the cancelled bill's full amount.

**Suggested fix:** In the bill-cancellation code path, set `outstandingAmountPaise` (and
reconcile `paidAmountPaise`) to `0` alongside `cancelledAt` / `cancelledBy`.

**Acceptance criteria:** After cancelling a bill, `outstandingAmountPaise = 0`. Re-run
`ACCT-R1-audit.md` §3f — expect 0 rows.

---

## G2 — TDS section / certificate number not captured on `ReceiptAllocation`

**Type:** Bug / data gap · **Priority:** Low–Medium (compliance) · **Found by:** ACCT-R1 audit,
query 3h

**Description:** 9 of 9 allocations with `tdsAmountPaise > 0` have `tdsSection = NULL`. The
deducted amount is stored; the section and certificate number needed for TDS compliance
reporting are not.

**Impact:** Can't currently produce a TDS compliance report (e.g. 26Q-style) from this data.
Not used anywhere in EPIC ACCT-R.

**Suggested fix:** Require `tdsSection` (and cert number) in the receipt-allocation
form/schema whenever `tdsAmountPaise > 0`.

**Acceptance criteria:** New allocations with TDS can't be saved without a section. Decide
separately whether to backfill the 9 existing rows.

---

## G3 — No bill has a real due date; Ageing falls back to bill date for 100% of live bills

**Type:** Data gap / process · **Priority:** Medium (affects usefulness of the new Ageing tab)
· **Found by:** ACCT-R1 audit, query 3i

**Description:** 15 of 15 `FINALISED`+ bills in dev/staging have `dueDate = NULL`. ACCT-R5's
Ageing tab has a documented fallback (`effectiveDue = dueDate ?? billDate`), so it doesn't
break — but every bill currently ages from its bill date, not a real payment-terms due date.

**Impact:** Ageing buckets today are really "days since billed," not "days since due," for
every live bill — less useful to Accounts than the epic intends once real due dates exist.

**Suggested fix:** Either (a) start capturing a due date at bill finalisation (e.g. from
customer payment terms), or (b) confirm with Accounts that bill-date-as-due is intentional.

**Acceptance criteria:** A decision is recorded; if (a), new bills get a populated `dueDate`
going forward.

---

## G4 — `Bill.paidAmountPaise` ≠ `total − outstanding` whenever TDS/damage/rate-diff apply

**Type:** Documentation / clarification, not a functional bug · **Priority:** Low · **Found
by:** ACCT-R1 audit, query 3b

**Description:** 6 of 15 receivable-status bills have `total ≠ paid + outstanding`. This is
semantic, not a defect: `paidAmountPaise` only accumulates cash actually applied
(`amountAppliedPaise`), while `outstandingAmountPaise` is reduced by the *full* settlement
(cash + TDS + damage + rate-diff). So `paidAmountPaise` means "cash collected," not "how much
of total is settled."

**Impact:** None on EPIC ACCT-R (doesn't use `paidAmountPaise`). Risk is a future developer
assuming `paid + outstanding == total` and writing a broken reconciliation against it.

**Suggested fix:** Add a doc-comment on `Bill.paidAmountPaise` in `schema.prisma` clarifying
the semantics.

**Acceptance criteria:** Comment added; no behavior change required.

---

## G5 — No real multi-bill receipt exists yet to verify the "splits correctly" AC on live data

**Type:** Test gap · **Priority:** Low · **Found by:** ACCT-R1 audit, query 3g

**Description:** 0 receipts in the dev/staging dataset span more than one bill, so the epic's
AC ("a receipt that pays two bills correctly splits its `ReceiptAllocation` rows so both bills
show as reduced") could only be verified against synthetic fixtures
(`customer-statement.test.ts`, `reconciliation.test.ts`), not real data.

**Impact:** Not a known defect — untested territory on production-shaped data.

**Suggested fix:** None due now. Re-run `ACCT-R1-audit.md` §3g once a genuine multi-bill
receipt exists in real data and confirm both bills reduce correctly.

**Acceptance criteria:** N/A — revisit opportunistically.
