# LDC Phase L0 — Implementation Plan (for review, not yet implemented)

> **Status:** Awaiting approval. **No code, schema, migration or accounting logic has been
> changed.** This document is the plan only.
>
> **Date:** 2026-11-06 · **Branch:** `ERP-79/LDCBrokerPaymentAndDetentionSlabs`
> **Parents:** [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §6 Phase L0 ·
> [`ACCOUNTS_AUDIT_2026-11-06.md`](./ACCOUNTS_AUDIT_2026-11-06.md) D-5, D-14

## 0. Scope

| Task | Finding | What it does | Schema | Business decision needed |
|---|---|---|---|---|
| **L0-1** | audit **D-14** / plan **G6** | Detention claim becomes an explicit, nullable field; absent ⇒ pay the slab; explicit `0` ⇒ pay zero | **None** | **Q17** (only if pre-deploy check finds draft slips) |
| **L0-2** | audit **D-5** | A reversal voucher's `voucherDate` and `fyCode` stop contradicting each other | **None** | **Q16 — one-line Accounts confirmation required** |
| **L0-3** | plan **G2** (display half) | The approver sees the detention working and its warnings | **None** | None |

**Non-goals for L0, stated explicitly:** no blocking validation (that is L2, needs Q3); no
`paymentBy` filtering (L1, needs Q1); no advance posting — **Option A remains a proposal
only, Q5 is open** (L3); no deduction heads (L4); no DC acknowledgement stage (L5); no
historical data correction of any kind; no change to any other Accounts-module finding
(D-1, D-3, D-4, D-6…D-13 are all out of scope here).

**All three tasks are independent of one another** and can be reviewed, merged and reverted
separately. L0-2 is the only one that touches shared accounting code.

---

## 1. Two decisions needed before coding

Neither is assumed. Q1–Q15 from the workflow plan all remain open and untouched; these two
are new and specific to L0.

### Q16 — Reversal date and financial-year convention *(blocks L0-2)*

Today `reverseJournal` posts the contra with `voucherDate: new Date()` (today) but
`fyCode: original.fyCode` (the reversed voucher's year). **The two contradict each other —
that is the defect, independent of which date is chosen.** Three ways to make them agree:

| | Option | Effect |
|---|---|---|
| **1** | **Contra takes the original's `voucherDate` and `fyCode`** *(recommended)* | The reversal pair always nets to zero inside any date or FY window. A reversal can land in a prior, already-reported period |
| 2 | Contra dated today, `fyCode = fyCodeFor(today)` | Reported history never moves, but the pair splits across periods, so one half can be counted alone |
| 3 | Original's date when its FY is the current FY, else today | Option 1's correctness while the year is open, Option 2's immutability once it is not |

**Why Option 1 is recommended — with evidence from the codebase itself.** Three independent
call sites already defend against today's behaviour, and their comments say so verbatim:

- `salary-run.service.ts:146-151` — *"a reversed voucher and its reversal cancel out, but
  **the reversal is dated the day it was made** — so across the go-live date or a month end
  one half would be counted alone. Leave both out."*
- `driver-statement.service.ts:58-63` — the identical comment.
- `cash-planning.service.ts:405-410` `LIVE_VOUCHERS` — the same reasoning.

Those three modules exclude *both* halves to work around precisely D-5. Option 1 is what
they already wish were true, and it leaves their guards correct (excluding both still nets
zero), so **Option 1 has no regression surface on them.**

**The honest argument against Option 1:** it moves figures in a period that may already
have been reported to management or filed. Today nothing in the system can tell an open
period from a closed one — period close is audit **F-7**, not built — so Option 3 cannot be
implemented properly yet. My recommendation is Option 1 now, with a code comment marking
the upgrade to Option 3 when F-7 lands.

**This is an accounting-policy choice, not an engineering one. It needs Accounts' written
confirmation before L0-2 is coded.** If Accounts prefers Option 2, the implementation is
the same size — only the constant changes.

### Q17 — In-flight draft LDC slips *(blocks L0-1 only if any exist)*

L0-1 stops reading `detentionPaise` as the broker's claim. A `DRAFT` LDC slip created by
today's wizard stores the claim in `detentionPaise`; if it is resubmitted after the change
without being reopened in the new wizard, the claim is lost and **the slab is paid instead**
— an over-payment relative to the operator's intent, never an under-payment.

**Resolve by measurement, not by guessing:** run one read-only query before deploying —
`VendorPaymentSlip where type='LDC_BROKER' and status in ('DRAFT','PENDING_APPROVAL')`.

- **Zero rows → no risk, no shim, nothing to decide.** (Most likely: the LDC screen is new
  and uncommitted.)
- **Rows exist → Q17:** either (a) have operations reopen and re-save those drafts after
  deploy, or (b) build a short-lived compatibility shim that seeds the claim from the
  persisted `claimedDetentionPaise` column when the request omits the new field. I
  recommend (a) if the count is small — it needs no code and leaves no shim to remove.

---

## 2. L0-1 — Detention claim fallback

### 2.1 The defect, restated from source

`moneyPaise` ([vendor-payment.schema.ts:33](packages/validators/src/accounts/vendor-payment.schema.ts#L33)) is
`z.coerce.bigint().nonnegative().default(0n)`. Every `*Paise` field on a slip line uses it,
so all are optional and default to zero. The LDC branch
([vendor-payment.route.ts:281-285](apps/server/src/modules/vendor-payment/vendor-payment.route.ts#L281-L285))
then reads `line.detentionPaise` as the broker's claim and pays `min(claim, slab)`. An
omitted field therefore pays **zero detention**.

### 2.2 The design point that makes the fix clean

The slip-line schema documents itself as prefill-only:

> *"Client-supplied `*Paise` fields are prefill only: the server recalculates every total
> from these lines and the source documents before persisting."*
> — `vendor-payment.schema.ts:106-108`

and `buildServerLines` repeats it: TRANSPORTER overwrites every component from the source
document; HAMALI computes TDS itself. **LDC_BROKER is the only type that reads a client
`*Paise` value as meaningful input** — which is the inconsistency behind D-14.

So the fix is not to patch `detentionPaise`'s nullability. It is to **move the claim out of
the prefill block into its own explicit field**, restoring one contract across all three
slip types. The wizard's own comment already says this is the intent:

> *"Only the claimed detention is read from the client — the server caps it at the slab and
> re-derives freight, advance and TDS from the challan."* — `LDCSlipWizard.tsx:253-254`

### 2.3 Changes

**Validators** — `packages/validators/src/accounts/vendor-payment.schema.ts`
- Add to `vendorPaymentSlipLineInputSchema`:
  `claimedDetentionPaise: z.coerce.bigint().nonnegative().nullish()`.
  Deliberately **not** `moneyPaise` — the whole point is that absent must differ from zero.
- Leave `detentionPaise` exactly as it is (still used as prefill by TRANSPORTER, and part of
  the uniform column set). Add a comment that LDC no longer reads it.
- Export the inferred type as today.

**Server — new pure function** (testable without a database, matching the existing
`detention.engine.ts` pure / `detention.service.ts` impure split):

```ts
// apps/server/src/modules/detention/detention.engine.ts  (or claim.ts beside it)
/** The business pays the lower of the broker's filed claim and the slab.
 *  No claim filed (null/undefined) ⇒ the slab stands. A claim of 0 is a
 *  filed claim of nothing and is honoured as zero. */
export const resolveApprovedDetention = (
  claimPaise: bigint | null | undefined,
  slabPaise: bigint,
): { approvedPaise: bigint; claimFiled: boolean } =>
  claimPaise == null
    ? { approvedPaise: slabPaise, claimFiled: false }
    : { approvedPaise: claimPaise < slabPaise ? claimPaise : slabPaise, claimFiled: true };
```

**Server — the LDC branch** `vendor-payment.route.ts` ~`:255-305`
- Replace the inline `min` with `resolveApprovedDetention(line.claimedDetentionPaise, server.detentionPaise)`.
- `detentionPaise` on the built line = `approvedPaise`.
- `claimedDetentionPaise` stored: keep today's rule — record it only when a claim was filed
  **and** differs from the slab, else `null`. This preserves the existing column semantics
  and the detail page's "Broker claimed ₹X" badge. *(An explicit claim of 0 against a
  non-zero slab differs, so it is stored as `0n` and remains distinguishable — the
  requirement "explicitly set to 0 preserves zero" holds both in the amount paid and in the
  audit trail.)*
- No change to `recalcSlipTotals`, the accrual, or any other slip type.

**Web** — `apps/web/features/vendor-payment/LDCSlipWizard.tsx`
- `buildBody()` sends `claimedDetentionPaise: draft.claimed.trim() === "" ? null : String(rupeesToPaise(draft.claimed))`
  and `detentionPaise: "0"` (prefill, unread).
- Delete the client-side slab pre-fill in `claimedPaise()` — the server now owns the
  fallback. `approvedDetentionPaise()` keeps its preview role, with `claim ?? slab`.
- `apps/web/features/vendor-payment/vendor-payment.service.ts` — add the field to the
  create/update line type.

### 2.4 Properties

- **Schema/migration:** none.
- **Accounting entries:** unchanged in shape. Only the *detention amount* flowing into the
  existing accrual changes, and only in cases that are wrong today.
- **Permissions:** unchanged.
- **Backward compatibility:** a caller that omits the new field now gets **the slab**
  instead of zero — the failure mode of the transition is paying the correct amount. The
  one residual case is Q17.
- **Transaction safety:** unchanged; the change sits inside the existing
  `buildServerLines` path, already inside the caller's transaction.

---

## 3. L0-2 — Reversal date and financial year

### 3.1 Changes

**Server — new pure function** (again, unit-testable):

```ts
// apps/server/src/modules/ledger/reversal-date.ts
/** Which period a contra voucher belongs to. See Q16 in
 *  docs/LDC_PHASE_L0_IMPLEMENTATION_PLAN.md — confirmed by Accounts on <date>.
 *  Upgrade to the open/closed-period rule when period close (F-7) exists. */
export const reversalPeriodFor = (
  original: { voucherDate: Date; fyCode: string },
  _now: Date,
): { voucherDate: Date; fyCode: string } =>
  { voucherDate: original.voucherDate, fyCode: original.fyCode };   // Option 1
```

Keeping it a named function with `now` in the signature means Option 2 or 3 is a one-line
change inside one file, and the decision is documented at the point of truth.

**Server** — `posting.service.ts` `reverseJournal` ~`:1263-1272`
- Replace `voucherDate: new Date()` with the function's result; pass `fyCode` from it too.
- Leave everything else untouched: the swapped lines, the mirrored allocations, the
  `reversesId`, the `REV/<number>` voucher number, the `status: REVERSED` update, the
  at-most-once early return.

**Nothing else changes.** No call site needs editing — all 12 go through `reverseJournal`.

### 3.2 Blast radius — every reader checked

`reverseJournal` has **12 call sites across 11 modules**: billing cancel, receipt cancel,
cash-planning hold/reject/un-approve/delete, driver finance, salary run, job card, log slip,
service bill, spare inward, vendor payment cancel, opening-balance correction. All receive a
re-dated contra, so I traced every reader of `voucherDate` / `fyCode`:

| Reader | Includes reversals? | Effect of Option 1 |
|---|---|---|
| `salary-run.service.ts:146`, `driver-statement.service.ts:58` | **No** — `reversesId: null` | **None.** Their workaround comments describe D-5; they stay correct |
| `cash-planning.service.ts` `LIVE_VOUCHERS` (`:405`, `:69`, `:433`) | **No** — same guard | **None** |
| `customer-statement.service.ts` adjustment query | **No** — `reversesId: null` (the ₹1,05,210 fix) | **None** |
| `ledgerForAccount` / `ledgerForCreditor` / `ledgerForExpenseCategory` | **Yes** — `status in (POSTED, REVERSED)` | **Improves.** The contra sits beside its original instead of at today's date; the running balance stops showing a phantom swing |
| Day Book (`ledger.route.ts:445`) | Yes, date-filtered | **Improves** — this is the D-5 symptom being fixed |
| `opening-balance.service.ts:138` (`voucherDate < asOf` + `notOpeningBalance`) | Yes for non-opening vouchers | **Improves** — a reversal pair now nets to zero before the date rather than one half landing after it. Opening-balance vouchers and their own reversals are excluded by `notOpeningBalance` either way, so the correction flow is unaffected |
| `ageing.service.ts`, `perBillOutstanding` | Credit notes only, `voucherType: CREDIT_NOTE` | **None** |

**Result: no reader regresses; three improve.** That is the strongest available argument
that L0-2 is safe, and it is the reason this task belongs in L0 rather than later.

### 3.3 Properties

- **Schema/migration:** none. **Existing posted vouchers are not rewritten** — forward-only.
  Historical contras keep their today-dates; that is a data artefact, and correcting it is
  **not** in scope (it would be a historical accounting change, which requires evidence and
  approval we do not have).
- **Accounting entries:** the contra's lines and allocations are byte-identical; only its
  period labels change.
- **Permissions:** unchanged.
- **Observation, not a change:** `fyCodeFor` ([doc-number.ts:9-14](apps/server/src/modules/_shared/doc-number.ts#L9-L14))
  uses `getFullYear()`/`getMonth()` — **server-local time**, while the detention engine
  deliberately pins IST. On a UTC-hosted server, a voucher dated 31 March 20:00 IST resolves
  to the wrong FY. Out of scope for L0; worth its own ticket.

---

## 4. L0-3 — Detention working and warnings for the approver

### 4.1 What exists and what is missing

`quoteChallanDetention` already returns the full diagnostic set: `window`
(`finalReportingAt`, `finalUnloadingAt`, `detentionDays`), `slab`, `alternatives`,
`charge.lines` (the per-tier breakdown), `lrNumbers`, `unresolvedLrNumbers`, `warnings[]`.
The eligible-source DTO already carries most of it — `EligibleLDCSource` has
`detentionWarnings`, `reportingAt`, `unloadingAt`, `detentionDays`, `slabName`
([vendor-payment.service.ts:40-52](apps/web/features/vendor-payment/vendor-payment.service.ts#L40-L52)) — and the
wizard renders it well at `LDCSlipWizard.tsx:491-540`.

**None of it survives onto the slip.** `VendorPaymentSlipDetailPage.tsx:357-389` shows
amount, days, slab name and the broker's claim; when no slab matched, `detentionSlabName` is
`null` and the cell reads a bare **₹0**. `DetentionBreakdownDialog` is imported only by the
wizard (`:699`). The diagnostics must remain available on the saved slip so whoever makes
the authorising decision sees them, including when the creator is also the approver.

### 4.2 Design: a separate lazy endpoint, not a fatter detail payload

Two options were considered:

- *(a)* Persist the warnings on the line (new columns). **Rejected for L0** — it needs a
  migration, and the plan already schedules that as the optional 3(b) under G2. L0 is
  explicitly no-schema.
- *(b)* Recompute on read. **Chosen**, with one refinement: put it behind its **own
  endpoint** rather than inflating `GET /slips/:id`. A slip may carry up to 200 lines
  (schema max), and one quote per line is one challan read each — acceptable on a
  deliberate click, not on every detail load. This also keeps the existing detail response
  **byte-identical**, so nothing downstream can break.

**Is a recompute trustworthy?** The inputs are locked: `reportDate` cannot change once the
challan is claimed (`lr-delivery.route.ts:150-160`), the challan itself is `ISSUED` and
immutable, and LR dates feed through the same guard. The **slab** can still be edited or
soft-deleted, so the recomputed amount can legitimately differ from the stored one. That is
information, not a problem:

> **The stored `detentionPaise` remains the single authoritative figure everywhere.** The
> recompute is shown only as diagnostics, and when the two disagree the UI says so
> explicitly ("slab has changed since this slip was made"). No amount is ever silently
> replaced by a recomputed one.

### 4.3 Changes

**Server**
- New `apps/server/src/modules/vendor-payment/detention-diagnostics.ts`:
  `loadSlipDetentionDiagnostics(client, slipId)` → for each active `DELIVERY_CHALLAN` line,
  call `quoteChallanDetention(line.sourceId)` (errors caught per line, as
  `findEligibleLDCSources` already does with `.catch(() => null)`), and return per line:
  `{ sourceId, storedDetentionPaise, recomputedDetentionPaise, drifts, slabName, reportingAt, unloadingAt, detentionDays, lrNumbers, unresolvedLrNumbers, warnings, chargeLines }`.
- New route `GET /vendor-payment/slips/:id/detention`, gated `can(PERMS.ACCOUNTS.PAYMENT.VIEW)`
  with `assertBranchAccess(req, slip.branchId)` — identical gating to the detail route.
  Returns `[]` for non-LDC slips.
- `GET /slips/:id` and `loadSlipDetail` are **not touched.**

**Web**
- `vendor-payment.service.ts` — `fetchSlipDetention(slipId)` + its row type, reusing the
  `EligibleLDCSource` field names so the two surfaces stay consistent.
- `VendorPaymentSlipDetailPage.tsx` — for an LDC slip, query the new endpoint; render a
  warning badge on each line's detention cell; replace a bare ₹0 with the reason
  ("No slab matched" / "No unloading date yet"); add a "View working" affordance opening
  `DetentionBreakdownDialog`; show a drift note when `drifts` is true.
- `DetentionBreakdownDialog.tsx` — generalise its props so it accepts a diagnostics row as
  well as the wizard's draft shape. **No behaviour change for the wizard.**
- `VendorPaymentApprovalPage.tsx` — a count badge on an LDC slip awaiting approval
  ("2 of 5 challans have detention warnings"), so the checker sees it before opening.

### 4.4 Properties

- **Schema/migration:** none. **API:** additive, one new endpoint; no existing response
  changes shape. **Permissions:** reuses `accounts.payment.view`. **Accounting:** none —
  this task cannot change a number.
- **Display only.** No submit is blocked and no amount is altered; blocking is L2 and needs
  Q3.

---

## 5. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **L0-2 changes behaviour for 11 modules through one shared function.** | Medium | Every reader traced in §3.2 — none regresses, three improve. Review the table before approving. The change is 3 lines behind a named function, trivially revertible |
| R2 | **Option 1 lets a reversal land in an already-reported period.** | Medium | This is the substance of **Q16** and needs Accounts' answer. If they say no, Option 2 is the same size of change |
| R3 | **L0-1 loses the claim on a pre-existing draft** (Q17). | Low | Measure first with one read-only query. Failure mode is paying the slab (correct amount), never zero |
| R4 | **L0-3's recompute disagrees with the stored amount** and confuses the approver. | Low | Stored figure stays authoritative; drift is labelled explicitly rather than hidden or silently applied |
| R5 | **N+1 reads** in L0-3 (one challan quote per line). | Low | Own lazy endpoint, not the detail payload; slab set already Redis-cached for 5 minutes; mirrors the accepted pattern in `findEligibleLDCSources` |
| R6 | **No integration-test harness exists**, so none of this can be proven end to end by automated test. | Medium | §7: push the rules into pure functions that *can* be tested, plus a written manual verification script. Honest statement — the harness itself is audit **P2-1** and out of L0's scope |
| R7 | Scope creep into adjacent findings while in these files. | Low | Non-goals listed in §0. L0 touches no other Accounts finding |

**Explicitly not a risk being taken:** no historical accounting entry is created or
modified, no pending business decision is assumed, and transporter advance **Option A stays
a proposal under Q5** — L0 does not touch advance posting at all.

---

## 6. Dependencies and order

```
L0-1  ── needs: Q17 only if drafts exist ── independent
L0-2  ── needs: Q16 (Accounts)           ── independent, but gates L3/L4 later
L0-3  ── needs: nothing                  ── independent
```

Recommended merge order, as three separate reviews:

1. **L0-3 first.** Zero decisions, zero accounting impact, cannot change a number — and it
   makes the detention figures visible, which is exactly what you want in place *before*
   L0-1 starts changing them.
2. **L0-1 second**, after the Q17 query. L0-3 then shows the effect of the fix.
3. **L0-2 last**, once Q16 is answered.

L0-2 must precede L3 and L4 (both add reversible postings), but nothing inside L0 depends on
it.

---

## 7. Test strategy

### 7.1 What can be tested automatically today

The suite is 246 pure-function tests (`vitest run`, verified passing); there is **no
database harness**. So each rule goes into a pure function and is tested there — the same
split the codebase already uses for detention (`detention.engine.ts` tested;
`detention.service.ts` not).

**New: `resolveApprovedDetention` (L0-1)** — `detention/__tests__/detention.engine.test.ts`

| Case | Claim | Slab | Expect |
|---|---|---|---|
| No claim filed | `undefined` | 5,000 | 5,000, `claimFiled: false` — **the D-14 regression guard** |
| Explicitly null | `null` | 5,000 | 5,000, `claimFiled: false` |
| Claim of zero | `0n` | 5,000 | **0**, `claimFiled: true` — your "preserve zero" requirement |
| Lower claim | 2,000 | 5,000 | 2,000, `claimFiled: true` |
| Higher claim | 9,000 | 5,000 | 5,000 (clamped), `claimFiled: true` |
| Equal claim | 5,000 | 5,000 | 5,000, `claimFiled: true` |
| Zero slab, claim filed | 3,000 | 0 | 0 |

**New: `reversalPeriodFor` (L0-2)** — `ledger/__tests__/reversal-date.test.ts`

| Case | Expect |
|---|---|
| Original in the current FY | contra takes the original's date and `fyCode` |
| Original in a prior FY | same — and the test asserts `fyCodeFor(result.voucherDate) === result.fyCode`, i.e. **the two can never contradict again** |
| Across 31 March / 1 April | the invariant holds |

That last invariant is the real test: whatever Option is chosen, `fyCode` must always be the
FY *of the returned date*. It encodes the fix rather than the choice.

**Validator tests (L0-1)** — `claimedDetentionPaise` accepts absent / `null` / `0` /
positive, rejects negative, and `detentionPaise`'s existing behaviour is unchanged for
TRANSPORTER and HAMALI.

**Regression:** full `pnpm --filter @skerp/server test` and `pnpm check-types` must stay
green (246 → ~260 tests). TypeScript strict throughout; no `any`.

### 7.2 What cannot be tested automatically, and the manual script instead

Posting, persistence and the UI need the running app. Written verification steps, to be
performed on dev/staging before each merge:

**L0-1** — build an LDC slip against a challan whose slab prices detention above zero.
(a) Leave the claim blank → the line's detention equals the slab; approve → the accrual's
`DETENTION_EXPENSE` debit equals it. (b) Enter a lower claim → the claim is paid and
"Broker claimed" shows on the detail. (c) Enter `0` → zero is paid and recorded as a filed
claim. (d) `curl` the create endpoint **omitting `claimedDetentionPaise`** → the slab is
paid. (d) is the D-14 proof and the one that fails on today's code.

**L0-2** — cancel a FINALISED bill from a prior FY; confirm the contra carries the
original's date and `fyCode`, that the Day Book shows the pair on the same date, that the
Bank/Cash and Creditor ledgers no longer swing at today's date, and that the driver
statement and Cash Planning day view are **unchanged** (they exclude both halves).

**L0-3** — a challan with no unloading date, and one whose broker has no slab: both show the
reason instead of a bare ₹0 on the slip detail, the breakdown dialog opens, the approval
queue shows the warning count. Edit a slab after making a slip → the detail flags drift and
the **stored** amount is still the one displayed and paid.

### 7.3 Reconciliation

No new reconcile identity is introduced by L0. The per-slip identity
(`Σ NEW_REF − Σ AGAINST_REF = netPayablePaise − paidPaise`, audit §H-3) must still hold
after each change — checkable with an ad-hoc read-only script in the style of
`prisma/ldc-inventory.ts`. Building it properly is audit **P0-4**, not L0.

**Optional read-only diagnostic (recommended alongside L0-1):** extend `ldc-inventory.ts`
to report existing LDC lines whose `detentionPaise` is 0 while their slab would price it
above zero — the live blast radius of D-14, and the input to **Q14**. It writes nothing.

---

## 8. Rollback

Each task is revertible on its own:

- **L0-1** — revert the validator field, the route branch and the wizard. Already-created
  slips are unaffected (stored amounts are not recomputed).
- **L0-2** — revert the 3-line change in `reverseJournal`. Contras posted meanwhile keep
  their original-date stamps; those are *more* correct, and no cleanup is required either
  way.
- **L0-3** — delete the endpoint and the UI usage. Nothing else reads it.

No migration means no down-migration, and no posted voucher is rewritten by any of the
three.

---

## 9. Definition of done

- [ ] Q16 answered in writing by Accounts; the answer recorded in `reversal-date.ts` with
      its date, and in `LDC_WORKFLOW_PLAN.md`
- [ ] Q17 resolved by the pre-deploy count query (or shown to be zero)
- [ ] ~14 new pure-function tests; `pnpm --filter @skerp/server test` green
- [ ] `pnpm check-types` 9/9 green; no `any`
- [ ] Manual script in §7.2 executed on dev/staging and recorded
- [ ] `ACCOUNTS_AUDIT_2026-11-06.md` D-5 and D-14 marked resolved, with the commit
- [ ] `LDC_WORKFLOW_PLAN.md` §6 L0 rows marked done; G6 and §4.5 cross-references updated
- [ ] No change to any file outside the lists in §2–§4

---

## 10. Files touched (complete list)

**L0-1** (4 files)
`packages/validators/src/accounts/vendor-payment.schema.ts` ·
`apps/server/src/modules/detention/detention.engine.ts` ·
`apps/server/src/modules/vendor-payment/vendor-payment.route.ts` ·
`apps/web/features/vendor-payment/LDCSlipWizard.tsx` ·
`apps/web/features/vendor-payment/vendor-payment.service.ts` *(type only)*
+ `apps/server/src/modules/detention/__tests__/detention.engine.test.ts`

**L0-2** (2 files)
`apps/server/src/modules/ledger/reversal-date.ts` *(new)* ·
`apps/server/src/modules/ledger/posting.service.ts`
+ `apps/server/src/modules/ledger/__tests__/reversal-date.test.ts` *(new)*

**L0-3** (5 files)
`apps/server/src/modules/vendor-payment/detention-diagnostics.ts` *(new)* ·
`apps/server/src/modules/vendor-payment/vendor-payment.route.ts` *(one new route)* ·
`apps/web/features/vendor-payment/vendor-payment.service.ts` ·
`apps/web/features/vendor-payment/VendorPaymentSlipDetailPage.tsx` ·
`apps/web/features/vendor-payment/DetentionBreakdownDialog.tsx` *(props widened)* ·
`apps/web/features/vendor-payment/VendorPaymentApprovalPage.tsx`

**No Prisma schema change. No migration. No seed change. No permission change.**
