# LDC (Local Delivery Challan) Broker Payment — Workflow & Implementation Plan

> **Status:** Reconstructed plan, awaiting review. **No code, schema, migration or existing
> document has been changed.** Nothing in §3–§6 is approved for implementation; every
> accounting entry below is a *proposal* pending the confirmations in §7.
>
> **Cross-checked against the Accounts audit on 2026-11-06** — the reconciliation of the
> two documents, including what was aligned and what contradicted, is in **§11**.
>
> **Date:** 2026-11-06 · **Branch:** `ERP-79/LDCBrokerPaymentAndDetentionSlabs`
> **Companions:** [`ACCOUNTS_AUDIT_2026-11-06.md`](./ACCOUNTS_AUDIT_2026-11-06.md),
> [`ERP_MODULE_PLAN_V2.md`](./ERP_MODULE_PLAN_V2.md) §4.4–4.5,
> [`ACCOUNTS_MODULE_MAP.md`](./ACCOUNTS_MODULE_MAP.md) §2.F, [`CONTEXT.md`](./CONTEXT.md) §5.2–5.7

---

## 0. Provenance — what this document is, and is not

**This file never existed.** `apps/server/prisma/ldc-inventory.ts` references
`docs/LDC_WORKFLOW_PLAN.md`, but:

```
git log --all -- docs/LDC_WORKFLOW_PLAN.md   → no commits
git branch -a (21 branches), git stash list  → no copy
git log --all --diff-filter=A | grep -i ldc  → only code files, no plan doc
```

So this is a **reconstruction from primary sources**, not a restoration. It is assembled
from:

| Source | What it gave |
|---|---|
| `ldc-inventory.ts` (untracked, read-only diagnostic) | The **seven unknowns** the original plan was organised around — recovered verbatim from its function docstrings (§2) |
| `ERP_MODULE_PLAN_V2.md` §4.4–4.5 | DC entity, `DCAcknowledgement`, `DCApproval`, detention date logic, slab rule-tree |
| `ACCOUNTS_MODULE_MAP.md` §2.F | The legacy 3-stage DC payment flow reverse-engineered from `DCApproval.aspx` / `DCPaymentSlip.aspx` / `DCPaymentEntry.aspx` |
| `CONTEXT.md` §5.2, §5.3, §5.7 | Why two acknowledgements exist (fraud), LDC = Local Delivery Challan, slabs must be data |
| The implementation itself | What is already built and must not be rebuilt (§1) |
| `ACCOUNTS_AUDIT_2026-11-06.md` | D-1…D-12, E-1…E-5, F-12 |

**Legend used throughout**

- **[CONFIRMED]** — stated in a committed doc, a legacy-code reverse-engineering note, or
  provable from the current implementation.
- **[INFERRED]** — my reading, consistent with the sources but never written down. Treat as
  a proposal.
- **[QUESTION Qn]** — a business rule I will not invent. Listed in §7.

---

## 1. The LDC workflow as implemented today

This section is the *as-built* record. **Everything described here works and is not to be
rebuilt.** File references are the authority.

### 1.1 Chain of custody

```
Rake arrival → VP Loading → Rail-head GRN → Branch GRN
   └─> DeliveryChallan (DRAFT)                         delivery-challan.route.ts:884
         • vehicleMode OWN | MARKET
         • MARKET ⇒ transportId + (vehicleId | vehicleNumberSnapshot)
         • freightAmount, advanceAmount, paymentBy?, loadingAt
         • items[] each carrying lrNumberSnapshot
   └─ issue ─> ISSUED                                  delivery-challan.route.ts:1306
   └─ LR delivery entry sets:
         • LRDelivery.reportedAt / unloadingAt         (per LR)
         • DeliveryChallan.reportDate                  lr-delivery.route.ts:122-180
   └─> LDC payment slip (VendorPaymentSlip type=LDC_BROKER)
         browse → draft → submit → approve (accrual) → disburse (settlement)
```

### 1.2 What is verified correct — do not touch

| Behaviour | Evidence |
|---|---|
| **Challan immutability under a slip.** Only `DRAFT` is editable; slips only accept `ISSUED`. Freight/advance cannot move beneath a posted slip | `delivery-challan.route.ts:1082`; `ldc-broker.ts:33` `CLAIMABLE_STATUS` |
| **Cancel blocked when claimed.** `assertNotOnVendorSlip` with the right reason | `delivery-challan.route.ts:1507-1514` |
| **Delete restricted to DRAFT** | `delivery-challan.route.ts:1532-1541` |
| **Report date settable post-issue, from the delivery screen**, version-guarded per challan, and **locked once the challan is on a slip** ("the slip's detention was computed from the old date") | `lr-delivery.route.ts:122-163` |
| **Double-claim impossible at the DB level** — partial `UNIQUE INDEX (sourceType, sourceId) WHERE isActive`, hand-authored in the migration | `schema.prisma` `VendorPaymentSlipLine` comment; `claims.ts:17-34` |
| **Slip cancel releases sources** — `isActive=false` on every line in the same transaction | `schema.prisma:3389-3391` |
| **Amounts re-derived server-side.** A client cannot inflate freight or advance; a challan that is not this broker's, not issued, or already claimed fails loudly | `ldc-broker.ts:reconcileLDCLines` |
| **Detention engine.** `FinalReporting = earliest(ldcDate, reportDate, every LR reportedAt)`; `FinalUnloading = latest(LR unloadingAt)`; inclusive day count (deliberate, business-confirmed 2026-11-04 deviation from spec STEP 7); stacked tiers; HOUR basis ceils part-blocks; IST day indexing | `detention.engine.ts` |
| **Slab snapshot on the line** — `detentionDays`, `detentionSlabId`, `detentionSlabName`, `claimedDetentionPaise` persisted so a paid slip stays explainable after the slab changes (spec STEP 18) | `migrations/20261104000000_ldc_detention_audit` |
| **Slip lifecycle.** `DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_PAID → PAID / CANCELLED`; accrual on approve, one settlement voucher per disbursement; `pg_advisory_xact_lock` on the slip; `clientRequestId` idempotency; version guards; approval controlled by RBAC and branch access | `vendor-payment.route.ts`; `approval-decision.ts` |
| **Accrual/settlement idempotency.** `existingAccrualJournalEntryId` / `existingSettlementJournalEntryId` short-circuit to the posted voucher rather than double-posting | `posting.service.ts:1426-1432, 1586-1592` |
| **Detention slab master** is a correct vertical slice; its permission `masters.detention-slab` is auto-granted by the seed's `Object.values(RM)` enumeration | `permissions.ts:310`; `seed-admin.ts:38` |

### 1.3 Current money formula

```
line.gross      = challan.freightAmount + min(clientClaim, slabAmount)
line.deductions = challan.advanceAmount + TDS(gross × tdsRateBps)
line.net        = gross − deductions
slip.net        = Σ line.net
```
`vendor-payment.route.ts:255-305` (build) and `:334-337` (recalc).

### 1.4 Current accrual entry (as posted today)

```
Dr  FREIGHT_EXPENSE                  Σ freight
Dr  DETENTION_EXPENSE                Σ approved detention
    Cr  TRANSPORTER_ADVANCE_RECOVERY      Σ advance        ← see §4.1 — DEFECT
    Cr  TDS_PAYABLE                       Σ TDS
    Cr  <broker party ledger>              slip.netPayable  (+ NEW_REF on the slip)
```
Disbursement: `Dr <broker> / Cr <funding Cash-Bank>` + `AGAINST_REF` on the slip.

