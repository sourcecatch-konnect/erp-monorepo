# Accounts — Double-Entry Ledger & Voucher Layer (Build Plan)

> **Status:** Phases 1–4 (ledger core, billing integration, receipt
> integration, Chart of Accounts / Manual Journal / Day Book) **implemented**
> in code and migrated. Phase 5 (Tally sync + report-view migration) not
> started.
> Supersedes the "greenfield" framing in [`ACCOUNTS_MODULE_MAP.md`](./ACCOUNTS_MODULE_MAP.md)
> §3/§4 — Billing, Receipts and a single-entry `LedgerEntry` log **already exist**.

## Implementation status (2026-09-04)

| Piece | State |
| --- | --- |
| Prisma models `Ledger` / `JournalEntry` / `JournalLine` / `LedgerAllocation` + enums + `Bill.journalEntryId` | schema written, `prisma generate` done; **migration `20260904000000_add_double_entry_ledger` written but NOT applied** (live DB) |
| `prisma/seed-ledger.ts` (GL + bank/cash ledgers) + wired into `seed-admin.ts` | done — **not run** |
| `modules/ledger/posting.service.ts` — `getGLLedger` / `getCashLedger` / `getOrCreatePartyLedger` / `postJournal` / `postSalesVoucher` / `reverseJournal` | done |
| Billing `POST /bills/:id/finalise` → posts SALES voucher atomically | done |
| Billing `POST /bills/:id/cancel` → `reverseJournal` when a voucher exists | done |
| `GET /billing/bills/:id/voucher` + `journalEntry` on bill detail / list includes | done |
| Web: Accounting panel + View-voucher dialog on Bill Detail, Accounting column on Bill List | done |
| Permissions `ledger.voucher_view` / `ledger.manage` / `ledger.journal_create` + seed grants | done |
| **To apply:** `pnpm --filter @skerp/server db:migrate` (or `db:deploy`), then `pnpm --filter @skerp/server exec tsx prisma/seed-ledger.ts` | — |
| `Receipt.journalEntryId` (mirrors `Bill.journalEntryId`) | schema written, `prisma generate` done; **migration `20260905000000_add_receipt_journal_entry` written but NOT applied** |
| `posting.service.ts` — `postReceiptVoucher` (Dr Bank/TDS/Damage/RateDiff, Cr customer, one `AGAINST_REF` per bill) | done |
| `posting.service.ts` — `reverseJournal` generalized to mirror **any** allocation's `refType` symmetrically (`NEW_REF ↔ AGAINST_REF`), not just `NEW_REF` — needed so cancelling a receipt re-opens the bill's outstanding correctly | done |
| Receipt `POST /` (instant-post path) → posts RECEIPT voucher atomically | done |
| Receipt `POST /:id/approve` (deferred-post path, when a receipt held deductions) → posts RECEIPT voucher atomically | done |
| Receipt `POST /:id/cancel` → `reverseJournal` when a voucher exists | done |
| `GET /receipt/:id/voucher` + `journalEntry` on receipt detail / list includes | done |
| Voucher number = `receipt.receiptNumber` (reused, no separate `RV` series — same 1:1 pattern as SALES reusing the bill number) | decided + implemented |
| Web: `VoucherDialog` / `JournalStatusBadge` promoted from `features/billing/components/` to shared `features/ledger/` (`voucher.types.ts`, `voucher.util.ts`, `components/`); billing re-exports the types from there for compatibility | done |
| Web: Accounting card + View-voucher dialog on Receipt Detail page | done |
| **Not yet built:** auto-fill lump-sum allocation on the Receipt create screen (type one total, oldest-bill-first auto-split); Accounting/voucher-status column on the Receipt register list | — |

### Phase 4 — Chart of Accounts / Manual Journal / Day Book (2026-09-05)

No schema change — all three reuse the existing `Ledger` / `JournalEntry` /
`JournalLine` tables from Phase 1.

