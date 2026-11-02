# Jira: Claims / Damage Settlement

> Paste-ready Jira content. **One epic**, nine stories.
> Each `### C1 …` block is one Jira Story: copy its Summary, Description and Acceptance Criteria.
> Replace `ERP-?` with real keys once created. Story points are relative (Fibonacci).
>
> Labels to apply: `claims`, plus `phase-1` … `phase-4`.
> Source: `docs/ERP_MODULE_PLAN_V2.md` §7.1.

---

## Background

When goods arrive damaged or short, SK pays the customer for the loss and tries to recover it from whoever
caused it: insurance, the transporter/broker, the driver, the labour gang, or the railway.

Today the ERP records damage in **three places that don't know about each other**:

| Where damage is recorded | Field | What happens to the money today |
| --- | --- | --- |
| LR acknowledgement (signed copy) | `LRAcknowledgement.damageAmount`, `LRAcknowledgementItem.damagedQty` / `receivedQty` | Deducted from the **transporter slip** (`VendorPaymentSlipLine.damagePaise`) → `DAMAGE_RECOVERY` |
| GRN at railhead / branch | `GRN.damageQty` / `shortageQty` / `damagesBy`, `RailBranchGRN.totalDamageQty` / `totalShortageQty`, `RailBranchGRNItem` | Quantity only. No money, no follow-up |
| Customer receipt | `ReceiptAllocation.damageAmountPaise` | Customer short-pays the bill → `DAMAGE_DEDUCTION` expense |

There is no single record that says *"LR 1234: 5 cartons damaged, customer claimed ₹40,000, we settled
₹35,000, recovered ₹20,000 from insurance and ₹10,000 from the broker, net loss ₹5,000."* Nobody can see
open claims, what's still to be recovered, or the real cost of damage per transporter or route.

**Epic C** adds a **Claim**: one record per damage/shortage event that links those three places together,
tracks recovery from each responsible party, and posts the right vouchers.

---

## Phase plan

| Phase | Goal | Stories | Exit criteria |
| --- | --- | --- | --- |
| **1 · Record claims** | Every damage/shortage becomes a visible claim | C1, C2, C3, C4 | Ack or GRN with damage → pending claim appears in the register; operator can assess and settle it |
| **2 · Recover the money** | Track recovery per party; post vouchers | C5, C6 | Insurance/driver/other recovery recorded and posted; net loss shown per claim |
| **3 · Deduct from vendors** | Broker/transporter recovery reduces their payable | C7 | Approved broker recovery appears as a deduction on that transporter's next slip |
| **4 · Visibility** | Reports and alerts | C8, C9 | Claim register export; ageing; alerts for new and stale claims |

**Dependencies**

- **C7 starts only after the LDC broker payment work is merged.** It touches `vendor-payment` and
  `ledger/posting.service.ts`, the same files as LDC.
- C1–C6 and C8–C9 don't depend on LDC and can start now.

**Definition of Done (all stories):** `pnpm check-types`, `pnpm lint`, `pnpm build` pass. Follows
`llm-guideline/design.md` (tokens only, 6px radius, `Table`/`Skeleton`/`Pagination` primitives, one primary
button per view). Every route is permission-gated on the server and branch-scoped with `branchFilter(req)` /
`assertBranchAccess`. Money is `BigInt` paise. No `any`. Zod schemas live in `@skerp/validators`.
Multi-step writes follow the transaction rules in `CLAUDE.md` (reads before the transaction, writes only
inside it).

---

## Open questions (answer before C5 / C7)

Ask the owner and the accountant. The stories note which answer they depend on.

1. **Who can approve a settlement amount**, and is there a limit above which a manager must approve?
2. **Insurance:** which company/policy? Is the recovery booked when *filed* or only when the money is
   *received*? Do we need a new ledger (e.g. `INSURANCE_CLAIM_RECEIVABLE`)?