### 1.5 Reconstructed legacy comparison **[CONFIRMED** from `ACCOUNTS_MODULE_MAP.md` §2.F**]**

| Legacy stage | Legacy behaviour | Current |
|---|---|---|
| `DCApproval.aspx` | Two acks side by side, operator picks one, edits Freight/Shortage/Damage/Parking/Detention/DetentionDays/Other/Labour → derives FreightPayable | **Absent** — slip built straight from `ISSUED` |
| `DCPaymentSlip.aspx` | Differential journal vs the approval, then `Dr FreightPayable (Agst Ref) / Cr Broker / Cr TDSContractor` | Accrual + payee `NEW_REF` (equivalent, cleaner) |
| `DCPaymentEntry.aspx` | Partial payment → pending | `VendorPaymentDisbursement`, partial-aware ✔ |

---

## 2. The seven unknowns (recovered from `ldc-inventory.ts`)

The original plan was organised around these. Recovered from the script's own docstrings,
with the gap each maps to.

| # | Unknown (script's words) | Maps to |
|---|---|---|
| 1 | "how many advances were never posted" — ISSUED challans carrying an advance | **G3** / D-2 |
| 2 | "what sits in the advance-recovery ledger" — "the known defect: the vendor accrual credits this account but nothing ever debits it, because challan advances are not posted when they are handed over" | **G3** / D-2 |
| 3 | LDC slips already posted and how much advance they credited | **G3** sizing |
| 4/5 | "`paymentBy` decides whether a challan is a broker payable at all, but the column is nullable and has never been enforced. Legacy nulls go to a review queue rather than being guessed at" | **G1** |
| 6 | "without an unscoped fallback slab, any challan whose broker/vehicle/freight matches nothing silently prices detention at zero" | **G2** + **Q4** |
| 7 | "detention needs a final unloading date" — challans with no unloading date on any LR "today these pay zero detention" | **G2** |

**Unknown 6 is in tension with the code.** `detention-slab.schema.ts:131-134` states as a
deliberate rule: *"Required: a slab prices one broker's detention. **There is no house
slab** — a broker with no slab quotes zero and says so, rather than silently inheriting
someone else's rate card."* `transportId` is a **required** field on a slab. So the script's
framing ("← unmatched challans price detention at zero" as a problem) and the validator's
framing (zero is correct and intentional) disagree. **This is Q4, not a bug to fix by adding
a fallback slab.** What is genuinely defective is the "and says so" half — see G2.

---

## 3. Gap specifications

Each gap: requirement → files → schema → API → UI → journal → permissions → migration →
tests → questions.

---

### G1 · `paymentBy` eligibility enforcement — **double-payment risk**

**Requirement [CONFIRMED]** — unknown 4/5: `paymentBy` decides whether a challan is a
broker payable at all, is nullable, and has never been enforced. Nulls go to a review
queue, not a guess.

**Current state.** `DeliveryChallanPaymentBy = COMPANY | CLIENT | TRANSPORTER | CASH`,
nullable. Captured on create/update (`delivery-challan.route.ts:1000, 1260`), displayed
(`DeliveryChallanDetail.tsx:305`), and used in **no** logic anywhere —
`findEligibleLDCSources` filters only `transportId` + `status: ISSUED`
(`ldc-broker.ts:82-90`). A `CASH` challan (settled at the gate) or a `CLIENT` challan
(customer pays the broker direct) appears as a payable and can be paid a second time.

**Files:** `calculators/ldc-broker.ts` (`findEligibleLDCSources` where-clause,
`reconcileLDCLines` guard) · `vendor-payment.route.ts` (eligible-sources route) ·
`LDCSlipWizard.tsx` (browse step) · optionally `delivery-challan.route.ts` (issue-time
requirement).

**Schema:** none required for the filter. Optional later: make `paymentBy` non-null at
issue time (needs a backfill — see below).

**API:** add `paymentBy` to the eligible-source row so the browse table can show it. Add a
`needsReview` eligible-source variant, or a separate count, for NULL challans.

**UI:** show `paymentBy` as a column; a "Needs review — payment-by not set" section or
badge for NULLs; exclude non-payable values from selection.

**Journal:** none. This is a filter, not a posting.

**Permissions:** unchanged (`accounts.payment.create` / `.view`).

**Migration / historical:** the inventory script's §4/5 reports the live NULL
distribution. Do **not** default existing NULLs to a value — that is exactly the guess
unknown 4/5 forbids. Route them to review.

**Tests:** eligible-sources excludes each non-payable value; includes the payable
value(s); NULL appears in review, not in the payable list; `reconcileLDCLines` rejects a
non-payable challan even if its id is posted directly.

**[QUESTION Q1]** Which `paymentBy` values make the broker a payee? My reading
**[INFERRED]** is `COMPANY` yes; `CLIENT` no; `CASH` no (already settled); `TRANSPORTER`
unclear — on a *broker* slip "payment by transporter" may mean the broker absorbs it (not
payable) or may be a legacy synonym for COMPANY. **Operations must state this.**

**[QUESTION Q2]** Should `paymentBy` become mandatory at **issue**, and what happens to
existing ISSUED NULL challans — review queue only, or a one-time operations data-fix pass?

---

### G2 · Detention warnings, and blocking validation — **silent underpayment**

**Requirement [INFERRED]** — unknown 7 plus audit finding 2. The engine already produces a
complete diagnostic set; it is discarded before the decision that matters.

**Current state.** `quoteChallanDetention` returns `warnings[]` covering: no reporting
date, no unloading date on N LRs, unresolvable LR numbers, no broker on the challan, no
matching slab, uncovered rate bands, unloading before reporting. Those warnings are
rendered well in the **wizard browse step** (`LDCSlipWizard.tsx:491-540`). They are
**not** carried onto the slip line, **not** shown on `VendorPaymentSlipDetailPage.tsx:357-389`
(which shows amount, days, slab name, broker claim — and when no slab matched,
`detentionSlabName` is null, so the cell reads "₹0" with no annotation), and
`DetentionBreakdownDialog` is wired into the wizard only (`LDCSlipWizard.tsx:699`). The
server never blocks: `reconcileLDCLines` throws only when `advance > freight + detention`.

The person authorising the slip must see the same warnings that were available while the
slip was prepared, whether or not they are also its creator.

**Files:** `detention.service.ts` (quote already sufficient) · `ldc-broker.ts`
(`reconcileLDCLines` — carry warnings, apply blocks) · `vendor-payment.route.ts` (build +
submit validation) · `VendorPaymentSlipDetailPage.tsx` · `DetentionBreakdownDialog.tsx`
(reuse on the detail page) · `vendor-payment.service.ts` (web types).

**Schema:** two options.
- *(a)* No change — recompute the quote on the detail page for display.
- *(b)* **[INFERRED preferred]** persist the working on the line:
  `detentionWarnings String[]`, `detentionReportingAt DateTime?`,
  `detentionUnloadingAt DateTime?`. Rationale: the dates are locked once claimed, so a
  recompute *should* agree — but if it ever disagrees, the snapshot is what was approved.
  Consistent with the existing STEP-18 snapshot decision.

**API:** `detentionWarnings` on the slip-line DTO; a `GET /vendor-payment/slips/:id/detention/:lineId`
breakdown endpoint, or embed the breakdown in the detail payload.

**UI:** warning badges on the slip line; "No slab matched" / "No unloading date" instead of
a bare ₹0; breakdown dialog reachable from the detail page; a summary banner on the approve
dialog ("2 of 5 challans have detention warnings").