| Piece | State |
| --- | --- |
| `GET/POST /ledger/accounts`, `PATCH /ledger/accounts/:id` — browse/search the chart of accounts, create a manual GL head, edit name/group/code/active flag | done |
| `POST /ledger/journal` — free-form Manual Journal voucher via the existing `postJournal`; numbered with its own `DocumentSequence` docType `JV` (prefix `SKT/JV`) since a manual journal has no other natural document number | done |
| `GET /ledger/day-book` — all vouchers for a date/range, any type, with branch/voucherType filters | done |
| `GET /ledger/vouchers/:id` — generic voucher view for any `JournalEntry` (used by Day Book row-click and the Manual Journal success dialog); Bill/Receipt keep their own scoped `.../voucher` routes | done |
| Web: `ChartOfAccountsPage`, `ManualJournalPage`, `DayBookPage` under `features/ledger/`, routed at `/accounts/chart-of-accounts`, `/accounts/journal`, `/accounts/day-book`, added to the Finance nav section | done |
| Permissions — reused existing `ledger.view` / `ledger.manage` / `ledger.journal_create` / `ledger.voucher_view`, no new grants needed | — |

### 8a-1 — Cash Planning payments → PAYMENT voucher (2026-09-06)

"Box 8" on the business-flow diagram = every money-out flow posting to the
ledger. 8a wires them one by one; 8a-1 is the Cash Planning `CashPayment`
queue, which covers the transporter / broker / hamali / workshop payments
that are all hand-keyed there.