3. **Customer settlement:** is it always a short-payment on a receipt (today's `damageAmountPaise`), or
   also a **credit note** or a **cash payment** to the customer?
4. **Broker/transporter recovery:** deducted from their **next slip**, or a **separate debit note** they
   pay back? Today the LR ack damage is already deducted from the transporter slip, so how do we avoid
   deducting it twice? (See C7.)
5. **Driver recovery:** deducted from the **salary run**? In one go or in instalments?
6. **Labour and railway:** do we ever actually recover from them, or is that just recorded as the cause?
7. **Minimum amount:** should tiny damages (e.g. under ₹500) skip the claim flow?

---

# EPIC C: Claims / Damage Settlement (ERP-?)

**Summary:** Record every damage/shortage as a claim, track settlement with the customer and recovery from
the responsible parties, and post the vouchers.

**Description**

Give operations and accounts one place to answer: *Which LRs had damage or shortage? What did the customer
claim and what did we settle? Who caused it? How much have we recovered, from whom, and what is our net
loss?*

A claim starts **automatically** from damage/shortage on an LR acknowledgement or GRN, or **manually** when
a customer reports it. It moves `PENDING → ACTIVE → SETTLED` (or `REJECTED`). Recovery is split across
parties (e.g. 60% insurance + 40% broker). Net loss = settled amount − approved recoveries.

**Out of scope (v1):** customer portal; automatic insurance filing; the Customer Complaint module (a
complaint may later link to a claim, but that is a separate epic).

---

### C1 · Claims foundation (Phase 1, 5 pts)

**Summary:** Data model, numbering, permissions, validators and module skeletons for Claims.

**Description**

- Prisma models in `apps/server/prisma/schema.prisma` + migration:
  - `Claim`: `claimNumber`, `lrId`, `branchId`, `customerId`, `claimType` (`DAMAGE | SHORTAGE | LOSS`),
    `origin` (`LR_ACK | GRN | RAIL_BRANCH_GRN | MANUAL`), `originRefId`, `causedBy` (reuse `GRNDamagesBy`
    values: `TRANSPORTER | LABOUR | RAILWAY | CUSTOMER | UNKNOWN`, plus `DRIVER`, `INSURED_EVENT`),
    `damagedQty`, `shortageQty`, `goodsValuePaise`, `claimedAmountPaise`, `settledAmountPaise`,
    `basisDescription`, `status` (`PENDING | ACTIVE | SETTLED | REJECTED | CANCELLED`), `settledAt`,
    `rejectedReason`, `version`, `createdById`, `createdAt`, `updatedAt`, `deletedAt`.
  - `ClaimItem`: `claimId`, `lrGoodsId`, `damagedQty`, `shortageQty`, `valuePaise` (per goods line).
  - `ClaimRecovery`: `claimId`, `source` (`INSURANCE | TRANSPORTER | DRIVER | LABOUR | RAILWAY | OTHER`),
    party FK (`transportId` / `driverId` / `labourId`, nullable), `partyName` (for insurance/other),
    `amountPaise`, `status` (`FILED | APPROVED | RECEIVED | REJECTED`), `referenceNo`, `journalEntryId`.
  - `ClaimEvent`: timeline row (`claimId`, `type`, `fromStatus`, `toStatus`, `note`, `actorId`, `at`),
    same pattern as the Order/LR events.
- Unique constraint: one open claim per `(origin, originRefId)` so auto-create is idempotent.
- Numbering via `DocumentSequence` (`docType = "CLAIM"`, e.g. `SKT/CLM/<branch>/<fy>/0001`).
- Permissions in `packages/types/src/permissions.ts`: `claim.view`, `claim.create`, `claim.update`,
  `claim.settle`, `claim.recovery`, `claim.approve`, plus labels in `permission-labels.ts`. Seed to Admin,
  Branch Manager (all), Operations (view/create/update), Accounts (view/settle/recovery), Auditor (view).
- Zod schemas in `packages/validators/src/claims/claim.schema.ts` + subpath export
  `@skerp/validators/claims/claim`.
- Server: `apps/server/src/modules/claim/claim.route.ts` (bespoke router, not `createCrudRouter`: this is
  transactional). Mount at `/claims` in `apps/server/src/index.ts`.
- Web: `apps/web/features/claims/` with `index.ts`, `claim.service.ts`, `claim.keys.ts`; route
  `app/(dashboard)/claims/page.tsx`; sidebar entry under **Operations** (gated by `claim.view`).

**Acceptance criteria**

- [ ] Migration applies cleanly on a copy of the current DB; `pnpm db:generate` succeeds.
- [ ] Permissions appear in **Settings → Roles** after re-running the seed.
- [ ] `/claims` route returns 403 without `claim.view`; the menu item is hidden without it.
- [ ] Claim numbers are sequential per branch + financial year.
- [ ] No imports from other feature folders' internals (only their `index.ts`).

---

### C2 · Auto-create claims from damage and shortage (Phase 1, 5 pts)

**Summary:** Create a `PENDING` claim automatically when an LR acknowledgement or GRN records damage or
shortage.

**Description**

Hook into the existing writes. Don't change their behaviour, just add the claim after they commit:

| Trigger | Condition | Origin |
| --- | --- | --- |
| LR acknowledgement saved | any `LRAcknowledgementItem.damagedQty > 0`, or `receivedQty <` booked qty, or `damageAmount > 0` | `LR_ACK` |
| GRN at railhead submitted | `GRN.damageQty > 0` or `shortageQty > 0` | `GRN` |
| Branch GRN submitted | `RailBranchGRN.totalDamageQty > 0` or `totalShortageQty > 0` | `RAIL_BRANCH_GRN` |

- Fill `damagedQty`, `shortageQty`, `ClaimItem` rows, `causedBy` (from `GRN.damagesBy` where present), and
  `claimedAmountPaise` from `LRAcknowledgement.damageAmount` when present (else 0, for the operator to fill).
- **Idempotent:** editing the same ack/GRN updates the existing `PENDING` claim, never creates a second.
  If the claim is already `ACTIVE` or later, don't overwrite it; add a `ClaimEvent` note
  "Source document changed after assessment" instead.
- If the damage is removed (edited back to 0) and the claim is still `PENDING` → auto-`CANCELLED` with an event.
- Run the claim write **after** the source transaction commits, so a claim failure never blocks saving an ack/GRN.
  Log failures.
- Notify the branch's users with `claim.update` (Notifications module): "New claim CLM-0001 on LR 1234".

**Acceptance criteria**

- [ ] Ack with 5 damaged cartons → one `PENDING` claim with the right LR, branch, customer, qty.
- [ ] Editing that ack to 7 cartons updates the same claim; no duplicate.
- [ ] Editing it back to 0 cancels the pending claim.
- [ ] A road + rail LR with damage at the GRN **and** at the ack creates **two** claims (different origins)
      that both show on the LR.
- [ ] Saving an ack still works if the claims module throws.
- [ ] Unit tests for the trigger conditions (what counts as damage/shortage).

---

### C3 · Claims register and detail page (Phase 1, 8 pts)

**Summary:** List of claims with filters, and a detail page with goods, timeline and attachments.

**Description**

- **Register** (`/claims`): `Table` with Claim No, Date, LR No, Customer, Branch, Type, Caused by,
  Claimed, Settled, Recovered, Net loss, Status. Filters: status, type, branch, customer, caused by, date
  range, search (claim no / LR no). Server-side pagination (`Pagination`) and sort. Status badges.
- **Summary strip** at the top: counts and amounts by status (click to filter).
- **Detail** (`/claims/[id]`): header with status + actions; goods table (`ClaimItem`); amounts
  (claimed / settled / recovered / net loss); recovery table (from C5); **timeline** (`ClaimEvent`);
  **attachments** (photos, customer claim letter, surveyor report) via the Attachments module.
- Link out to the LR, the ack/GRN that created it, and (later) the receipt/credit note and slips.
- Show a "Claims" section on the **LR detail page** listing that LR's claims (through the claims feature's
  public `index.ts`).