**Journal:** none.

**Blocking rules — all [QUESTION Q3]:**

| Condition | Proposal [INFERRED] |
|---|---|
| No unloading date on any LR | **Block submit.** Detention cannot be computed; pay later or pay freight-only by explicit choice |
| No slab matched for the broker | **Warn, allow** — per the validator's "quotes zero and says so" rule |
| Some LR numbers unresolvable | **Warn, allow** — understates detention, operator judgement |
| Unloading before reporting (bad data) | **Block submit** |
| Rate bands do not cover the duration | **Block submit** — the slab is misconfigured |

**Permissions:** optionally a `accounts.payment.override_detention_warning` for an explicit
documented override of a block, rather than a silent allow.

**Migration / historical:** if 3(b), the new columns are nullable and existing lines keep
their snapshot as-is. No backfill.

**Tests:** quote with each warning class → slip build carries it; blocked conditions refuse
submit with the challan named; a zero-detention slip with no slab is approvable and
annotated.

**[QUESTION Q4]** Confirm the no-house-slab rule. The validator says a broker without a
slab is paid zero detention, deliberately. `ldc-inventory.ts` treats that as a problem.
**Which is the business rule?** If zero is right, the inventory script's wording should be
corrected; if a fallback is wanted, `transportId` must become optional and `applies()` /
`specificity()` revisited.

---

### G3 · Transporter advance accounting — **the one that touches real cash**

**Requirement [CONFIRMED]** — unknowns 1–3, audit D-2 / E-1, and
`posting.service.ts:1308-1326`'s own warning: *"VENDOR_ADVANCE_RECOVERY_CODE is only
correct if transporter advances are debited to this same ledger wherever they're paid out —
as of this writing no such flow exists… **Do not wire the advance deduction line into
production posting until that's resolved.**"* The line is wired (`:1505`).

**Scope is wider than LDC.** The identical defect exists first-mile: the TRANSPORTER
calculator takes its advance from `LRGroup.marketAdvanceAmount`
(`transporter-truck.ts:127`, `transporter.ts:97`) — also a captured figure, never a payment
record. **The fix belongs in the vendor-payment/ledger layer, designed once for both**, not
in LDC alone.

**Critical fact for any backfill.** `DeliveryChallan.advanceAmount` is captured at challan
creation, surfaced as `balancePayable = freight − advance`
(`delivery-challan.route.ts:521`), and **never disbursed through any payment flow** — grep
confirms no voucher, no `CashPayment`, no disbursement references it. The same holds for
`LRGroup.marketAdvanceAmount`. **There are therefore no payment records to verify a
historical advance against.** The amount on the challan asserts that cash was handed over;
it is not evidence of it. Per your constraint, **no historical advance entries may be
generated from these columns.** The only defensible paths are a manual Accounts-reviewed
correcting journal, or an operations exercise to evidence the advances. **[QUESTION Q7]**

**Three candidate treatments — none approved:**

**Option A — post the advance when it is handed over** *(cleanest, most invasive;
**recommended [INFERRED] — PROPOSED, NOT APPROVED**, pending Q5. The Accounts audit makes
the same recommendation in D-2/E-1; neither document approves it.)*
```
At advance hand-over (new flow, needs a funding account + date + mode):
  Dr  TRANSPORTER_ADVANCE_RECOVERY   advance        (CURRENT_ASSET — correctly an asset)
      Cr  <funding Cash-Bank>            advance
At accrual (unchanged from today):
  Cr  TRANSPORTER_ADVANCE_RECOVERY   advance        ← now clears the asset to zero
```
Needs: a capture point for *when/how* the advance was actually paid (it is currently a
number typed on a challan with no date, mode or account), which is new UI + schema
(`advancePaidAt`, `advanceFundingLedgerId`, `advanceJournalEntryId`, `advancePaidById`) and
a new permission. It is the only option that puts the cash outflow in the books on the day
it happened.

**Option B — drop the advance line from the accrual; let the payee ledger carry it**
```
At hand-over:  Dr <broker party ledger>  advance / Cr <funding Cash-Bank>  advance
At accrual:    Dr FREIGHT_EXPENSE + DETENTION_EXPENSE
                   Cr TDS_PAYABLE
                   Cr <broker>   (freight + detention − TDS)   ← gross, advance NOT deducted
Disbursement:  Dr <broker> / Cr Cash-Bank   (the balance only)
```
The broker's ledger nets to the right balance without a recovery account at all. Simpler
accounting; changes `netPayablePaise` semantics and the slip UI, and still needs the
hand-over capture point.

**Option C — accept it as a timing difference, with a periodic correcting journal**
*(stop-gap)*. Keep today's posting, add the wrong-side-GL reconcile check (§4.2 below;
identity **5** in the audit's §H list), and have Accounts pass a monthly correcting entry.
**Does not fix the missing cash outflow** — not recommended beyond a bridge.

**Files (all options):** `posting.service.ts` (`postVendorSlipAccrual`,
`VENDOR_ADVANCE_RECOVERY_CODE`, possibly a new `postVendorAdvance`) ·
`seed-ledger.ts` · `delivery-challan.route.ts` + `grn`/`lr-group` for the hand-over point ·
`vendor-payment.route.ts` recalc · both transporter calculators · `LDCSlipWizard.tsx` and
the transporter wizard.

**Journal:** as above, **pending Q5/Q6/Q7**.

**Permissions:** Option A/B need something like `accounts.advance.pay` — paying cash is a
disbursement-class action and should not ride on `delivery_challan.update`.

**Migration / historical:** forward-only. Existing unbacked credit balance → Accounts
correcting journal, amount evidenced by Q7's exercise, **never** auto-generated.

**Tests:** advance hand-over posts and nets to zero against the accrual; advance-recovery
ledger lifetime balance is zero (the reconcile identity that would have caught this);
reversal of a hand-over; an accrual whose advance exceeds freight+detention still refuses.

**[QUESTION Q5]** Which option? This is an Accounts decision about chart-of-accounts
treatment, not an engineering one.
**[QUESTION Q6]** Are last-mile broker advances paid from a branch cash account, by the
supervisor from an imprest float, or by HO bank transfer? The answer decides whether a
funding-account field is realistic at capture time.
**[QUESTION Q7]** How is the existing unbacked balance to be evidenced and corrected?

---

### G4 · Supervisor + broker DC acknowledgement and approval

**Requirement [CONFIRMED]** — `ERP_MODULE_PLAN_V2.md` §4.4 specifies
`DCAcknowledgement(dcId, ackType: Supervisor|Broker, actorId, ackDate, ackTime,
deliveryDate, reportingDate, collectionDate, paymentMode, detentionDays, detentionAmt,
parkingAmt, otherExpenses, labourCharge, shortageAmt, damageAmt, podAttachmentId)` — **two
parallel rows per DC**, shown side by side — plus `DCAckItem(dcAckId, lrId, totalQty,
receivedQty, damageQty)` with shortage derived, and `DCApproval(dcId, acceptedAckType,
brokerPayable, approverId, approvedAt)`. `CONTEXT.md` §5.2 gives the reason: *"SK
supervisor at the godown acks what was actually received. The broker who hauled the load
files their own claim (often inflated). Approver picks which version to trust at DCApproval
→ drives broker payable. **Mismatch detection prevents fraud.**"*

