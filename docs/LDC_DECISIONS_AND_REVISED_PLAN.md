# LDC — Confirmed Decisions, Gap Analysis & Revised Plan

> **Status:** For review. **No code has been modified since this was written.** L0 remains
> as shipped (see §2.1 — one part of it must now change).
>
> **Date:** 2026-11-06 · **Branch:** `ERP-79/LDCBrokerPaymentAndDetentionSlabs`
> **Supersedes** the phase order in [`LDC_WORKFLOW_PLAN.md`](./LDC_WORKFLOW_PLAN.md) §6.
> **Companions:** [`ERP_FLOW_IMPLEMENTATION_STATUS.md`](./ERP_FLOW_IMPLEMENTATION_STATUS.md) ·
> [`ACCOUNTS_AUDIT_2026-11-06.md`](./ACCOUNTS_AUDIT_2026-11-06.md)

---

## 1. The five decisions, recorded

| # | Decision | Status |
|---|---|---|
| **Q1** | **Company is the only responsible party** for LDC broker payments. Supported payment modes: Cash, Bank Transfer, Cheque. **Payment responsibility is separate from payment mode.** | ✅ Confirmed |
| **Q8** | **Both DC Acknowledgement and DC Approval are mandatory** before detention calculation and before payment. | ✅ Confirmed |
| **Q16** | Reversal voucher uses the **current date**. Original voucher unchanged, reference kept for audit. Respect FY and closed-period rules. | ✅ Confirmed |
| **Q18** | **Approved DC Acknowledgement dates are the source of truth** for detention. Unapproved dates must not drive the final calculation. | ✅ Confirmed |
| **Q19** | ~~Slab-based customer detention~~ → **SUPERSEDED 2026-11-06: customer detention needs no slab and no calculation.** It stays hand-entered as `LRAcknowledgement.detentionAmount`, taxable, as today. Slabs are **broker-only** — already built. **Phase L6 cancelled.** | ✅ Final |
| **Q9** | DC Approval does **not** post an accounting entry — it produces amounts only; the slip accrual stays the single posting point. | ✅ Confirmed |
| **Q10** | **Grandfather** existing `ISSUED` challans; enforce ack + approval for new challans only. | ✅ Confirmed |
| **Q20** | Existing `paymentBy = CASH` challans go to **manual review** — never auto-paid, never auto-excluded. | ✅ Confirmed |
| **Q21** | Customer detention stays the **manually entered** `LRAcknowledgement.detentionAmount`. | ✅ Confirmed |
| **Q22** | Its tax treatment **stays as it is now** (`isTaxable: true`). | ✅ Confirmed |
| **Q24** | **No Broker master.** A last-mile truck is hired from the **Transport master**, and that party is the broker. Existing `transportId` wiring is correct and must not change. | ✅ Confirmed |
| **Q5** | **Option A** — post the advance when the cash is handed over: `Dr TRANSPORTER_ADVANCE_RECOVERY / Cr <Cash-Bank>`; the existing accrual's credit then clears the asset to nil. Chosen because it leaves the slip, `netPayablePaise` and every screen unchanged. | ✅ Confirmed — **NOT YET IMPLEMENTED.** Blocked on Q6 (funding-source capture) and Q7 (historical correction). **No advance posting code and no historical entries may be written until Accounts confirms both.** |

Still open and **not** assumed anywhere below: **Q3, Q4, Q5, Q6, Q7, Q9, Q10, Q11, Q13,
Q14, Q15, Q17**, plus three new ones raised in §6.

---

## 2. Gap analysis — decision by decision

### 2.1 Q16 — reversal date · ⚠️ **This reverses what I implemented**