| Piece | State |
| --- | --- |
| `CashPayment.journalEntryId` (`@unique`) + relation, migration `20260906000000_add_cash_payment_journal_entry` | schema + `prisma generate` done; **migration written, NOT applied** |
| `prisma/seed-ledger.ts` — 6 expense heads, one per `CreditorCategory` (`DIESEL_EXPENSE` / `RENT_EXPENSE` / `FREIGHT_EXPENSE` / `GENERAL_EXPENSE` / `REPAIR_EXPENSE` / `MISC_EXPENSE`) | done — **not run** |
| `posting.service.ts` — `postPaymentVoucher`: `Dr` creditor party ledger (creditor picked) **or** `Dr` the category expense GL (ad-hoc payee), `Cr` bank/cash. `voucherType PAYMENT`, `sourceType VENDOR_PAYMENT`, `sourceId` = payment id (suffixed `#2`, `#3` on re-approval so a bounced payment doesn't collide on `@@unique([voucherType, sourceType, sourceId])`) | done |
| `cash-planning.route.ts` — post on approve, reverse (`reverseJournal`) on hold/reject/un-approve and before delete-while-approved. Wired into all 3 payment transactions (single status, bulk approve, delete). `{timeout,maxWait}` budgets added | done |
| Voucher number — new `DocumentSequence` docType `PV`, prefix `SKT/PV` | done |
| Web — "View voucher" button on an approved payment row in `PaymentQueue.tsx`, reusing `VoucherDialog` + `GET /ledger/vouchers/:id` | done |
| **To apply:** run migration `20260906000000_...`, then re-run `prisma/seed-ledger.ts` | — |

**Limitation (accepted for 8a-simple):** a payment with **no branch** or **no
`fromAccountId`** gets no voucher — `JournalEntry.branchId` is required and
there is nothing to credit. Those still write the legacy `LedgerEntry` row,
same as before. The old single-entry log keeps running in parallel for every
payment regardless.

**Still open (8a-2 … 8a-4):** `TripExpense` approve, `DriverAdvance` create,
`RailRakeChargePayment` confirm — each its own separate posting call (they
bypass Cash Planning). `LogSlip` settlement journal deferred. Claims are
deductions, not disbursements — out of scope.

### Corrections applied 2026-09-04 (review round 2)

The §1 code blocks below are the original sketch. The **authoritative schema is
`apps/server/prisma/schema.prisma`**; it now differs as follows:

- `VoucherType` adds `CONTRA` and `DEBIT_NOTE`.
- `JournalStatus` is `DRAFT | POSTED | REVERSED` (no `TALLY_SYNCED`).
  `JournalEntry.status` defaults to **`DRAFT`**; the posting service flips it to
  `POSTED` only after it has validated debit == credit in one transaction.
- New `enum TallySyncStatus { NOT_SYNCED SYNCED FAILED }`; `JournalEntry` carries
  `tallySyncStatus` (default `NOT_SYNCED`), `tallySyncError`, `tallySyncAttempts`
  — sync is its own state machine, separate from the posting lifecycle.
- `JournalEntry.reversesId` is `@unique` — a voucher can be reversed at most once.
- `JournalEntry.postedBy` User relation added (`postedById` had no relation).
- `Ledger` has **no** `openingBalancePaise` / `openingBalanceSide`; `BalanceSide`
  enum dropped. Opening balances will come from a balanced Opening-Balance
  JOURNAL voucher (own phase).
- `Ledger` party FKs are `onDelete: Restrict` (never `Cascade`). No
  `@@unique([kind, name])` — party uniqueness is the party FK, GL uniqueness is
  `code`.
- Bank/Cash ledgers are `kind = GL` (linked by `cashAccountId`), not `PARTY`.
- Migration adds CHECK constraints: `JournalLine` exactly one-sided & non-negative;
  `LedgerAllocation.amountPaise > 0`.
- Vendor-payment convention (Phase 4): each PAYMENT voucher's `sourceId` is the
  individual **disbursement** id, so partial payments don't collide on
  `@@unique([voucherType, sourceType, sourceId])`.

---

## 0. What already exists (verified in repo, 2026-09)

| Area | Reality | File |
| --- | --- | --- |
| Billing | Full module. `DRAFT → PENDING_REVIEW → APPROVED → FINALISED → SENT → PARTIALLY_PAID → PAID → CANCELLED`. Finalise assigns `billNumber` (`SKT/B/<branch>/<fy>/<seq>`), recomputes tax, upserts a `CashReceivable`. | `modules/billing/billing.route.ts` `POST /bills/:id/finalise` |
| GST engine | Built — `calculateBill()`. Road → no GST; intra → CGST+SGST; inter → IGST. Rates from `BillingTaxRule` config table (basis points). Round-off to nearest rupee. | `modules/billing/billing.service.ts:469` |
| Receipts | Full module. Outstanding bills → per-bill allocation w/ `tds/damage/rateDiff` → `POSTED` (or `PENDING_APPROVAL` if any deduction). Reduces `bill.outstandingAmountPaise`, credits the cash account, writes **one** `LedgerEntry`. | `modules/receipt/receipt.route.ts` |
| "Ledger" today | `LedgerEntry` — **single-entry** money-movement log: `direction IN\|OUT`, `amountPaise`, exactly one of `cashAccountId\|customerId\|creditorId`, `sourceType RECEIPT\|PAYMENT\|ADJUSTMENT`, `sourceId`. Powers Bank/Cash/Debtor/Creditor/Expense report views as filtered reads with running balance computed at query time. **No vouchers, no Dr/Cr pairs, no chart of accounts.** | `schema.prisma:2345`, `modules/ledger/ledger.service.ts` |
| Numbering | `nextSequence(tx, branchCode, fyCode, docType)` + `formatDocNumber(...)` + `fyCodeFor(date)`. `DocumentSequence` unique on `(branchCode, fyCode, docType)`. | `modules/_shared/doc-number.ts` |
| Party masters | `Customer` (552), `Transport` (859), `Creditor` (2242), `Labour` (735), `Pump` (926). | `schema.prisma` |
| Permissions | `PERMS.BILLING.*`, `PERMS.RECEIPT.*`, `PERMS.LEDGER.VIEW` only. | `packages/types/src/permissions.ts:413` |

### Two concrete gaps this project closes
1. **Bill finalise posts nothing to any ledger** — the debtor ledger shows receipts but not the invoices that created the debt.
2. There is no bill-wise outstanding *record* — `bill.outstandingAmountPaise` is a mutated column, not an allocation trail.

### Coexistence rule
`LedgerEntry` **stays** for now — cash-planning and the 5 report views read it. The new
`JournalEntry` layer is the accounting book of record (vouchers, Tally, statutory).
Migrating the report views to read from `JournalLine` is **Phase 5**, out of scope here.
Until then, transactions write **both** (the double `recordLedgerEntry` + `postJournal`
calls sit in the same `tx`).

---

## 1. New schema

All money is `BigInt` paise (matches `Bill`, `LedgerEntry`). All ids CUID.

### 1.1 Enums

```prisma
enum LedgerKind { PARTY  GL }

enum LedgerAccountGroup {
  SUNDRY_DEBTOR
  SUNDRY_CREDITOR
  DIRECT_INCOME
  INDIRECT_INCOME
  DIRECT_EXPENSE
  INDIRECT_EXPENSE
  DUTIES_AND_TAXES
  BANK
  CASH
  CURRENT_ASSET
  CURRENT_LIABILITY
}

enum VoucherType {
  SALES
  RECEIPT
  PAYMENT
  JOURNAL
  CREDIT_NOTE
}

enum JournalStatus {
  DRAFT        // built, not in the books
  POSTED       // in the books; balances + allocations live
  TALLY_SYNCED // copy exists in Tally (tallyMasterId set)
  REVERSED     // a contra JOURNAL voucher has cancelled this one
}

enum JournalSourceType {
  BILL
  RECEIPT
  VENDOR_PAYMENT
  MANUAL
  CREDIT_NOTE
}

enum AllocationRefType {
  NEW_REF      // opens an outstanding reference (a bill)
  AGAINST_REF  // consumes one
}

enum BalanceSide { DR  CR }
```

### 1.2 `Ledger` — chart of accounts

```prisma
model Ledger {
  id                 String             @id @default(cuid())
  kind               LedgerKind
  name               String             // display + Tally name
  group              LedgerAccountGroup
  code               String?            @unique // stable key for GL lookups, e.g. "FREIGHT_INCOME"
  openingBalancePaise BigInt            @default(0)
  openingBalanceSide  BalanceSide       @default(DR)
  isActive           Boolean            @default(true)
  branchId           String?            // null = shared across branches

  // party identity — exactly one set when kind = PARTY, all null for GL
  customerId  String? @unique
  transportId String? @unique
  creditorId  String? @unique
  labourId    String? @unique
  pumpId      String? @unique
  // GL bank/cash ledgers map 1:1 to a CashAccount
  cashAccountId String? @unique

  branch      Branch?      @relation(fields: [branchId], references: [id], onDelete: SetNull)
  customer    Customer?    @relation(fields: [customerId], references: [id], onDelete: Cascade)
  transport   Transport?   @relation(fields: [transportId], references: [id], onDelete: Cascade)
  creditor    Creditor?    @relation(fields: [creditorId], references: [id], onDelete: Cascade)
  labour      Labour?      @relation(fields: [labourId], references: [id], onDelete: Cascade)
  pump        Pump?        @relation(fields: [pumpId], references: [id], onDelete: Cascade)
  cashAccount CashAccount? @relation(fields: [cashAccountId], references: [id], onDelete: Cascade)
  lines       JournalLine[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([kind, name])
  @@index([group])
}
```

### 1.3 `JournalEntry` — voucher header

```prisma
model JournalEntry {
  id            String            @id @default(cuid())
  voucherType   VoucherType
  voucherNumber String            // SALES = the bill number (1:1); others via DocumentSequence
  voucherDate   DateTime
  fyCode        String
  branchId      String
  narration     String?
  status        JournalStatus     @default(POSTED)

  sourceType    JournalSourceType
  sourceId      String
  sourceNumber  String?

  reversesId    String?           // set on a contra JOURNAL that cancels another entry
  tallyMasterId String?
  tallySyncedAt DateTime?

  createdById String
  postedById  String?
  postedAt    DateTime?
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  branch    Branch         @relation(fields: [branchId], references: [id], onDelete: Restrict)
  createdBy User           @relation("CreatedJournalEntries", fields: [createdById], references: [id], onDelete: Restrict)
  reverses  JournalEntry?  @relation("JournalReversal", fields: [reversesId], references: [id], onDelete: SetNull)
  reversedBy JournalEntry[] @relation("JournalReversal")
  lines     JournalLine[]
  allocations LedgerAllocation[]
  bill      Bill?          // back-relation; Bill.journalEntryId is the FK

  @@unique([voucherType, sourceType, sourceId])   // one primary voucher per source; contra uses sourceType MANUAL
  @@index([branchId, voucherDate])
  @@index([sourceType, sourceId])
  @@index([status])
  @@index([voucherType, fyCode])
}
```

### 1.4 `JournalLine` — the Dr/Cr lines

```prisma
model JournalLine {
  id             String  @id @default(cuid())
  journalEntryId String
  ledgerId       String
  lineNumber     Int
  debitPaise     BigInt  @default(0)
  creditPaise    BigInt  @default(0)   // exactly one of debit/credit is > 0
  narration      String?

  journalEntry JournalEntry      @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  ledger       Ledger            @relation(fields: [ledgerId], references: [id], onDelete: Restrict)
  allocations  LedgerAllocation[]

  @@unique([journalEntryId, lineNumber])
  @@index([ledgerId])
}
```

### 1.5 `LedgerAllocation` — bill-wise settlement (replaces the legacy `RefNo$Amount` string)

```prisma
model LedgerAllocation {
  id             String            @id @default(cuid())
  journalEntryId String
  journalLineId  String            // the party line that opens / consumes the ref
  billId         String
  refType        AllocationRefType
  amountPaise    BigInt
  createdAt      DateTime          @default(now())

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  journalLine  JournalLine  @relation(fields: [journalLineId], references: [id], onDelete: Cascade)
  bill         Bill         @relation(fields: [billId], references: [id], onDelete: Restrict)

  @@index([billId])
  @@index([journalEntryId])
}
```

**Outstanding for a bill** = `Σ NEW_REF.amountPaise − Σ AGAINST_REF.amountPaise` over its
allocations. `bill.outstandingAmountPaise` stays as the fast denormalised copy; the
allocation sum is the audit-grade truth and what a reconcile check compares against.

### 1.6 `Bill` additions

```prisma
  journalEntryId String?       @unique
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id], onDelete: SetNull)
```

No `accountingStatus` column — derive it from `journalEntry.status` in the detail
include. (Revisit only if a list query needs it without the join.)

---

## 2. Chart-of-accounts bootstrap

### GL ledgers — seeded (`prisma/seed-ledger.ts`, called from `seed-admin.ts`)

| `code` | `name` | `group` |
| --- | --- | --- |
| `FREIGHT_INCOME` | Freight Income | `DIRECT_INCOME` |
| `DETENTION_INCOME` | Detention Income | `DIRECT_INCOME` |
| `UNLOADING_INCOME` | Unloading / Hamali Income | `DIRECT_INCOME` |
| `FREIGHT_ADJUSTMENT` | Freight Adjustment | `DIRECT_INCOME` |
| `ROUND_OFF` | Round Off | `INDIRECT_INCOME` |
| `OUTPUT_CGST` | Output CGST | `DUTIES_AND_TAXES` |
| `OUTPUT_SGST` | Output SGST | `DUTIES_AND_TAXES` |
| `OUTPUT_IGST` | Output IGST | `DUTIES_AND_TAXES` |
| `TDS_RECEIVABLE` | TDS Receivable | `CURRENT_ASSET` |
| `DAMAGE_DEDUCTION` | Damage Deduction | `INDIRECT_EXPENSE` |
| `RATE_DIFFERENCE` | Rate Difference | `INDIRECT_EXPENSE` |

Bank/Cash GL ledgers are created from `CashAccount` rows (one `Ledger` per account,
`group = BANK\|CASH`, `cashAccountId` set) — in the same seed, plus lazily on first use.

### Party ledgers — lazy get-or-create (recommended)

`getOrCreatePartyLedger(tx, { customerId } | { transportId } | …)` in the posting
service. Idempotent (`@@unique` on each party FK). No hooks in the 5 master modules;
ledgers appear as bills/receipts/payments post. Optional one-time backfill script for
existing customers so the Chart-of-Accounts screen isn't empty on day one.

`LRChargeType` → GL `code` map lives next to the posting service:
`FREIGHT → FREIGHT_INCOME`, `DETENTION → DETENTION_INCOME`,
`UNLOADING → UNLOADING_INCOME`, `FREIGHT_ADJ_ADD → FREIGHT_ADJUSTMENT`, …

---

## 3. Posting service — `modules/ledger/posting.service.ts`

All functions take a `Prisma.TransactionClient` and **must** run inside the caller's
transaction (same rule as `recordLedgerEntry`).

```ts
getOrCreatePartyLedger(tx, ref): Promise<Ledger>
getGLLedger(tx, code): Promise<Ledger>                 // throws if seed missing

postJournal(tx, {
  voucherType, voucherNumber, voucherDate, fyCode, branchId, narration,
  sourceType, sourceId, sourceNumber, createdById,
  lines: { ledgerId, debitPaise, creditPaise, narration? }[],
  allocations?: { journalLineIndex, billId, refType, amountPaise }[],
}): Promise<JournalEntry>
// asserts Σdebit === Σcredit and every line is one-sided; creates header + lines +
// allocations; status POSTED.

postSalesVoucher(tx, bill, createdById): Promise<JournalEntry>
// Dr  customer party ledger            = bill.totalAmountPaise      + NEW_REF alloc
// Cr  income GL per line (grouped by chargeTypeSnapshot/effect)
// Cr  OUTPUT_CGST / OUTPUT_SGST / OUTPUT_IGST  from bill.taxLines
// Dr/Cr ROUND_OFF                       = bill.roundOffPaise
// voucherNumber = bill.billNumber, sourceType BILL, sourceId bill.id

postReceiptVoucher(tx, receipt, createdById): Promise<JournalEntry>   // Phase 3
// Dr  bank/cash GL (receipt.receivedIntoAccount)  = amountPaise
// Dr  TDS_RECEIVABLE / DAMAGE_DEDUCTION / RATE_DIFFERENCE  per allocation
// Cr  customer party ledger                        = total, split AGAINST_REF per bill

reverseJournal(tx, journalEntryId, reason, createdById): Promise<JournalEntry>
// creates a contra voucherType JOURNAL (lines swapped Dr<->Cr, sourceType MANUAL,
// reversesId set); marks the original status REVERSED. Used by bill cancel + credit note.
```

---

## 4. Phases

| Phase | Scope | Touches |
| --- | --- | --- |
| **1 — Ledger core** | Enums + models + migration. `seed-ledger.ts`. `posting.service.ts` (`getOrCreatePartyLedger`, `getGLLedger`, `postJournal`, `postSalesVoucher`, `reverseJournal`). No wiring yet. | `schema.prisma`, `prisma/seed-*.ts`, `modules/ledger/*`, `packages/validators/src/ledger`, `packages/types` |
| **2 — Billing integration** | `Bill.journalEntryId`. In `finalise` tx → `postSalesVoucher`; in `cancel` tx (was FINALISED+, has voucher) → `reverseJournal`. Bill detail API returns the voucher. Web: Accounting panel on Bill Detail + read-only Voucher view + Accounting column on Bill List. `PERMS.LEDGER.VOUCHER_VIEW`. | `modules/billing/billing.route.ts`, `billing.service.ts` (`billDetailInclude`), `apps/web/features/billing/*` |
| **3 — Receipt integration** | `postReceiptVoucher` + `AGAINST_REF` allocations in the receipt `POST` / `approve` / `cancel` transactions (alongside the existing `recordLedgerEntry`). Outstanding-per-bill panel reads allocations. | `modules/receipt/receipt.route.ts` |
| **4 — Chart of Accounts UI + Manual Journal + Day Book** | Ledger list/detail screens, `postJournal`-backed manual voucher screen (`PERMS.LEDGER.JOURNAL_CREATE`), Day Book (all vouchers by date). | `modules/ledger/*`, `apps/web/features/ledger/*` |
| **5 — Tally bridge + report-view migration** | `JournalEntry.tally*` sync worker + XML export. Migrate Bank/Cash/Debtor/Creditor/Expense views to read `JournalLine`; retire the parallel `LedgerEntry` writes. | later, own doc |

Credit Note screen: Phase 4+ (the `reverseJournal` + `CREDIT_NOTE` plumbing lands in Phase 1–2; the UI later).

---

## 5. Decisions locked

1. Money type: **`BigInt` paise**.
2. SALES voucher number = **the bill number** (1:1, no separate series). `RECEIPT`/`PAYMENT`/`JOURNAL`/`CREDIT_NOTE` get `DocumentSequence` docTypes `RV`/`PV`/`JV`/`CN`.
3. Finalise **and** post are one atomic action — a `FINALISED` bill always has a `POSTED` voucher; posting failure rolls back the finalise.
4. Party ledgers: **lazy get-or-create** in the posting service.
5. `LedgerEntry` kept in parallel through Phase 4; report-view migration is Phase 5.
6. GST output ledgers are **per component** (`OUTPUT_CGST/SGST/IGST`), not per rate — `BillTaxLine.rateBps` already carries the rate for Tally `BILLALLOCATIONS`.
7. `accountingStatus` is **derived** from `journalEntry.status`, not stored on `Bill`.

## 6. Open — confirm before Phase 1

- **GL account list & names** in §2 — right heads for SK Logistics? (esp. income split).
- **Backfill** party ledgers for existing customers on migration, or let them accrete lazily?
- **`onDelete: Cascade`** from party master → its `Ledger`: acceptable, or `Restrict` (a customer with ledger history can't be hard-deleted)? Masters use soft-delete, so Cascade is mostly theoretical — leaning `Restrict`.