**Current state.** **No model exists** — grep for `DCAck` / `DeliveryChallanAck` /
`DCApproval` in `schema.prisma` returns nothing. `DeliveryChallanStatus` is only
`DRAFT | ISSUED | CANCELLED`. The slip is built directly from an `ISSUED` challan. The
`min(claim, slab)` rule is a partial substitute that compares the broker's claim to a
**rate table**, not to what the supervisor witnessed.

**Files:** new `apps/server/src/modules/delivery-challan-ack/` (vertical slice) ·
`schema.prisma` · new `packages/validators/src/delivery-challan/ack.schema.ts` ·
`ldc-broker.ts` (eligibility becomes "has an approval", not "is ISSUED") ·
new `apps/web/features/delivery-challan-ack/`.

**Schema (new):** `DeliveryChallanAcknowledgement` (two rows per challan, `@@unique([challanId, ackType])`),
`DeliveryChallanAckItem`, `DeliveryChallanApproval` (`@@unique([challanId])`,
`acceptedAckType`, the approved head amounts, `approvedById`, `approvedAt`,
`journalEntryId?` if approval itself accrues). Plus either two new
`DeliveryChallanStatus` values (`ACKNOWLEDGED`, `APPROVED`) or a derived status — **[INFERRED]**
prefer a separate approval row over new challan statuses, so the existing
`ISSUED`-based guards keep working untouched.

**API:** `POST/PATCH /delivery-challans/:id/acknowledgements` (one per type, both
editable until approval) · `GET` returning both side by side with a computed mismatch set ·
`POST /delivery-challans/:id/approval` (pick ack + edit heads) · `POST .../approval/revoke`
(only while unclaimed).

**UI:** side-by-side ack comparison with mismatches highlighted — this is the fraud
control and the layout *is* the feature; approval screen with per-head editable amounts and
the chosen ack radio; POD attachment.

**Journal:** **[QUESTION Q9]** — does approval accrue (legacy derived `FreightPayable` at
approval and the payslip booked only the differential), or does the accrual stay where it
is today, at slip approval? **[INFERRED]** keep accrual at slip approval; the DC approval
stage produces *amounts*, not postings. That preserves the working slip engine and keeps
one accrual point.

**Permissions:** new family — `delivery_challan.ack.supervisor`,
`delivery_challan.ack.broker`, `delivery_challan.approve`. The supervisor ack and the
approval must not be the same permission, or the control collapses.

**Migration / historical:** existing ISSUED challans have no acks. Either grandfather them
(eligibility accepts "approved OR issued-before-cutover-date") or require acks for all —
**[QUESTION Q10]**. Grandfathering is **[INFERRED]** safer: it avoids stranding challans
that are already delivered and awaiting payment.

**Tests:** two acks coexist and are independently editable; a third is rejected; approval
requires at least one ack; approved heads drive the slip line; a claimed challan's
approval cannot be revoked; mismatch computation.

**[QUESTION Q8]** Is this stage actually wanted now? It is the largest item here and the
business has been running without it. The fraud rationale is strong, but it is a module,
not a patch.

---

### G5 · Missing deduction heads — shortage, parking, other, labour

**Requirement [CONFIRMED]** — `ERP_MODULE_PLAN_V2.md` §4.4: broker payable =
`Freight − Advance − Shortage/Damage + Detention/Parking/Other/Labour`. Legacy
`DCApproval.aspx` edited exactly Freight, Shortage, Damage, Parking, Detention,
DetentionDays, Other, Labour.

**Current state.** **Five heads are absent from the LDC payable** — shortage, damage,
parking, other expenses, labour — which is how the Accounts audit states it (F-12).
Structurally that is **four new columns**: `damagePaise` already exists on
`VendorPaymentSlipLine` and is used by TRANSPORTER, but the LDC branch forces it to zero
via `ZERO_LINE_COMPONENTS`, so LDC cannot populate it today. Both statements are true and
the two documents are consistent: *five heads unavailable, four columns to add.*

**Note on sign.** Shortage and damage are **deductions** (recoveries from the broker);
parking, other expenses and labour are **additions** (reimbursements to the broker). The
current `recalcSlipTotals` puts `damagePaise` in `deductions` for TRANSPORTER, which is
consistent.

**Files:** `schema.prisma` · migration · `packages/validators/src/accounts/vendor-payment.schema.ts`
· `vendor-payment.route.ts` (`buildSlipLines` LDC branch, `recalcSlipTotals`,
`ZERO_LINE_COMPONENTS`) · `posting.service.ts` (`VendorSlipAccrualLine`, `sumLines`, the
LDC branch of `postVendorSlipAccrual`, new GL codes) · `seed-ledger.ts` ·
`LDCSlipWizard.tsx` · `VendorPaymentSlipDetailPage.tsx`.

**Schema:** `VendorPaymentSlipLine` + `shortagePaise`, `parkingPaise`, `otherPaise`,
`labourPaise`, all `BigInt @default(0)` — additive and backward-compatible.

**Proposed accrual, LDC [all pending Q11]:**
```
Dr  FREIGHT_EXPENSE                 Σ freight
Dr  DETENTION_EXPENSE               Σ detention
Dr  PARKING_EXPENSE                 Σ parking          ← new GL
Dr  BROKER_OTHER_EXPENSE            Σ other            ← new GL
Dr  HAMALI_EXPENSE                  Σ labour           ← reuse existing
    Cr  SHORTAGE_RECOVERY               Σ shortage     ← new GL
    Cr  DAMAGE_RECOVERY                 Σ damage       ← exists
    Cr  TDS_PAYABLE                     Σ TDS
    Cr  <advance treatment per G3>      Σ advance
    Cr  <broker party ledger>           net            (+ NEW_REF)
```

**UI:** per-head inputs on the wizard line (and on the DC approval screen if G4 lands —
these heads *originate* there per the legacy flow); columns on the slip detail.

**Permissions:** unchanged.

**Migration / historical:** new columns default 0; existing lines unaffected; existing
vouchers untouched.

**Tests:** each head reaches the right side of the accrual; net recomputes correctly;
deductions-exceed-gross still refuses; a slip whose heads are all zero posts identically to
today (regression guard).

**[QUESTION Q11]** Confirm the sign of each head and its GL account name/group. Also:
should labour here share `HAMALI_EXPENSE` with the hamali slips, or have its own head?

**Q11 must also re-confirm the heads that already exist.** The Accounts audit records that
all seven current vendor GL codes (`DETENTION_EXPENSE`, `HAMALI_EXPENSE`,
`TRANSPORTER_ADVANCE_RECOVERY`, `COMMISSION_RECOVERY`, `HAMALI_RECOVERY`,
`DAMAGE_RECOVERY`, `STATIONERY_RECOVERY`) are **"clearly-named PLACEHOLDER [codes] pending
Accounts' written sign-off"** — `posting.service.ts:1308-1313` and the matching comment in
`seed-ledger.ts:127-131`. So Q11 is not only about the three new codes this gap proposes;
the existing seven have never been signed off either. One Accounts review should cover all
ten.

**[QUESTION Q12]** If G4 is deferred, where do these amounts come from — typed directly on
the LDC wizard line by the maker? That works, but it removes the acknowledgement evidence
the legacy flow required before editing them.

---

### G6 · Server-side detention claim fallback — **confirmed defect, cheapest fix**

> Recorded in the Accounts audit as **D-14** (added there on cross-check) and scheduled as
> its **P0-7**. This section is the specification; the audit carries the finding.

**This is worse than the audit originally recorded.** `moneyPaise` in
`packages/validators/src/accounts/vendor-payment.schema.ts:33` is
`z.coerce.bigint().nonnegative().default(0n)` — so `detentionPaise` on a slip line is
**optional and defaults to zero**. Combined with the server's rule
(`vendor-payment.route.ts:281-285`):

