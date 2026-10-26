# G5 (revised) — Diesel via HPCL Fleet Wallet

Replaces the original G5 "Diesel Purchased From Pump on Credit" task.
The original assumed pump credit (pump payable, pump credit limit, PUMP vendor
payment). **SK does not buy diesel on credit.** This document describes the
real process and what the ERP must do for it.

**Status: PLANNED — build later.** Not started. Process confirmed with
operations on 2026-10-01 using a legacy Vehicle Log Slip (LOG/0208267136,
MH19CY-2711, Usman Ansari). Before starting, collect the inputs in §8.

---

## 1. How diesel is actually paid

There are exactly two ways:

### A. HPCL Fleet Wallet (prepaid, OTP)

1. SK has **one company-level account** on the HPCL fleet website. It funds
   every vehicle — there are no per-vehicle wallets.
2. A manager **tops up the wallet** from the bank.
3. At any HPCL outlet the driver gives the **mobile number of the office
   member** who manages fuel (the number registered on the HPCL wallet) — not
   the vehicle number.
4. HPCL sends the **OTP to that office member's phone**.
5. The office member tells the OTP to the driver / pump; the amount is debited
   from the wallet.

Because the pump is given a mobile number, not a vehicle number, the HPCL
transaction may **not record which vehicle took the diesel**. The ERP entry is
the only place a fill is tied to a vehicle and journey.

Only HPCL is used (no IOCL/BPCL).

### B. Cash diesel

The driver pays cash from his trip advance (Happay). The legacy log slip shows
these litres in the Diesel Particular table with **amount 0.00** and puts the
money under Other Expenses → **"Diesel in Cash"**, so litres count for mileage
but rupees are counted only once.

### Worked example (legacy log slip LOG/0208267136)

| Item | Litres | Amount |
|---|---|---|
| 10 HPCL outlet fills (wallet / OTP) | 650 | ₹65,186 |
| Cash Diesel (2 rows) | 450 | ₹0 in diesel table |
| "Diesel in Cash" (Other Expenses) | — | ₹45,000 |
| **Total** | **1,100** | **₹1,10,186** |