**I must flag this plainly.** In the last session I implemented `reversalPeriodFor` as
**Option 1** (contra takes the *original's* date and FY), clearly marked PROVISIONAL
pending this decision. **Your answer is Option 2.** The provisional choice was the wrong
one, and it has to be changed before this branch merges.

| | Implemented now | Required by Q16 |
|---|---|---|
| `voucherDate` | `original.voucherDate` | **`now`** |
| `fyCode` | `original.fyCode` | **`fyCodeFor(now)`** |

**What is already correct and stays:** the original voucher is untouched apart from its
status flipping to `REVERSED`; `reversesId` holds the audit reference; `reversesId` is
`@unique` so a voucher can be reversed at most once; allocations mirror symmetrically. The
D-5 defect — `voucherDate` and `fyCode` contradicting each other — is fixed by Option 2
just as it was by Option 1, only in the other direction.

**Change required:** `apps/server/src/modules/ledger/reversal-date.ts`, one function body.
Three of the five tests in `reversal-date.test.ts` flip. **The key invariant test —
`fyCodeFor(result.voucherDate) === result.fyCode` — passes unchanged**, which is exactly
why it was written that way.

**Consequence you should know about.** Option 2 keeps the behaviour that three modules
already defend against in their own comments:

> *"a reversed voucher and its reversal cancel out, but **the reversal is dated the day it
> was made** — so across the go-live date or a month end one half would be counted alone.
> Leave both out."*
> — `salary-run.service.ts:146`, `driver-statement.service.ts:58`, `cash-planning.service.ts:405`

Under Option 2 those three workarounds are **permanently necessary and must not be
removed.** Any new report that sums `JournalLine` across a date window must apply the same
`reversesId: null` + `status: POSTED` filter, or a reversal pair straddling a month end
will count one half alone. **This is now a standing rule for the Trial Balance (F-1) and
the reconcile job (P0-4)** — both are still to be built, and both must adopt it.

**"Respect closed-period rules":** there is no period-close feature — it is audit **F-7**
and is not built. With nothing closable, "current date" is always valid today. The clause
becomes live when F-7 lands, at which point `reversalPeriodFor` needs the open/closed test
added. I have left `now` in the function signature precisely so this is a one-file change.

---

### 2.2 Q1 — payment responsibility · **mostly already satisfied**

**Already implemented — no work needed:**

- **Payment modes.** `enum PaymentMode { CASH BANK UPI CHEQUE }` already exists, and
  `VendorPaymentDisbursement.mode` is typed to it (`schema.prisma:3437`). Cash, Bank and
  Cheque are already supported at the point where money actually moves. **No new field, no
  migration.** (UPI also exists — harmless; flag if it should be blocked for LDC.)
- **Responsibility is already a separate field** from mode: `DeliveryChallan.paymentBy`.
- **`paymentBy` is already surfaced** on the eligible-source API and DTO (done last
  session, display only).

**Missing:**

| Gap | Work |
|---|---|
| No filter on `paymentBy` | `findEligibleLDCSources` must restrict to `COMPANY`; `reconcileLDCLines` must reject anything else posted directly |
| No review surface for the rest | `CLIENT` / `TRANSPORTER` / `CASH` / `NULL` need to be visible and excluded, not silently dropped |

**The unresolved part of Q1 — the `CASH` value.** Your instruction is "keep responsibility
separate from mode", and `DeliveryChallanPaymentBy = COMPANY | CLIENT | TRANSPORTER |
CASH` mixes the two: the first three answer *who bears the cost*, `CASH` answers *how it
was paid*. Going forward the rule is clean (Company = payable; record the mode on the
disbursement, where it already lives). **Existing `CASH` rows are the problem** — they
cannot be reclassified automatically, because `CASH` may have meant either "the company
paid, in cash, already" (**not** payable — re-paying it is a double payment) or "the
company bears it, to be settled in cash" (payable). → **Q20, §6.**

**Design I propose (safe under either answer):** a default-deny allowlist.

```ts
const PAYABLE_PAYMENT_BY = ["COMPANY"] as const;
// CLIENT · TRANSPORTER · CASH · null · any future value → review queue, never payable
```

An over-restrictive list strands challans visibly where someone notices; an over-permissive
one pays money we may not owe and nobody notices.

---

### 2.3 Q8 — Ack + Approval mandatory · **nothing exists, and it is now a blocker**

Verified: `grep "model DCAck|model DeliveryChallanAck|DCApproval" schema.prisma` → **zero
results**. `DeliveryChallanStatus` is only `DRAFT | ISSUED | CANCELLED`.

Q8 changes this from the largest *optional* item to a **prerequisite for the whole chain**:
nothing can be detention-calculated or paid until a challan is approved. Combined with
Q18, it also changes **where detention gets its dates**. The practical effect is a
resequencing — see §3.

**To build:** two acknowledgement rows per challan (Supervisor ‖ Broker), per-LR ack items
(shortage derived), one approval row selecting the trusted version, a side-by-side mismatch
UI, three new permissions, and an eligibility switch from `ISSUED` to `APPROVED`.

---

### 2.4 Q18 — approved ack dates drive detention · **engine input changes**

**Today** (`detention.service.ts` → `detention.engine.ts`):

```
FinalReporting = earliest(challan.loadingAt, challan.reportDate, every LR's delivery.reportedAt)
FinalUnloading = latest(every LR's delivery.unloadingAt)
```

**Required by Q18:** those dates come from the **approved acknowledgement**. The planned
`DCAcknowledgement` carries `reportingDate`, `deliveryDate` and `collectionDate` precisely
for this.

**What this means in code — and what does *not* change:**

- `detention.engine.ts` is **pure and unaffected**. `resolveDetentionWindow` already takes
  dates as plain values; it does not care where they came from. **No change to the slab
  maths, the tiers, the free days, the IST handling or any of its 29 tests.**
- `detention.service.ts` `loadChallanContext` is where the swap happens: read the approved
  ack's dates instead of walking the four-table LR chain.
- The LR-derived dates stay useful as the **prefill** for the acknowledgement form, so the
  supervisor confirms rather than retypes. I propose keeping that; it is also what makes
  the two-ack mismatch meaningful.
- **"Do not use unapproved dates for the final calculation"** falls out naturally once
  eligibility requires an approval: an unapproved challan never reaches a slip. Any quote
  shown before approval must be labelled provisional.

---

### 2.5 Q19 — slab-based customer detention · **a dormant seam already exists**

This is the most pleasant finding in the analysis.

**What exists today.** Customer detention is hand-entered at POD as
`LRAcknowledgement.detentionAmount`, and `evaluateBillingForLR`
(`billing.service.ts:360-370`) already turns it into:

```ts
{ type: "DETENTION", effect: "ADDITION", source: "ACKNOWLEDGEMENT",
  sourceReferenceId: lr.acknowledgement.id, isTaxable: true }
```

which flows into the bill and posts to `DETENTION_INCOME`. **The whole billing and
accounting path for customer detention is already built and correct.**

**The seam:** `enum LRChargeSource` already contains **`DETENTION_CALCULATION`** — and
`grep` across the entire repo shows **nothing writes it.** It was designed for exactly this
feature and left dormant.

So Q19 is: compute a customer figure from a customer slab, and emit the same `LRCharge`
with `source: DETENTION_CALCULATION`. **No change to billing, GST or the ledger.**

**Separate slabs.** `DetentionSlab` today *requires* `transportId` (a broker), and carries
an unused `customerId` column that `applies()` deliberately ignores. Two options:

| | Option | Assessment |
|---|---|---|
| **A** | Add `appliesTo: BROKER \| CUSTOMER` to `DetentionSlab`; require `transportId` for BROKER and `customerId` for CUSTOMER | **Recommended.** Reuses the engine, the bands, the effective-dating, the cache and the master UI. "Separate" is enforced by the discriminator — a customer slab can never match a broker quote |
| B | A second model `CustomerDetentionSlab` | True physical separation, but duplicates the entire slab master, engine wiring and UI for no behavioural gain |

**⚠️ Conflict to resolve — double billing.** If slab-computed customer detention is emitted
while `LRAcknowledgement.detentionAmount` is also set, `evaluateBillingForLR` produces
**two** `DETENTION` charges for the same LR (its stale-charge cleanup is keyed on
`type|source|sourceReferenceId`, and the two sources differ) — **the customer is billed
twice.** This must be settled before building: → **Q21, §6.**

`CONTEXT.md:203` already anticipated the tension: *"Two detention fields on Ack …
`observedDetentionDays` (what destination ops eyeballed) AND `DetentionCalc.detentionDays`
(formal calc from dates). They should match; mismatches flag for accounts to investigate."*

---

## 3. Revised phase order

Q8 and Q18 force a resequencing. **The old order built L2 and L4 on top of a flow that
Q8/Q18 replace** — the detention warnings L2 blocks on come from LR-derived dates, and the
deduction heads L4 adds originate at the approval screen. Building them first means
reworking them.

```
OLD:  L0 → L1 → L2 → L3 → L4 → L5
NEW:  L0 → L1 → L5 → L2 → L4 → L3 → L6(new)
                ↑ moved earlier: it is now a prerequisite, not an enhancement
```

| Phase | Scope | Blocked by | Why here |
|---|---|---|---|
| **L0** | ✅ **Done** — claim fallback, reversal date, approver diagnostics | — | Shipped; **L0-2 needs the Q16 correction** |
| **L0.1** | **Q16 correction** — flip `reversalPeriodFor` to current date; flip 3 tests | — | Small, and must land before merge |
| **L1** | `paymentBy = COMPANY` filter + review queue | Q20 (historical `CASH` only) | Unblocked for new data; the double-payment risk |
| **L5** | DC Acknowledgement ×2 + DC Approval | Q9, Q10 | **Now a prerequisite.** Everything below depends on its dates and heads |
| **L2** | Detention blocking validation | Q3, Q4 | Rules change once dates come from an approved ack |
| **L4** | Deduction heads (shortage, parking, other, labour) + paid-slip correction path | Q11, Q15 | Heads originate on the approval screen built in L5 |
| **L3** | Transporter advance accounting | **Q5, Q6, Q7** | Independent of the above; can run in parallel whenever Accounts answers |
| **L6** | **New** — slab-based customer detention (Q19) | Q21, Q22 | Independent of the broker chain; could run in parallel with L5 |

**Parallelisable:** L3 and L6 touch different code from L1/L5/L2/L4 and can proceed
independently once their questions are answered.

---

## 4. What each remaining phase requires

### L0.1 — Q16 correction
- **Files:** `ledger/reversal-date.ts`, `ledger/__tests__/reversal-date.test.ts`
- **Schema / API / UI:** none · **Accounting:** the contra's lines and allocations are
  unchanged; only its date and FY label move
- **Tests:** 3 flip, the invariant test stays; full suite must stay green
- **Note:** add a comment recording that the three existing `reversesId: null` workarounds
  are now permanent by decision, not by accident

### L1 — `paymentBy` enforcement
- **Files:** `calculators/ldc-broker.ts` (where-clause + `reconcileLDCLines` guard),
  `vendor-payment.route.ts`, `LDCSlipWizard.tsx`
- **Schema:** none now. *Later, optional:* make `paymentBy` non-null at issue (needs Q20
  resolved first)
- **API:** a review/`needsReview` variant or count for non-payable and NULL challans
- **UI:** `paymentBy` column (data already flowing), review section, non-payable
  unselectable. **Reuses the existing Payment By dropdown — no second dropdown**
- **Accounting:** none — this is a filter
- **Tests:** eligibility includes `COMPANY` only; each other value and NULL excluded;
  `reconcileLDCLines` rejects a non-payable id posted directly

### L5 — DC Acknowledgement + Approval
- **Files:** new `modules/delivery-challan-ack/`, new
  `packages/validators/src/delivery-challan/ack.schema.ts`, new
  `features/delivery-challan-ack/`, plus `calculators/ldc-broker.ts` (eligibility) and
  `detention.service.ts` (date source, per Q18)
- **Schema / migration:** `DeliveryChallanAcknowledgement` (`@@unique([challanId, ackType])`),
  `DeliveryChallanAckItem`, `DeliveryChallanApproval` (`@@unique([challanId])`). Additive —
  no existing table altered. **Proposed: no new `DeliveryChallanStatus` values**, so every
  existing `ISSUED`-based guard keeps working untouched
- **API:** ack create/update per type · both-acks read with computed mismatches · approval
  create · approval revoke (only while unclaimed)
- **UI:** side-by-side mismatch comparison — *the layout is the control*; approval screen
  with per-head amounts; POD attachment
- **Permissions:** `delivery_challan.ack.supervisor`, `delivery_challan.ack.broker`,
  `delivery_challan.approve` — the supervisor ack and the approval **must not** share a
  permission, or the separation of duties collapses
- **Accounting:** **none, proposed** — approval produces *amounts*, the existing slip
  accrual stays the single posting point (**Q9**)
- **Migration / historical:** existing `ISSUED` challans have no acks → **Q10**
- **Tests:** two acks coexist, a third rejected; approval requires ≥1 ack; approved dates
  reach the detention window; claimed challan's approval cannot be revoked; mismatch calc

### L2 — Detention blocking validation
As previously specified, re-expressed against approved-ack dates. **Q3** (which warnings
block) and **Q4** (no-house-slab rule) still open. No schema, no accounting.

### L4 — Deduction heads + correction path
Four new `VendorPaymentSlipLine` columns (`shortagePaise`, `parkingPaise`, `otherPaise`,
`labourPaise` — `damagePaise` already exists), new GL codes, accrual lines, wizard and
detail UI, and the **missing refund/payment-reversal flow** (audit D-13). **Q11** must cover
**all ten** vendor GL codes — the seven already in use are documented in-source as
placeholders awaiting Accounts sign-off. **Q15** decides the correction mechanism.

### L3 — Transporter advance
Unchanged, and **Option A remains a proposal only**. Blocked on **Q5/Q6/Q7**. Spans
first-mile (`LRGroup.marketAdvanceAmount`) and last-mile
(`DeliveryChallan.advanceAmount`) — must be designed once for both. **No historical entry
may be generated** from those columns: they are not payment records.

### L6 — Customer detention slabs (new)
- **Files:** `detention.engine.ts` (**unchanged**), `detention.service.ts` (a customer
  quote path), `billing.service.ts` `evaluateBillingForLR` (emit the charge),
  `master/detention-slab.schema.ts` + master UI (the discriminator)
- **Schema / migration:** `DetentionSlab.appliesTo: DetentionSlabScope (BROKER | CUSTOMER)`,
  default `BROKER` so **every existing slab keeps its exact current behaviour**; relax
  `transportId` to conditionally-required; enforce the pairing in Zod and a DB CHECK
- **API:** a customer detention quote; recompute-on-acknowledge
- **UI:** scope selector on the slab master; the computed figure shown on the LR
  acknowledgement screen beside the observed one
- **Accounting:** **no new entries.** The charge flows through the existing
  `DETENTION → DETENTION_INCOME` mapping, taxable like today
- **Tests:** a customer slab never matches a broker quote and vice versa; existing broker
  slabs behave identically after the migration (regression); the emitted `LRCharge` has
  `source: DETENTION_CALCULATION`; **no double charge with a hand-entered amount**

---

## 5. Conflicts with existing logic — checked

| Area | Risk | Finding |
|---|---|---|
| Detention engine | Q18 changes its inputs | **No conflict.** The engine is pure and takes dates as values; 29 tests unaffected |
| Billing / GST | Q19 adds a customer charge | **No conflict.** Reuses the built `DETENTION → DETENTION_INCOME` path |
| **Billing — double charge** | Slab charge *and* hand-entered ack amount | **⚠️ Real conflict** → Q21 |
| Existing slabs | Q19 adds a discriminator | **No conflict** if `appliesTo` defaults to `BROKER`; a regression test must prove it |
| Challan lifecycle | Q8 adds stages | **No conflict** if approval is a separate row rather than new `DeliveryChallanStatus` values — all existing `ISSUED` guards keep working |
| Locking / idempotency | L5 changes eligibility | **No conflict.** The partial unique index, advisory locks, `clientRequestId` and version guards are untouched |
| Reversal workarounds | Q16 keeps today's dating | **No conflict, but a standing rule** — the three `reversesId: null` filters stay, and new reports must copy them |
| Vendor accrual | L4 adds heads | Additive lines inside the existing balanced voucher shape |
| Trial Balance / reconcile (unbuilt) | Q16 | Must adopt the `reversesId: null` + `POSTED` filter from day one |

---

## 6. Still needs confirmation

**Carried over (unchanged, not assumed):** Q3, Q4, Q5, Q6, Q7, Q9, Q10, Q11, Q13, Q14,
Q15, Q17.

**New, arising from these decisions:**

| # | Question | Decider | Blocks |
|---|---|---|---|
| **Q20** | Existing `DeliveryChallan` rows with `paymentBy = CASH` — did the company already pay in cash (**not** payable; paying again is a double payment), or does it still owe, to be settled in cash (payable)? If it varies, they go to the review queue and operations reclassifies. **No automatic reclassification either way.** | Operations | L1 historical data only — new data is unblocked |
| **Q21** | When slab-based customer detention exists, what happens to the hand-entered `LRAcknowledgement.detentionAmount`? (a) slab replaces it, field becomes read-only/derived; (b) hand-entered overrides the slab when present; (c) both shown, operator picks — **as today's two-ack pattern does**. Without an answer the customer can be billed twice | Accounts + Operations | **L6** |
| **Q22** | Is slab-computed customer detention **taxable** on the bill? Today the hand-entered one is `isTaxable: true`. I will not assume this carries over — it is a GST treatment question | **Accounts** | L6 |
| **Q23** | Should `UPI` be accepted as an LDC disbursement mode? Q1 names Cash, Bank Transfer and Cheque; the `PaymentMode` enum also has `UPI` and nothing currently restricts it | Accounts | Trivial; L1 or later |

**No accounting assumption has been made anywhere in this document.** Specifically: the
advance treatment (Q5) is still a proposal, the ten vendor GL codes (Q11) are still
unsigned-off placeholders, L5's approval is proposed as non-posting (Q9), and customer
detention's tax treatment (Q22) is explicitly deferred to Accounts.

---

## 7. Recommended next step

**L0.1 — the Q16 correction — first.** It is a one-function change to code already on this
branch, it closes the gap between what is implemented and what you decided, and leaving it
is the only thing in the repo today that knowingly contradicts a confirmed decision.

**Then L1**, which is unblocked for all new data; only the historical `CASH` rows wait on
Q20, and they are safely parked in a review queue meanwhile.

**Then L5**, once Q9 and Q10 are answered — it is now the gate for L2 and L4.

**In parallel, whenever Accounts is ready:** L3 (Q5–Q7) and L6 (Q21, Q22).

Separately, and still my strongest recommendation from the accounts audit: the
**credit/debit-note `LedgerAllocation` fix** needs no decision from anyone and corrects
customer outstanding and Ageing figures that are wrong today.