```ts
const detentionPaise =
  line.detentionPaise < server.detentionPaise ? line.detentionPaise : server.detentionPaise;
```

**any request that omits `detentionPaise` pays the broker ₹0 detention**, even when the
slab computed ₹5,000. The only thing preventing this today is that the one existing client
happens to send the slab amount when the claim box is blank
(`LDCSlipWizard.tsx:76-79`). A second screen, a bulk import, a mobile client or a
retry built from a trimmed payload would silently underpay.

**Files:** `packages/validators/src/accounts/vendor-payment.schema.ts` ·
`vendor-payment.route.ts:255-305` · `LDCSlipWizard.tsx` (can then stop pre-filling).

**Schema:** none (DB unchanged).

**API — proposed [INFERRED]:** make the claim explicit and absence meaningful.
```ts
// LDC line input
claimedDetentionPaise: z.coerce.bigint().nonnegative().nullish()   // null/absent = no claim filed
```
Server: `approved = claim == null ? slab : min(claim, slab)`. Store
`claimedDetentionPaise` only when a claim was actually filed (already the behaviour at
`:300-303`). Reject a *negative* claim (already covered) and consider rejecting a claim
above the slab with a warning rather than silently clamping — **[QUESTION Q13]**.

**UI:** unchanged behaviour, simpler code — blank box means "no claim", which is now the
server's default rather than a client-side pre-fill.

**Journal:** none directly; corrects the detention amount that flows into the accrual.

**Permissions:** unchanged.

**Migration / historical:** none. Existing lines already store the slab-derived figure.
**[QUESTION Q14]** — should existing LDC lines be audited for a ₹0 detention that the slab
would have priced above zero? The inventory script's §3 (`advance credited by them` /
`detention on them`) can be extended to report this read-only.

**Tests:** omitted `detentionPaise` → slab amount paid (the regression this prevents);
explicit lower claim → claim paid, `claimedDetentionPaise` stored; explicit higher claim →
slab paid; explicit `0` claim → zero paid and recorded as a filed claim, distinguishable
from "absent".

---

## 4. Accounts-audit integration

### 4.1 Advance double-entry — see G3. Blocked on Q5/Q6/Q7.

### 4.2 Vendor payable and advance reconciliation

Two identities to implement alongside, from the audit §H:

- **Per slip:** `Σ NEW_REF − Σ AGAINST_REF = netPayablePaise − paidPaise`. Catches a
  disbursement that posted without updating the slip, or vice versa.
- **Advance-recovery ledger lifetime balance = 0.** Under Option A or B this must hold; a
  non-zero balance is D-2 recurring. Under Option C it is the monitoring signal.

Plus the generalised check: **any GL head whose lifetime balance sits on the wrong side of
its `LedgerAccountGroup`** (a `CURRENT_ASSET` in permanent credit) — this single rule would
have surfaced D-2 the week it shipped.

### 4.3 CN/DN allocation and accounting — **not an LDC item; sequence it first anyway**

Audit D-1 (credit/debit note vouchers write no `LedgerAllocation`) and E-2 (no output-GST
reversal) are on the **receivable** side and share no files with LDC. They are listed here
only because:

1. They are higher-severity than anything in this plan (reports are wrong today).
2. P0-1 in the audit roadmap and G6 here are both small; doing D-1 first keeps the
   financial-correctness queue in severity order.

**The LDC work does not depend on them and they do not depend on the LDC work.** Both can
proceed in parallel by different people without merge conflict.

### 4.4 Accrual and disbursement posting — already correct

Verified line by line in the audit: balanced, one-sided lines rejected, allocations on both
sides, `sourceType` discriminated (`VENDOR_PAYMENT_ACCRUAL` vs `VENDOR_PAYMENT`),
`sourceId` = the *disbursement* id so partials do not collide on
`@@unique([voucherType, sourceType, sourceId])`. **Do not restructure.** G5 adds lines
within this shape; G3 changes which lines appear.

### 4.5 Reversal and duplicate-posting protection — one real gap

**Working:** accrual and settlement idempotency via `existing*JournalEntryId`;
`clientRequestId` unique on disbursements with P2002 fall-back to the existing row;
`reversesId @unique` (at most one reversal); `reverseJournal` early-returns on an already
`REVERSED` entry; allocations mirrored symmetrically; slip cancel refuses when
`paidPaise > 0`.

**The gap:** both `reverseVendorSlipAccrual` (`posting.service.ts:1649`) and the cancel
route (`vendor-payment.route.ts:1158`) defer to a *"separate refund/payment-reversal
flow"* — and **that flow does not exist.** Grep finds only those two error messages. So
**once any amount is disbursed against a broker slip there is no in-system way to correct
it**: not a wrong detention figure, not an overpayment, not a slip raised against the wrong
challan. The only recourse today is a manual journal, which leaves the slip's own state and
its allocations wrong.

This is a prerequisite for operating LDC at volume and should be scoped with G5. Recorded in
the Accounts audit as **D-13** (added there on cross-check) and scheduled as its **P1-10**.
It is **vendor-payment-wide**, not LDC-specific — LDC merely surfaced it.

Note the interaction with the audit's reconcile work: once the per-slip identity
(`Σ NEW_REF − Σ AGAINST_REF = netPayablePaise − paidPaise`, audit §H-3) is running, a
manual-journal workaround on a paid slip shows up as **permanent, unclearable drift**. The
correction path should therefore land with, or before, the reconcile job — not after.

**[QUESTION Q15]** — what does the business actually do when a broker is overpaid? Recover
from the next slip (a deduction head — note G5 adds the machinery), demand a refund
(a money-in voucher against the broker), or write it off?