Running KM 5,306 ÷ 1,100 L = 4.82 km/L (matches the slip's average).

---

## 2. What the original G5 asked for vs. what applies

| Original item | Applies? | Revised requirement |
|---|---|---|
| G5.1 Credit fill → Cr Pump payable | No | OTP fill → **Cr HPCL Wallet** (see §3) |
| G5.2 Pump credit limit | No | Optional: warn when the **wallet balance** would go negative / below a threshold |
| G5.3 Blacklisted pump | Optional | Keep only if the office wants to stop fills at specific outlets |
| G5.4 Pump bill reconciliation | Yes, changed | **HPCL wallet statement vs. ERP diesel slips** (see §5) |
| G5.5 PUMP vendor payment | No | No vendor payment. A top-up is a **Bank → Wallet transfer** (contra) |
| G5.6 Pump statement | Yes, changed | **HPCL Wallet ledger**: top-ups, fills, running balance |

---

## 3. Accounting

**Wallet top-up** (manager adds money on the HPCL website)

```text
Dr HPCL Wallet            ₹1,00,000
Cr HDFC Bank              ₹1,00,000      voucher: CONTRA
```

**OTP fill** (e.g. M/S F.C. Banka, 100 L × ₹101.96)

```text
Dr Diesel Expense         ₹10,196
Cr HPCL Wallet            ₹10,196
```

**Cash diesel** (driver pays from advance)

```text
Dr Diesel Expense         ₹45,000
Cr Driver Advance         ₹45,000
```

The ERP's **HPCL Wallet balance must equal the balance on the HPCL website.**
A difference means a missing, duplicate or wrong diesel slip.

This is the same "post when it happens" principle as G1, and the HPCL Wallet is
the same kind of account as the Happay card — build them on one mechanism.

---

## 4. Gaps in the current ERP

| # | Gap | Where |
|---|---|---|
| 1 | No payment mode for a wallet fill. Trip expense modes are CASH / BANK / CARD / UPI / CREDIT. | `TripPaymentMode` in `schema.prisma`; `trip-expense.schema.ts` |
| 2 | A trip expense has no link to which account paid it (`cashAccountId` missing), so a fill can't reduce the wallet. | `TripExpense` model |
| 3 | No HPCL Wallet account. `CashAccount.type` is only BANK / CASH. | `CashAccount`, `CashAccountType` |
| 4 | No way to record a top-up. The `CONTRA` voucher type exists but no flow uses it. | `VoucherType` enum; no contra route |
| 5 | Trip expenses post nothing when approved; all expense posts once, at log slip, against a clearing account. No wallet is ever credited. | `trip-expense.route.ts` approve; `postLogSlipVoucher` in `posting.service.ts` |
| 6 | No reconciliation against the HPCL statement. | — |
| 7 | Litres × rate is not checked against amount. | `trip-expense.schema.ts` |

**Double-count trap:** if fills post `Dr Diesel / Cr Wallet` at approval, the
log slip must stop re-posting those same amounts in its
`VEHICLE_TRIP_EXPENSE` line (it currently includes every expense —
`vehicle-journey.service.ts` totals). Both changes must ship together.

---

## 5. Requirements

### R1 — HPCL Wallet account
- Add the wallet as a `CashAccount` (new type `WALLET`, or `BANK` if Accounts
  prefers) with its own ledger, so it appears in Cash/Bank reports.
- One wallet for the company.

### R2 — Wallet top-up
- Screen: amount, date, from-bank account, HPCL reference no.
- Posts the CONTRA voucher in §3. Idempotent (no double top-up on retry).

### R3 — Diesel fill entry
- New payment mode `FUEL_WALLET` ("HPCL Wallet").
- When mode is `FUEL_WALLET`: vehicle, outlet (pump), litres, rate, amount and
  **HPCL transaction ID** are required. Store the transaction ID in the
  existing `receiptNo` field or a dedicated column.
- Validate `litres × rate ≈ amount` (tolerance agreed with Accounts, e.g. ±₹1).
- Reject a second fill with the same HPCL transaction ID.
- **Process suggestion:** the office member who receives the OTP enters the
  fill at that moment — they already see every transaction, so the ERP is
  complete without waiting for the driver.

### R4 — Posting
- On approval of a `FUEL_WALLET` fill: post `Dr Diesel Expense / Cr HPCL Wallet`.
- On reversal: post the contra entry.
- Log slip excludes already-posted wallet fills from its expense line (see the
  trap in §4). Litres still count for mileage.
- Cash diesel keeps settling through the driver advance at log slip, and must
  appear once (₹45,000), not in both the diesel table and Other Expenses.

### R5 — Reconciliation
Flow: choose period → load ERP wallet fills → import the HPCL transaction
export (Excel/CSV) → compare.

Match on HPCL transaction ID; fall back to outlet + date/time + amount
(vehicle number is probably not in the HPCL data — see §1). Show:
- In HPCL statement but not in ERP (missing slip)
- In ERP but not in HPCL statement (wrong mode / fake / duplicate)
- Litre, rate and amount differences
- Totals: ERP total, HPCL total, difference
- Opening and closing wallet balance: ERP vs. HPCL website

Never auto-correct ERP data from the statement; differences are reviewed.

### R6 — Wallet statement
The ledger page for the HPCL Wallet shows top-ups, fills (with vehicle and
outlet) and the running balance. No separate pump ledger is needed.

---

## 6. Open questions

1. **HPCL export format** — ops believe the website can download transactions.
   Get one real file before building the import (columns, date format,
   whether it includes the transaction ID, outlet name and any vehicle field —
   fills are authorised by the office member's mobile, so a vehicle number may
   be absent).
2. **Wallet account type** — Accounts to confirm: `WALLET` cash account, or a
   current-asset ledger.
3. **Diesel Expense ledger** — one "Diesel Expense" head, or keep it inside
   `VEHICLE_TRIP_EXPENSE`?
4. **Low-balance warning** — wanted? At what amount?
5. **Outlet blacklist** — needed at all?
6. **Back-fill** — post existing approved fills retroactively, or start from a
   cut-over date with an opening wallet balance? (Same question as the paused
   G1 back-fill.)

## 7. Screens

Two new screens, one changed screen, one existing screen that gains data.
Sketches only — final layout follows the app's existing components.

### 7.1 Add Expense drawer (changed)
Vehicle Journey → Add Expense (`apps/web/features/vehicle-journeys/TripExpenseDrawer.tsx`)

```text
┌─ Add Expense ─────────────────────────────┐
│ Expense type   [ Diesel            ▼ ]    │
│ Payment mode   [ HPCL Wallet       ▼ ]  ← new option
│ Pump / Outlet  [ F.C. Banka, Baragarh ▼ ] │
│ Litres         [ 100      ]               │
│ Rate (₹/L)     [ 101.96   ]               │
│ Amount (₹)     [ 10,196   ]  ✓ matches    │
│ HPCL Txn ID    [ HP2607281234 ]  ← new    │
│ Date & time    [ 28-07-2026 07:00 ]       │
│                                           │
│ Wallet balance: ₹84,500 → ₹74,304 after   │
│                        [Cancel]  [Save]   │
└───────────────────────────────────────────┘
```

- Litres × rate ≠ amount → "Amount doesn't match 100 L × ₹101.96".
- Duplicate Txn ID → "This HPCL transaction is already entered on MH19CY-2711, 28-07".

### 7.2 Wallet Top-up (new)
Accounts → HPCL Wallet → Top-up

```text
┌─ HPCL Wallet Top-up ──────────────────────┐
│ Current balance      ₹12,400              │
│ Amount (₹)          [ 1,00,000 ]          │
│ From bank           [ HDFC Bank      ▼ ]  │
│ Date                [ 01-10-2026 ]        │
│ HPCL reference no.  [ TOPUP88213   ]      │
│ Remarks             [               ]     │
│                                           │
│ New balance          ₹1,12,400            │
│                        [Cancel]  [Save]   │
└───────────────────────────────────────────┘
```

### 7.3 HPCL Wallet Reconciliation (new)
Accounts → HPCL Wallet → Reconciliation

```text
Period [ 01-07-2026 ] to [ 31-07-2026 ]   [ Upload HPCL Excel ]

┌──────────────────┬────────────┬────────────┬───────────┐
│                  │    ERP     │   HPCL     │ Difference│
├──────────────────┼────────────┼────────────┼───────────┤
│ Opening balance  │  12,400    │  12,400    │      0    │
│ + Top-ups        │ 3,00,000   │ 3,00,000   │      0    │
│ − Diesel fills   │ 2,88,000   │ 3,00,000   │  12,000 ⚠ │
│ Closing balance  │  24,400    │  12,400    │  12,000 ⚠ │
└──────────────────┴────────────┴────────────┴───────────┘

[ Matched 41 ]  [ Missing in ERP 2 ]  [ Missing in HPCL 0 ]  [ Different 1 ]

Missing in ERP (on HPCL, nobody entered it):
  28-07 07:40  Anand Petroleum, Pune   100 L  ₹9,869   Txn HP2607...  [ Add to journey ]
  30-07 14:10  Shakuntala, Satara       21 L  ₹2,131   Txn HP2607...  [ Add to journey ]

Different:
  27-07  Kamal Automobiles   ERP 70 L ₹7,220 | HPCL 70 L ₹7,320   ⚠ ₹100
```

Shows differences only; never changes ERP data by itself.

### 7.4 HPCL Wallet statement (existing Ledger page)
Accounts → Ledger → "HPCL Wallet". No new screen — entries appear once
top-ups and fills post.

```text
Date    Particulars                              Debit      Credit     Balance
01-07   Opening balance                                                12,400
02-07   Top-up from HDFC (TOPUP88213)          1,00,000              1,12,400
05-07   Diesel MH19CY-2711 · F.C. Banka · 100L              10,196    1,02,204
06-07   Diesel MH19CY-2281 · Madni · 100L                     9,878      92,326
```

---

## 8. Inputs needed before building

**From the office (fuel / HPCL person)**
- [ ] One real HPCL transaction export (Excel/CSV) for one month
- [ ] Screenshot of the HPCL website's transaction page
- [ ] Wallet balance on the HPCL website on a fixed date (becomes the opening balance)
- [ ] Bank account(s) top-ups are paid from
- [ ] Who enters fills — recommended: the office member who gives the OTP, at that moment

**From the accountant**
- [ ] Wallet as a Cash/Bank-type account, or a current-asset ledger
- [ ] Separate "Diesel Expense" head, or inside "Vehicle Trip Expense"
- [ ] Cut-over date with opening balance (recommended), or back-post old fills
- [ ] Do wallet fills need approval, or are they approved when the office member enters them
- [ ] Low-balance warning — wanted? at what amount

---

## 9. Suggested order

1. R3 validations (required fields, litres × rate, duplicate transaction ID) —
   safe, no accounting change.
2. R1 wallet account + R2 top-up.
3. R4 posting + log slip change, together — after Accounts answers Q2, Q3, Q6.
4. R5 reconciliation — after a real HPCL export file is in hand.
5. R6 comes free once R2 and R4 post to the wallet ledger.