- Branch-scoped: users only see their branches' claims.

**Acceptance criteria**

- [ ] Register paginates on the server; filters combine; skeleton rows while loading.
- [ ] Detail shows the full timeline in order with actor and time.
- [ ] Photos can be attached and viewed on the claim.
- [ ] LR detail shows its claims with links.
- [ ] A Branch Manager of branch A can't open a claim of branch B (403 from the server, not just hidden).

---

### C4 · Manual claim, assessment and settlement (Phase 1, 5 pts)

**Summary:** Create a claim by hand, assess it, and settle or reject it with the customer.

**Description**

- **New claim** (`claim.create`): pick LR → goods lines → type, qty, goods value, claimed amount, caused
  by, basis, attachments. Origin `MANUAL`. For a customer letter that arrives without an ack/GRN record.
- **Assess** (`claim.update`): `PENDING → ACTIVE` once goods value, claimed amount and caused-by are
  filled. Edits use optimistic locking (`version`).
- **Settle** (`claim.settle`): enter settled amount (≤ claimed), settlement date and **how** the customer
  is settled (depends on open question 3):
  - **Deducted on receipt:** link to the `ReceiptAllocation` whose `damageAmountPaise` covers it. No new
    voucher (the receipt already posted `DAMAGE_DEDUCTION`).
  - **Credit note:** link to an existing credit note on the bill.
  - **Paid separately:** record mode/date. Posts Dr `DAMAGE_DEDUCTION` / Cr Bank or Cash.
  → `SETTLED`.