Also from the audit, affecting every voucher this plan posts: **D-5** (reversal `fyCode`
takes the original's year while `voucherDate` is today) should be settled before G3/G5 add
more reversible postings.

---

## 5. Proposed end-to-end LDC workflow

Target state. **Bold** = new or changed. Everything else is as-built and preserved.

```
 1. Rake → VP Loading → Rail-head GRN → Branch GRN                        [unchanged]

 2. DeliveryChallan DRAFT
      freight, advance, paymentBy, vehicle/broker, items[]
      **paymentBy required at issue**                                     [G1, Q2]

 3. Issue → ISSUED                                                        [unchanged]

 4. **Advance hand-over (if any)**                                        [G3, Q5-Q7]
      captured with date + mode + funding account
      Dr TRANSPORTER_ADVANCE_RECOVERY / Cr Cash-Bank      (Option A)
      — or Dr <broker> / Cr Cash-Bank                      (Option B)

 5. LR delivery entry → reportedAt / unloadingAt / challan reportDate     [unchanged]

 6. **DC Acknowledgement ×2 — Supervisor and Broker, in parallel**        [G4, Q8-Q10]
      per-LR qty received/damaged ⇒ shortage derived
      heads: detention days/amt, parking, other, labour, shortage, damage
      POD attachment

 7. **DC Approval — pick one ack, edit heads, derive payable**            [G4]
      side-by-side mismatch view; separate permission from the acks

 8. LDC slip browse
      eligible = this broker's + **payable paymentBy** + **approved**     [G1, G4]
                 + unclaimed (partial unique index)                       [unchanged]
      detention quoted from the slab engine; **warnings carried forward** [G2]

 9. Slip DRAFT → submit
      **blocking validation on hard detention warnings**                  [G2, Q3]
      claim absent ⇒ slab (server-side default)                           [G6]
      amounts re-derived server-side                                      [unchanged]

10. Approve (requires RBAC permission + branch access)                    [unchanged]
      **approver sees detention warnings + breakdown**                    [G2]
      Accrual:
        Dr FREIGHT_EXPENSE, DETENTION_EXPENSE, **PARKING**, **OTHER**, **LABOUR**
            Cr **SHORTAGE_RECOVERY**, DAMAGE_RECOVERY, TDS_PAYABLE
            Cr <advance treatment per G3>
            Cr <broker> = net            (+ NEW_REF)                      [G5]

11. Disburse (partial-aware, idempotent, advisory-locked)                 [unchanged]
      Dr <broker> / Cr Cash-Bank         (+ AGAINST_REF)

12. **Correction path for a paid slip**                                   [§4.5, Q15]

13. Reconcile: per-slip allocation identity; advance-recovery = 0;
    wrong-side GL heads                                                   [§4.2]
```

---

## 6. Phased implementation plan

### Dependency map

```
G6 (claim fallback) ─────────────────────── independent
G1 (paymentBy filter) ──────────────────── independent (Q1, Q2)
D-5 (reversal fyCode) ──────────────────── independent, precedes G3/G5
G2 (warnings + blocking) ───────────────── independent (Q3, Q4)
G5 (deduction heads) ───┬──────────────── needs §4.5 correction path scoped (Q11, Q15)
                        └── feeds ──> G4 (heads originate at approval)
G3 (advance accounting) ────────────────── blocked on Q5-Q7; shared with TRANSPORTER
G4 (ack + approval) ────────────────────── largest; needs Q8-Q10; changes G1 eligibility
Reconcile (§4.2) ───────────────────────── after G3 (so it starts green)
```

### Phase L0 — No-decision-needed correctness *(small, independent, ship first)*

| Task | Gap | Why now |
|---|---|---|
| L0-1 | **G6** server-side claim fallback | Confirmed defect reachable through the API; no business question; no schema change |
| L0-2 | **D-5** reversal `fyCode`/date rule | Precedes adding more reversible postings; 10-line fix |
| L0-3 | **G2 display half** — carry warnings to the slip line and detail page, reuse `DetentionBreakdownDialog` | The approver's blindness is the live risk; display-only, no blocking rules, so no Q3 needed yet |

*Each is independently shippable and independently revertible. None changes an amount
already posted.*

### Phase L1 — `paymentBy` enforcement *(needs Q1, Q2)*

| Task | Gap |
|---|---|
| L1-1 | Eligible-source filter on payable `paymentBy` values; `reconcileLDCLines` guard | G1 |
| L1-2 | Review queue / badge for NULL `paymentBy` | G1 |
| L1-3 | Extend `ldc-inventory.ts` (read-only) to report NULLs and any already-paid non-payable challan | G1 |
| L1-4 | *(optional, after an ops data pass)* require `paymentBy` at issue | G1, Q2 |

### Phase L2 — Blocking validation *(needs Q3, Q4)*

| Task | Gap |
|---|---|
| L2-1 | Hard blocks at submit for the agreed conditions | G2 |
| L2-2 | Optional override permission with a recorded reason | G2 |

### Phase L3 — Advance accounting *(needs Q5, Q6, Q7 — the decision gate)*

| Task | Gap |
|---|---|
| L3-1 | Implement the chosen option in `posting.service.ts` **for TRANSPORTER and LDC together** | G3 |
| L3-2 | Advance hand-over capture (schema + API + UI + permission) | G3 |
| L3-3 | Reconcile identity: advance-recovery lifetime balance = 0; wrong-side GL heads | §4.2 |
| L3-4 | Accounts-authored correcting journal for the existing unbacked balance — **manual, evidenced, never generated** | G3, Q7 |

### Phase L4 — Deduction heads + correction path *(needs Q11, Q15)*

| Task | Gap |
|---|---|
| L4-1 | Four new line columns + validators + recalc | G5 |
| L4-2 | New GL heads + accrual lines | G5 |
| L4-3 | Wizard + detail UI | G5 |
| L4-4 | Refund / payment-reversal flow for a paid slip | §4.5 |

### Phase L5 — DC acknowledgement and approval *(needs Q8, Q9, Q10; largest)*

| Task | Gap |
|---|---|
| L5-1 | Models + migration (ack ×2, ack items, approval) | G4 |
| L5-2 | Ack + approval API, permissions, validators | G4 |
| L5-3 | Side-by-side mismatch UI + approval screen | G4 |
| L5-4 | Eligibility switches from "ISSUED" to "approved", with the grandfather rule | G4, Q10 |
| L5-5 | Move the G5 heads to originate at approval | G4, G5 |

### Safe to implement independently, in any order

L0-1, L0-2, L0-3, L1-1, L1-2, L1-3, L2-*, L4-1…L4-3. These touch disjoint code paths and
none alters an existing posted voucher.

### Must be sequenced

- **L3 before the reconcile check goes live**, or it starts red.
- **L4-4 (correction path) before LDC volume grows**, independent of the rest of L4.
- **L5-4 after L1**, since both rewrite the same eligibility where-clause — doing them
  together avoids a conflict.
- **D-5 before L3 and L4**, which add reversible postings.

---

## 7. Business decisions requiring confirmation

> **Update 2026-11-06 — five decisions confirmed.** Q1, Q8, Q16, Q18 and Q19 are answered;
> the rows below are marked ✅ with the decision. The gap analysis, the revised phase order
> (Q8/Q18 move L5 earlier) and three new questions they raise (Q20–Q23) are in
> [`LDC_DECISIONS_AND_REVISED_PLAN.md`](./LDC_DECISIONS_AND_REVISED_PLAN.md), which
> supersedes §6 of this document. **Note: Q16 was confirmed as Option 2 (current date),
> not the Option 1 implemented provisionally in L0-2 — that code must be corrected.**

Nothing in §3–§6 should be built before the relevant question is answered in writing.

| # | Question | Decider | Blocks |
|---|---|---|---|
| **Q1** ✅ | **ANSWERED: `COMPANY` only is payable; modes (Cash/Bank/Cheque) stay separate on the disbursement.** Which `paymentBy` values make the broker a payee? Specifically, what does `TRANSPORTER` mean on a broker challan? | Operations + Accounts | L1 |
| **Q2** | Make `paymentBy` mandatory at issue? What happens to existing ISSUED NULLs — review only, or an ops data-fix pass? | Operations | L1-4 |
| **Q3** | Which detention warnings **block** submission versus warn? (proposal table in G2) | Accounts + Operations | L2 |
| **Q4** | Confirm the **no-house-slab** rule. The validator says a broker without a slab is deliberately paid zero detention; `ldc-inventory.ts` treats that as a defect. Which is the rule? | Accounts | G2, slab master |
| **Q5** | Advance treatment — **Option A, B or C** in G3? | **Accounts** (chart-of-accounts decision) | L3 |
| **Q6** | How are broker advances physically paid — branch cash, supervisor imprest, HO bank? Decides whether a funding account can be captured at hand-over | Operations | L3-2 |
| **Q7** | How is the existing unbacked `TRANSPORTER_ADVANCE_RECOVERY` balance evidenced and corrected? **No historical entries may be derived from `advanceAmount` columns — they are not payment records** | Accounts | L3-4 |
| **Q8** ✅ | **ANSWERED: mandatory. Both DC Acknowledgement and DC Approval are required before detention calculation and before payment** — so L5 is a prerequisite, not an enhancement, and moves ahead of L2/L4. Original question: is the DC ack + approval stage wanted now, or deferred? | Management | L5 |
| **Q9** | Does DC approval **accrue**, or only produce amounts for the slip to accrue? (proposal: amounts only) | Accounts | L5 |
| **Q10** | Grandfather existing ISSUED challans past the ack requirement, or require acks for all? | Operations | L5-4 |
| **Q11** | Confirm each deduction head's **sign** and its GL account name/group. Should broker labour share `HAMALI_EXPENSE`? | Accounts | L4 |
| **Q12** | If L5 is deferred, may the maker type the deduction heads directly on the LDC line without acknowledgement evidence? | Accounts | L4 |
| **Q13** | A broker claim **above** the slab — silently clamp (today), or reject with a message? | Accounts | L0-1 |
| **Q14** | Audit existing LDC lines for a ₹0 detention the slab would have priced above zero, and correct if found? | Accounts | L0-1 |
| **Q15** | What is done when a broker is **overpaid** — recover on the next slip, demand a refund, or write off? Decides the correction-path design | Accounts | L4-4 |

---

## 8. Critical payment and accounting risks

Ordered by expected loss, not by effort.

1. **Paying the same challan twice (G1).** A `CASH` challan settled at the gate, or a
   `CLIENT` challan the customer paid directly, is indistinguishable from a payable one in
   the browse list. The DB's partial unique index prevents the same challan appearing on
   two *slips* — it does **not** prevent paying a challan that was never ours to pay. This
   is the only risk here that loses money outright on a single transaction.
2. **Silent under-payment of detention (G6, then G2).** `detentionPaise` defaults to `0n`
   in the validator and the server pays `min(claim, slab)` — an omitted field pays zero.
   Separately, a missing unloading date or unmatched slab pays zero with no annotation
   reaching the approver. Both are silent: the slip balances, the voucher balances, the
   broker is simply paid less than the agreement.
3. **Cash outflow missing from the books (G3).** Every advance handed over is absent from
   the ledger, and `TRANSPORTER_ADVANCE_RECOVERY` — a `CURRENT_ASSET` — carries a growing
   credit balance. It compounds with volume, it spans first-mile and last-mile, and no
   current check can see it. A trial balance would still balance.
4. **No way to correct a paid slip (§4.5).** The refund/payment-reversal flow the code
   defers to does not exist. A wrong detention figure, an overpayment or a slip against the
   wrong challan becomes a manual journal that leaves the slip state and its allocations
   wrong. This risk grows the moment LDC is used in anger.
5. **No fraud control on the broker's claim (G4).** `min(claim, slab)` bounds the claim by a
   rate card, not by what was received. `CONTEXT.md` §5.2 records that broker claims are
   "often inflated" and that the supervisor ack exists to catch it. Shortage and damage —
   the heads that recover money from a broker who lost goods — cannot be charged at all
   today (G5).
6. **Cross-year reversal misreporting (D-5).** A cancelled LDC slip from a closed year
   posts a contra tagged to the old `fyCode` but dated today, so date-filtered and
   FY-filtered reports disagree.
7. **No integration test covers any of this.** All 246 tests pass; every accounting test is
   a pure-function test. The advance defect and the claim-fallback defect would both be
   caught by one integration test each.

---

## 9. Recommended first implementation phase

**Phase L0, as three separate small changes — and nothing else.**

| | Change | Why it qualifies |
|---|---|---|
| **L0-1** | **G6** — make the broker's claim explicitly nullable; server falls back to the slab when absent | A confirmed defect reachable through the API today. No business question, no schema change, no migration, no new permission. Removes risk #2's worst half outright |
| **L0-2** | **D-5** — settle the reversal `fyCode`/date rule | Ten lines, no decision needed beyond picking the convention, and it must land before L3/L4 add more reversible postings |
| **L0-3** | **G2, display half only** — carry `warnings[]` onto the slip line DTO, render them on the slip detail, reuse `DetentionBreakdownDialog` on the detail page | Closes the maker/checker blindness that makes risk #2 invisible. Display-only, so it needs no answer to Q3 and cannot change an amount |

**Why this first, rather than G1 (the double-payment risk):** G1 is the bigger money risk,
but it is **blocked on Q1** — I will not guess which `paymentBy` values mean "we owe the
broker," and guessing wrong either blocks legitimate payments or permits the double payment
it is meant to stop. L0 needs no answers at all. **Ask Q1 and Q5 now**, in parallel with
L0, so L1 and L3 can start the moment the answers land.

**Also recommended in parallel, outside this plan:** audit **D-1** (credit/debit note
allocations). It is higher severity than anything here, shares no files with LDC, and can
be done by someone else concurrently.

**Explicitly not in the first phase:** G3 (needs Q5–Q7), G4 (needs Q8–Q10 and is a module),
G5 (needs Q11), G2's blocking rules (need Q3), and any historical correction whatsoever.

---

## 10. Verification record

Everything asserted about the current implementation was read from source on 2026-11-06 on
branch `ERP-79/LDCBrokerPaymentAndDetentionSlabs`, including uncommitted working-tree
changes.

| Checked | How |
|---|---|
| `LDC_WORKFLOW_PLAN.md` never existed | `git log --all -- <path>`, 21 branches, 2 stashes, `--diff-filter=A` sweep |
| The seven unknowns | `prisma/ldc-inventory.ts` docstrings, read in full |
| No `DCAcknowledgement` / `DCApproval` model | `grep "model DCAck\|model DeliveryChallanAck\|DCApproval" schema.prisma` → empty |
| `DeliveryChallanStatus` = DRAFT/ISSUED/CANCELLED only | `schema.prisma:4192-4196` |
| `damagePaise` exists; shortage/parking/other/labour do not | `schema.prisma:3389-3430` |
| `paymentBy` used in no logic | `grep paymentBy` across server, web, validators |
| Advance never disbursed anywhere | `grep advanceAmount` / `marketAdvanceAmount` across server |
| Advance defect spans TRANSPORTER too | `transporter-truck.ts:127`, `transporter.ts:97` |
| `moneyPaise` defaults to `0n` | `packages/validators/src/accounts/vendor-payment.schema.ts:33` |
| Wizard pre-fills the claim with the slab | `LDCSlipWizard.tsx:76-79` |
| Warnings absent from the slip detail | `VendorPaymentSlipDetailPage.tsx:357-389` |
| Breakdown dialog wizard-only | `grep DetentionBreakdownDialog` → `LDCSlipWizard.tsx:699` |
| No-house-slab is deliberate | `detention-slab.schema.ts:131-134` |
| Refund/payment-reversal flow does not exist | `grep -rn "refund" modules/vendor-payment/` → two error strings |
| Report date locked once claimed | `lr-delivery.route.ts:122-163` |
| Tests and typecheck | `pnpm --filter @skerp/server test` → 246 pass; `pnpm check-types` → 9/9 |
| Live data magnitudes | **Not checked** — no DB access. Use `pnpm --filter @skerp/server ldc:inventory` |

**Not verified:** every live-data figure (NULL `paymentBy` counts, the advance-recovery
balance, challans without unloading dates, slab coverage). The inventory script answers all
of them read-only and should be run before L1 and L3 are scheduled.

---

## 11. Consistency record — cross-check against the Accounts audit

Performed 2026-11-06 against [`ACCOUNTS_AUDIT_2026-11-06.md`](./ACCOUNTS_AUDIT_2026-11-06.md).
Both documents were edited to resolve what follows; **no source code, schema, migration or
accounting logic was touched, and no question was closed.**

### 11.1 Accounting flow — verified identical

| Element | Audit | This plan | Status |
|---|---|---|---|
| **LDC accrual debits** | `Dr FREIGHT_EXPENSE`, `Dr DETENTION_EXPENSE` (§C diagram; D-2 worked example) | §1.4, same two heads | **Match** |
| **LDC accrual credits** | `Cr TRANSPORTER_ADVANCE_RECOVERY`, `Cr TDS_PAYABLE`, `Cr payee = net` + `NEW_REF` | §1.4, identical | **Match** |
| **Worked example** | freight ₹1,00,000 + detention ₹5,000 − advance ₹20,000 − TDS ₹1,050 = ₹83,950 | §1.3 formula reproduces it exactly | **Match** |
| **TDS basis** | On the **gross** payable (`freight + detention`), `Cr TDS_PAYABLE`, matching legacy `NetAmt = TotalFreightPayable − TDS` | §1.3 `TDS(gross × tdsRateBps)`; §1.4 `Cr TDS_PAYABLE` | **Match** |
| **Disbursement** | `Dr payee / Cr funding Cash-Bank` + `AGAINST_REF` (slip, paid), one voucher per disbursement, `sourceId` = disbursement id | §1.4 and §5 step 11, identical | **Match** |
| **Allocation model** | Accrual opens `NEW_REF` on the slip for `netPayable`; each disbursement closes `AGAINST_REF` for its amount | §1.4, §5 steps 10–11 | **Match** |
| **Reversal symmetry** | Lines swapped, allocations mirrored `NEW_REF ↔ AGAINST_REF`, at-most-once via `reversesId @unique` | §4.5 "Working" list | **Match** |
| **Idempotency** | `existingAccrualJournalEntryId` / `existingSettlementJournalEntryId`; `clientRequestId` unique with P2002 fall-back | §1.2 and §4.5 | **Match** |
| **Advance treatment** | D-2 + E-1: Options A/B/C, **A recommended, PROPOSED NOT APPROVED**, Q5 governs | §3 G3: same three options, same letters, A marked recommended/proposed | **Match** (aligned on cross-check) |
| **Per-slip reconcile identity** | §H-3 `Σ NEW_REF − Σ AGAINST_REF = netPayablePaise − paidPaise` | §4.2, same identity | **Match** |
| **Wrong-side GL check** | §H-5; now also in P0-4's first cut | §4.2 and L3-3 | **Match** (aligned) |

### 11.2 Findings in both documents

D-2 / E-1 (advance credit with no debit) · D-5 (reversal `fyCode` vs `voucherDate`) ·
F-12 (DC ack + approval stage missing, and the deduction heads that depend on it) ·
F-4 / §H identities (no runtime reconcile) · the detention-slab and accrual/disbursement
behaviour confirmed correct in both.

### 11.3 Findings only in the Accounts audit *(not LDC — do not pull into this plan)*

D-1 (CN/DN allocation), D-3 (credit-note race), D-4 (`chargeMechanism` in the tax-rule
lookup), D-6 (manual cash adjustments unposted), D-7 (Day Book truncation), D-8 (rail rake
payments unposted), D-9 (Tally UI-only), D-10 (branch scoping on five ledger reads), D-11
(stale customer-ledger endpoint), D-12 (documentation defects), E-2 (credit-note GST),
E-3 (`paidAmountPaise` naming), E-4 (receipt-cancel status), E-5 / F-5 (on-account
receipts), F-1 (Trial Balance), F-2 (GL ledger), F-3 (party opening balances), F-6 (Tally),
F-7 (period close), F-8/F-9 (immutability, balanced-voucher constraint), F-10 (reverse
charge), F-11 (TDS reporting), F-13–F-15 (report surface).

**§4.3 of this plan already states that D-1 and E-2 share no files with the LDC work and
can proceed in parallel.** That remains the position.

### 11.4 Findings that were only in this plan — now added to the audit

| Finding | Was | Now |
|---|---|---|
| Paid-slip correction / refund flow does not exist, though two code paths defer to it | §4.5 only; the audit mentioned it merely as a *missing test* (§H "Payment reversal") | Audit **D-13** (High), scheduled **P1-10** |
| `moneyPaise` defaults to `0n`, so an omitted `detentionPaise` pays zero under `min(claim, slab)` | G6 only; absent from the audit entirely | Audit **D-14** (High), scheduled **P0-7** |

Both were found while tracing the LDC chain after the audit was written. They are
vendor-payment-module defects, so the audit is their proper home; this plan keeps the
specification.

### 11.5 Contradictions found and resolved

| # | Contradiction | Resolution |
|---|---|---|
| 1 | Audit F-12/P1-9 said **five** missing deduction heads; this plan said **four** columns | Both true, stated differently. Both documents now say **five heads unavailable, four columns to add** — `damagePaise` exists but is zeroed for LDC by `ZERO_LINE_COMPONENTS` |
| 2 | Audit D-2 presented the hand-over posting as "the correct treatment" with an alternative; this plan presented A/B/C neutrally. Read together, the audit looked like a decision | Both now use the same **A/B/C** letters, with **A as a recommendation explicitly marked PROPOSED, NOT APPROVED**, and **Q5 named as governing** in both |
| 3 | Audit E-1 used generic ledger names (`Dr Transporter Advance / Cr Bank`); this plan used the real codes | Audit E-1 rewritten with the real codes (`TRANSPORTER_ADVANCE_RECOVERY`, funding Cash-Bank) |
| 4 | This plan's G3 Option C cited "§4.4 identity 5" — §4.4 is the posting section; the identities are in §4.2 here and §H in the audit | Corrected to "§4.2 below; identity **5** in the audit's §H list" |
| 5 | Audit P0-4 scoped the reconcile job to identities 1, 2, 3, 6 — omitting identity 5, the one it elsewhere says "would have flagged D-2 immediately" — while this plan's L3-3 included it | Audit P0-4 now includes identity **5**, with the reason stated |

**No contradictory accounting entry was found.** Every debit and credit, in every voucher
type this plan touches, matched between the two documents before editing; the five items
above are scoping, naming and cross-reference defects.

### 11.6 One substantive point surfaced by the cross-check

The seven vendor GL codes already in production use are themselves documented in-source as
**placeholders awaiting Accounts' written sign-off** (`posting.service.ts:1308-1313`,
`seed-ledger.ts:127-131`). This plan proposes three more (G5). **Q11 therefore covers ten
codes, not three** — recorded in G5. No audit finding covered this; it follows from reading
the two documents together.

### 11.7 Verdict

**The two documents can be used together as the implementation blueprint, with one rule:**
the audit is the register of *findings and severity*; this plan is the *specification and
sequence* for the LDC subset; and **where this plan raises a question (Q1–Q15), that
question governs over any treatment either document recommends.** No accounting treatment
in either file is approved.

Division of labour, after the cross-check:

- **Receivable side** — audit D-1, D-3, D-4, E-2 and the report gaps. Not in this plan.
  Independently shippable.
- **Payable / LDC side** — this plan's L0–L5. Audit D-13 and D-14 now carry the findings
  for two of its items.
- **Shared infrastructure** — D-5 (reversal dating, audit P0-6 = this plan's L0-2), the
  reconcile job (audit P0-4, including identity 5), and the advance treatment (audit
  D-2/E-1 = this plan's G3/L3), which must be implemented once for TRANSPORTER and
  LDC_BROKER together.