- If settled amount > the approval limit (open question 1), require `claim.approve` from a second user.
- **Reject** with a reason → `REJECTED`. **Cancel** (only `PENDING`/`ACTIVE`, no settlement yet).
- Every transition writes a `ClaimEvent`.

**Acceptance criteria**

- [ ] Manual claim can be created on any delivered LR the user's branch can see.
- [ ] Can't settle without goods value and caused-by filled.
- [ ] Settled amount > claimed is refused by the server (not just the form).
- [ ] Linking a receipt allocation that's already linked to another claim is refused.
- [ ] Above-limit settlement waits for a second approver; the same user can't approve their own.
- [ ] "Paid separately" posts a balanced voucher visible in the Day Book.

---

### C5 · Recovery lines (Phase 2, 8 pts)

**Summary:** Record and track recovery from insurance, driver, labour, railway or others, split across parties.

**Description**

- On an `ACTIVE` or `SETTLED` claim, add **recovery lines** (`claim.recovery`): source, party, amount,
  reference (insurance claim no / debit note no), attachments.
- Lifecycle per line: `FILED → APPROVED → RECEIVED` (or `REJECTED`). Each step writes a `ClaimEvent`.
- Total of non-rejected recoveries ≤ settled amount (or claimed amount if not yet settled). Warn,
  don't block, if recoveries < settled (that's the net loss).
- **Vouchers** (posting functions in `ledger/posting.service.ts`, one per pattern, depends on open
  question 2):
  - Insurance `RECEIVED`: Dr Bank / Cr `DAMAGE_RECOVERY`. (Or accrual at `APPROVED` if the accountant wants
    a receivable.)
  - Other party `RECEIVED` in cash: Dr Cash/Bank / Cr `DAMAGE_RECOVERY`.
  - Transporter/broker lines are **recorded** here but **deducted** in C7.
  - Driver lines are recorded here and deducted in C6.
- Show per claim: **Net loss = settled − (approved + received recoveries)**.

**Acceptance criteria**

- [ ] 60% insurance + 40% broker split can be recorded on one claim.
- [ ] Recoveries exceeding the settled amount are refused by the server.
- [ ] Insurance `RECEIVED` posts a balanced voucher; rejecting a line before it's received posts nothing.
- [ ] Net loss updates on the detail page and register.

---

### C6 · Driver recovery through salary (Phase 2, 3 pts)

**Summary:** Deduct an approved driver recovery from the driver's salary run.

**Description**

Depends on open question 5.

- An `APPROVED` driver recovery line appears as a pending deduction on that driver's next **Salary Run**
  (`driver-finance`), with the claim number as the reference.
- Support instalments if the business wants them (split across N months).
- When the salary run is paid, mark the recovery line `RECEIVED` and link the voucher.
- Removing the deduction from a draft salary run puts it back to pending.

**Acceptance criteria**

- [ ] Approved driver recovery shows on the next salary run for that driver only.
- [ ] Paying the run marks the recovery received; the claim's net loss updates.
- [ ] A recovery can't be deducted twice across two runs.

---

### C7 · Broker / transporter recovery on vendor payment (Phase 3, 8 pts)

**Summary:** Approved transporter/broker recovery reduces their payable through the vendor-payment slip.

**Description**

**Starts after the LDC broker payment work is merged** (same files).

Depends on open question 4. Today the transporter slip **already** deducts `LRAcknowledgement.damageAmount`
(`calculators/transporter-truck.ts`). The claim must not deduct the same damage a second time.

- **Rule:** if the claim's origin is `LR_ACK` and the slip line already carries that ack's `damagePaise`,
  the recovery is marked `RECEIVED` automatically when that slip is approved (no second deduction).
  Otherwise (GRN damage, manual claim, or an amount higher than the ack's), the approved recovery appears
  as a **claim deduction** on the transporter's next slip (`TRANSPORTER` or `LDC_BROKER`).
- Server re-derives the deduction (never trusts the client amount), same as the existing calculators.
- A recovery line can sit on only one active slip (same claim-lock pattern as `calculators/claims.ts`).
- On slip approval/posting: Dr Transporter / Cr `DAMAGE_RECOVERY`; mark the recovery `RECEIVED`.
- Cancelling or rejecting the slip releases the recovery back to `APPROVED`.
- Alternative if the business prefers a **debit note**: a standalone voucher Dr Transporter / Cr
  `DAMAGE_RECOVERY` at approval, settled by their next payment. Agree before building.

**Acceptance criteria**

- [ ] LR-ack damage of ₹5,000 deducted on the transporter slip **is not** deducted again by the claim.
- [ ] A GRN-origin broker recovery of ₹10,000 shows as a deduction on the broker's next slip.
- [ ] The same recovery can't appear on two active slips.
- [ ] Rejecting the slip releases the recovery; it shows on the next slip instead.
- [ ] Transporter ledger shows the deduction once, with the claim number in the narration.

---

### C8 · Claims reports and export (Phase 4, 3 pts)

**Summary:** Claim register export, ageing, and damage cost by transporter / route / customer.

**Description**

- **Export** the filtered register to CSV/XLSX.
- **Ageing:** open claims by days since created (0–15, 16–30, 31–60, 60+).
- **Damage cost summary:** settled, recovered and net loss grouped by caused-by, transporter, route
  and customer, for a date range.
- Add a "Claims" widget to the dashboard: open count, pending settlement amount, net loss this month
  (gated by `claim.view`).

**Acceptance criteria**

- [ ] Export matches the on-screen filters and totals.
- [ ] Ageing buckets add up to the open-claim count.
- [ ] Summary totals reconcile with the sum of individual claims for the same range.

---

### C9 · Claim alerts (Phase 4, 2 pts)

**Summary:** Notify about new, stale and high-value claims.

**Description**

- New claim → branch users with `claim.update` (built in C2; here make it configurable in notification
  preferences).
- Claim still `PENDING` after 7 days, or `ACTIVE` after 30 days → reminder to the branch manager
  (daily sweep, same pattern as `driver.sweeps.ts`).
- Claimed amount above a threshold → alert to Admin/Accounts.

**Acceptance criteria**

- [ ] Users can turn claim alerts on/off in their notification preferences.
- [ ] Stale-claim reminder fires once per day per claim, not repeatedly.
- [ ] Thresholds and day limits are config values, not hardcoded.

---

## Test scenario (end to end, for QA)

1. Road LR, market truck, 100 cartons. Ack records **5 damaged**, damage amount ₹5,000.
   → Claim `PENDING` auto-created.
2. Operator fills goods value ₹40,000, claimed ₹40,000, caused by **Transporter** → `ACTIVE`.
3. Customer pays the bill short by ₹35,000 (receipt damage deduction). Link it → settled ₹35,000 → `SETTLED`.
4. Recovery: insurance ₹20,000 (`FILED → APPROVED → RECEIVED`), transporter ₹15,000 (`APPROVED`).
5. Transporter slip: ₹5,000 already deducted via the ack + ₹10,000 extra claim deduction. **Total ₹15,000, not ₹20,000.**
6. Claim shows: settled ₹35,000, recovered ₹35,000, **net loss ₹0**. Day Book has every voucher, balanced.
