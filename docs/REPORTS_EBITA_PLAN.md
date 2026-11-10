# Reports Module & EBITA: Plan

> **Status (2026-10-29):** Planning only. No code written yet. Four decisions are still open
> (§11) and must be settled before Phase 0 starts.
>
> **Goal:** the owner, who is not technical, can see every part of the business from one place,
> filter it any way they need, and trust the numbers. **EBITA is the top priority.**
>
> Related: [ERP_MODULE_PLAN_V2.md §8.2](./ERP_MODULE_PLAN_V2.md) (original reports idea),
> [CUSTOMER_LEDGER.md](./CUSTOMER_LEDGER.md) (Debtor statement + Ageing, already built),
> [ACCOUNTS_LEDGER_BUILD.md](./ACCOUNTS_LEDGER_BUILD.md) (journal / posting design).

---

## 1. Summary

We were given a target list of **42 report items in 7 groups**, plus a separate **Monthly EBITA**
screen. The list came from a separate design or prototype. The `monthly-ebita.tsx` screen and the
"reports hub" it describes do not exist in this repo on any branch.

Compared with what this ERP has today (the current branch, `main` and `production` all have the
same screens):

| | Count |
|---|---|
| Items in the target list | **42** (33 reports + 9 "↗" links to other screens) + Monthly EBITA |
| Already built | **5** |
| Partly built (a screen exists, but not as that report) | **8** |
| Missing | **29** |
| Report screens we have that are **not** in the list | **6** |

Today the sidebar's **Reports** group has only three items: Vehicle P&L, Vehicle Performance and
Vehicle Costs. Other report-type screens are spread across the Finance and Operations menus.

---

## 2. Target list vs what we have

Legend: ✅ built · 🟡 partly built · ❌ missing · ↗ = a link to another screen in the target design,
not a report of its own.

### 2.1 Road / LR (5)

| # | Report | Shows | Status | What we have today |
|---|---|---|---|---|
| 1 | Booking report (LR details) | All LRs with bill status, transport type, payment mode | 🟡 | Lorry Receipts list (`/lorry-receipts`). It's a working screen, not a filterable report. |
| 2 | Daily freight planning | Freight planned per truck per day, own vs market trucks | ❌ | |
| 3 | LR acknowledgment | POD received or pending, by truck, mode and rake | 🟡 | Deliveries (`/lorry-receipts/deliveries`) + acknowledge dialog on an LR |
| 4 | Pending acknowledgment summary | Pending PODs per branch, grouped by age | ❌ | |
| 5 | Courier detail | Couriers sent and received between branches | ❌ | Only POD courier fields exist (see §8) |

### 2.2 Rail (7)

| # | Report | Shows | Status | What we have today |
|---|---|---|---|---|
| 6 | Delivery challan | LDCs with acknowledgment status | 🟡 | Delivery Challans list (`/vp-management/delivery-challans`) |
| 7 | DC branch | Challans and freight by destination branch | ❌ | |
| 8 | LDC life cycle | Every step from challan to payment, with due dates | ❌ | |
| 9 | Rake completion summary | Each LR on a rake: VP, DGRN, LDC, delivery, stock | ❌ | |
| 10 | MIS report (rake) | One-page MIS for a rake, by client | ❌ | |
| 11 | Rake profitability | P&L for one rake, by expense head | ❌ | Rail costs aren't in the books yet (see §6.4) |
| 12 | Rake profitability summary | All rakes side by side: revenue, costs, margin | ❌ | Same as above |

### 2.3 Warehouse (7)

| # | Report | Shows | Status | What we have today |
|---|---|---|---|---|
| 13 | Hamali loading / unloading | Hamali earned and paid, by gang, rake and VP | ❌ | Hamali payment *entry* exists (`/accounts/vendor-payments/hamali/new`), no report |
| 14 | ↗ Stock loading verification | | ❌ | |
| 15 | ↗ Stock move | | ❌ | |
| 16 | ↗ Godown stock detail | | ❌ | No godown goods-stock table (see §8) |
| 17 | ↗ Godown stock summary | | ❌ | Same as above |
| 18 | ↗ Damage / shortage | | ❌ | Damage/shortage fields exist on GRN and acknowledgment |
| 19 | ↗ Quality control | | ❌ | No data captured at all (see §8) |

### 2.4 Finance (9)

| # | Report | Shows | Status | What we have today |
|---|---|---|---|---|
| 20 | Client business | Freight share by client, road vs rail | ❌ | Dashboard "Top customers" card only |
| 21 | Sale bill | Bills issued, taxable value and GST | 🟡 | Billing Register (`/accounts/bills`). GST/taxable columns not checked. |
| 22 | Sale bill deleted | Deleted bills, who deleted them and when | ❌ | Bills can be cancelled, but there's no report of them |
| 23 | Account ledger audit | All vouchers in a period, who posted them, Tally status | 🟡 | Day Book (`/accounts/day-book`): one day, no "posted by" or Tally status |
| 24 | PAN-wise periodic report | Transporter payments by PAN, for TDS u/s 194C | ❌ | |
| 25 | Client rate matrix | Contract rates vs average freight actually charged per lane | ❌ | |
| 26 | ↗ Client outstanding | | ✅ | Ledger → Debtor + Ageing tabs (`/ledger`) |
| 27 | ↗ Account ledger | | ✅ | Ledger (`/ledger`) |
| 28 | ↗ Rate matrix | | ✅ | Masters → Rate Matrix (a master, not a report) |

### 2.5 Fleet (4)

| # | Report | Status | What we have today |
|---|---|---|---|
| 29 | Branch-wise truck advance summary | ❌ | |
| 30 | Pending log slip | ❌ | |
| 31 | Diesel pump-wise | ❌ | |
| 32 | Truck status | ❌ | Dashboard "Fleet" card only |

### 2.6 Performance (6)

| # | Report | Status | What we have today |
|---|---|---|---|
| 33 | Vehicle performance (P&L per truck) | ✅ | Vehicle P&L (`/vehicle-journeys/vehicle-pnl`) |
| 34 | Vehicle performance summary | ✅ | Vehicle Performance (`/vehicle-journeys/vehicle-pnl/monthly`) |
| 35 | Driver performance | ❌ | |
| 36 | Top 10 drivers | ❌ | |
| 37 | Top 10 trucks | 🟡 | The Leaderboard popup on Vehicle Performance (by profit, margin, profit/km) |
| 38 | Supervisor performance | ❌ | Supervisors are recorded on GRN / VP loading / challans; "performance" isn't defined yet |

### 2.7 Workshop (4)

| # | Report | Status | What we have today |
|---|---|---|---|
| 39 | Job card detail | 🟡 | Job Cards list (`/workshop/job-cards`) |
| 40 | Mechanic performance | ❌ | Mechanic is recorded on job card lines |
| 41 | Inventory stock detail | 🟡 | Workshop → Stock (`/workshop/stock`): spare parts per branch |
| 42 | Inventory stock summary | ❌ | |

### 2.8 Monthly EBITA (separate screen in the target design)

| Tab | Status | What we have today |
|---|---|---|
| Profit & Loss: month-by-month statement + GHT / KOL rail route breakdown | ❌ | Nothing |
| Vehicle Performance: revenue and trip costs per vehicle, profit / loss / net | 🟡 | Covered by Vehicle Performance |
| Freight Difference: each LR's booking amount minus freight paid onward | 🟡 | Totals + printable freight difference by LR, inside Vehicle Performance |

### 2.9 Report screens we have that are not in the list

| Screen | Route |
|---|---|
| LR Unloading Report | `/lorry-receipts/unloading-report` |
| Vehicle Costs: fixed costs per truck per month (tax, insurance, EMI, tyre…) | `/vehicle-journeys/vehicle-costs` |
| Ledger tabs: Bank, Cash, Creditor, Driver, Expense | `/ledger` |
| Cash Planning reports: Day Close, Full Ledger, Queue Only | `/cash-planning/report/[date]` |
| Day Book | `/accounts/day-book` |
| Dashboard cards: Ageing, Top customers, Branch performance, Profit, Trend | `/dashboard` |

> The "partly built" calls were made from screen and file names, not by checking every column
> against the target description. Check them again when each report is picked up.

---

## 3. UX principles (for a non-technical owner)

1. **Group by question, not by department.** "Am I making money?" and "Who owes me?" are easier
   to scan than "Finance" and "Rail".
2. **Every report page looks the same.** Once the owner learns one, they know all of them.
3. **The period filter always comes first**, with one-tap choices: This month, Last month,
   This quarter, This FY, Last FY, Custom.
4. **Every number can be clicked.** Click a total to see the rows behind it, then click a row to
   open the LR, bill or log slip. Drill-down is what makes the owner trust a number.
5. **Plain words first, the accounting term second**, for example "Profit before loans & tax
   (EBITA)". Each term gets a **?** with a one-line explanation.
6. **Amounts in ₹ lakh / crore, with the change vs the last period**: "₹1.2 Cr ▲ 8% vs last month".
7. **Filters live in the URL**, so a view can be bookmarked or sent on WhatsApp. "Save this view"
   turns it into a one-click favourite.
8. **Export and Print/PDF on every report.**
9. **Plain-language empty states and Skeleton loading**, per the design system. Never "Loading…".

---

## 4. Reports Hub (`/reports`)

```
Reports                                        [ Search reports...   ]
Pinned:  EBITA · Client outstanding · Vehicle performance

Am I making money?         Who owes me / whom do I owe?   How are trucks doing?
  EBITA  ★                   Client outstanding             Vehicle P&L
  Client business            Sale bills (GST)               Truck status
  Rake profitability         Pending acknowledgments        Top 10 trucks / drivers
  ...                        ...                            ...

Where is the cargo?        Rail & rakes                   Warehouse & workshop
  ...                        ...                            ...
```

- Each card shows the report name, one plain line on what it shows, and a pin star.
- A user only sees the reports they have permission for.
- Links to existing screens (Ledger, Rate Matrix, Vehicle P&L) appear in the hub as well, so the
  owner has one place to start.

---

## 5. Shared report page layout

```
← Reports   Client business                             [Export] [Print]
Which customers give us the most freight, road vs rail          (?)

[This month ▾] [All branches ▾] [Road + Rail ▾] [+ More filters]  Reset
Active:  Branch: Pune ✕

┌ Revenue ₹1.2 Cr ▲8% ┐ ┌ Customers 46 ┐ ┌ Road 62% · Rail 38% ┐

Table: sortable, every amount clickable → side drawer with the LRs / bills behind it
```

Built once and reused by every report:

| Piece | Job |
|---|---|
| `ReportShell` | Title, plain description, help, Export / Print actions |
| `ReportFilterBar` | Period presets, branch, 2–3 report-specific filters, "More filters" drawer, active-filter chips, Reset. State kept in URL search params. |
| `KpiStrip` | 3–4 headline numbers with comparison arrows |
| `DrillDownDrawer` | Shows the rows behind any number, with links to source documents |
| Export / Print | CSV (opens in Excel) + print layout |

A new report should then only need its query, its columns and a registry entry.

---

## 6. EBITA

### 6.1 What the owner sees: the profit ladder

```
Money billed (Revenue)                                    ₹1.20 Cr
 − Trip costs  (diesel, toll, driver, market truck hire,
                railway freight, hamali)
 = Gross profit  ("what the trips earned")
 − Truck running costs  (insurance, tax, permit, tyres, repairs)
 − Office costs  (staff salary, rent, electricity, general)
 = EBITDA        ("operating profit")
 − Depreciation  (trucks losing value)
 = EBITA         ← the owner's number, big and bold
 − Interest on loans, tax
 = Net profit
```

### 6.2 Screen: Finance → EBITA (4 tabs)

| Tab | What it shows |
|---|---|
| **Summary** | Big EBITA number, margin %, change vs last month and the same month last year. Waterfall chart of the ladder. A "What changed" box with the 3 biggest movers, e.g. "Diesel up ₹2.1 L". These are calculated, not AI-written. |
| **Month by month** | April to March as columns, the ladder as rows, plus a Total column. Expand a row to see its ledgers, then click an amount to see the vouchers and source documents. |
| **Split by** | One dropdown: Branch · Business line (Own trucks / Market trucks / Rail / Warehouse) · Rail route (GHT, KOL…) · Customer. One tab with a dropdown is simpler than four tabs. |
| **Trucks** | Reuses the existing Vehicle Performance and Freight Difference screens. |

**Filters:** Period, Branch, Business line, and "Compare with" (previous period or same period last
year).

**Trust badge:** an automatic check that "Revenue here = Billing Register total ✓" for the same
period. If the numbers ever disagree, the owner sees it straight away and doesn't silently get a
wrong figure.

**Unbilled work note:** a side line such as "₹8.4 L of delivered LRs not billed yet", so a low month
isn't a surprise.

### 6.3 Data source: the accounts journal

We already keep proper double-entry accounts. **EBITA should read from them**, so the owner gets
one figure that matches the books and Tally.

- `JournalEntry` (`status = POSTED`) → `JournalLine` → `Ledger`
- `Ledger.group` already separates `DIRECT_INCOME`, `INDIRECT_INCOME`, `DIRECT_EXPENSE`,
  `INDIRECT_EXPENSE`
- `JournalEntry.branchId` is required, so a split by branch is possible
- `JournalEntry.sourceType` (BILL, LOG_SLIP, VENDOR_PAYMENT_ACCRUAL, JOB_CARD, DRIVER_SALARY…)
  tells us which document a cost came from. That's how costs get split by business line (§6.5).

The alternative is to build EBITA from operational data (LRs, log slips, vehicle costs). That's
faster, but it creates a second profit number that won't match the accounts. **Not recommended.**
See decision §11.2.

### 6.4 Problems to fix before EBITA is correct (Phase 0)

A naive sum of the journal today would give a **wrong** EBITA:

1. **Revenue would be counted twice.** Closing a log slip posts the vehicle's freight to an
   internal ledger, `VEHICLE_FREIGHT_INCOME` (`postLogSlipVoucher` in
   `apps/server/src/modules/ledger/posting.service.ts`). The customer bill has already posted the
   same freight to `FREIGHT_INCOME`. Both ledgers are in the `DIRECT_INCOME` group.
   **Fix:** add a **P&L head** tag to every income/expense ledger: *Revenue, Trip cost, Truck
   cost, Office cost, Depreciation, Interest, Tax, Exclude*. Internal ledgers get *Exclude*. The
   accounts team should be able to edit the tag in Chart of Accounts without code changes.
   **To confirm with Accounts:** does `VEHICLE_TRIP_EXPENSE` (log slip) overlap with diesel/pump
   postings to `DIESEL_EXPENSE`?
2. **Rail costs are missing from the books.** Rail rake charges and their payments
   (`RailRakeCharge`, `RailRakeChargePayment`) don't post any voucher, so rail profit would look
   too high. It also needs checking whether the railway freight paid to Indian Railways reaches
   the journal. **Fix:** post vouchers for them.
3. **Truck fixed costs are missing.** `VehicleMonthlyCost` (tax, insurance, permit, fitness, EMI,
   salary, tyre, other) is used only by Vehicle P&L and never posted. **Fix:** post a monthly
   voucher. **EMI is not a cost:** the interest part goes below EBITA, and the principal isn't
   profit-and-loss at all. EMI needs splitting, or must be left out of EBITA.
4. **There are no Depreciation, Interest or Tax heads.** `LedgerAccountGroup` has no such groups
   and there's no fixed-asset register. Until depreciation is recorded, **EBITA = EBITDA**, and
   the screen must say so. **Fix:** add the heads, plus a monthly depreciation entry (a manual
   journal is fine for v1).
5. **Branch of company-level vouchers.** The dashboard profit card notes that log slips have no
   branch of their own. Check which `branchId` log-slip, driver-salary and similar vouchers carry
   before trusting the split by branch.

### 6.5 Splitting costs by business line

Each cost follows the document it came from:

| Source | Business line |
|---|---|
| Log slip (`LOG_SLIP`) | Own trucks |
| Transporter payment for an LR group (`VENDOR_PAYMENT_ACCRUAL`, source `LR_GROUP` / `LR`) | Market trucks |
| Hamali / LDC for `RAIL_BRANCH_GRN`, `VP_LOADING`, `GRN_HAMALI` | Rail |
| Rail rake charges (after fix §6.4-2) | Rail |
| Revenue | Follows the LR's `transportType` (Road / Rail / RoadAndRail) through `BillLorryReceipt` |
| Office costs, rent, staff salary, manual journals | **Shared** (not split) |

---

## 7. Build order

| Phase | Scope |
|---|---|
| **0. Foundation** | Reports Hub, shared report page pieces (§5), report registry, permissions. P&L head mapping + the missing postings (§6.4 1–4). |
| **1. EBITA** | EBITA screen (4 tabs) · Client business (#20) |
| **2. Money** | Sale bill with GST (#21) · Cancelled bills (#22) · Account ledger audit (#23) · PAN-wise 194C (#24) · Client rate matrix vs actual (#25) |
| **3. Road operations** | Booking report (#1) · LR acknowledgment (#3) · Pending acknowledgment by age (#4) · Daily freight planning (#2) · Courier detail (#5) |
| **4. Rail** | Delivery challan (#6) · DC branch (#7) · LDC life cycle (#8) · Rake completion (#9) · Rake MIS (#10) · Rake profitability + summary (#11, #12) |
| **5. Trucks & people** | Truck advance summary (#29) · Pending log slip (#30) · Diesel pump-wise (#31) · Truck status (#32) · Driver performance (#35) · Top 10 drivers / trucks (#36, #37) · Supervisor performance (#38) |
| **6. Warehouse & workshop** | Hamali (#13) · Godown stock detail / summary (#16, #17) · Stock move (#15) · Loading verification (#14) · Damage / shortage (#18) · Quality control (#19) · Job card detail (#39) · Mechanic performance (#40) · Inventory detail / summary (#41, #42) |

Rake profitability (#11, #12) depends on fix §6.4-2 from Phase 0.

---

## 8. Data warnings

These reports need data that isn't captured today, or needs a definition first:

| Report | Problem |
|---|---|
| Quality control (#19) | No QC data in the schema at all. Needs a new entry screen first. |
| Godown stock detail / summary (#16, #17) | No godown / warehouse goods-stock table. `StockLedger` / `StockMovement` are for workshop spare parts. It would have to be worked out from GRN in minus challan out, which needs checking. |
| Courier detail (#5) | Only `courierName` / `courierDocketNo` / `courierCharge` on `LRAcknowledgement` (POD couriers). No general courier register between branches. |
| Supervisor performance (#38) | Supervisors are recorded on GRN, VP wagon loading, branch GRN and delivery challan, but "performance" needs a definition (volume? speed? damages?). |
| Mechanic performance (#40) | Data exists (`mechanicId` on job card part/service lines). Needs a definition. |

---

## 9. Technical shape

Follows the existing conventions in `CLAUDE.md` and `MASTER_MODULE_PLAN.md`.

**Server**

- One vertical slice per report: `apps/server/src/modules/reports/<name>/`
  - `<name>.route.ts`: `GET /reports/<name>` and `GET /reports/<name>/export`
  - `<name>.service.ts`: the query. Aggregate in the database (`groupBy` / raw SQL), never in JS
    over full tables.
  - `<name>.compute.ts` + `__tests__/`: pure calculation functions with vitest tests, the same
    pattern as `ledger/customer-statement.compute.ts`
- Gate every route with `can(PERMS.REPORTS.<NAME>.VIEW)` and apply `branchFilter(req)` to
  every query on a branch-scoped model.
- Filter schemas: `packages/validators/src/reports/<name>.schema.ts`, with a subpath export.
  Shared period / branch filter schema in `reports/_shared`.
- Indexes already in place: `JournalEntry(branchId, voucherDate)` and `JournalLine(ledgerId)`.
  If the monthly EBITA query is slow, add a monthly summary table later. Don't start with one.

**Web**

- `apps/web/features/reports/`
  - `_shared/`: `ReportShell`, `ReportFilterBar`, `KpiStrip`, `DrillDownDrawer`, export / print
    helpers
  - `registry.ts`: slug, title, plain description, category (the hub question), icon,
    permission, lazy `page` import. Same idea as `features/masters/registry.ts`; navigation
    metadata only.
  - `<report>/`: `page.tsx`, `<Name>Table.tsx`, `<name>.service.ts`, `<name>.keys.ts`
- Routes: `app/(dashboard)/reports/page.tsx` (hub) and `app/(dashboard)/reports/[report]/page.tsx`
  (thin: registry lookup → `entry.page()`).
- Charts: Recharts (already a dependency of `apps/web`).
- Tables, Skeleton, Pagination and form fields come from `@skerp/ui` / shared field components.
  No raw `<table>`.
- Export: CSV for v1. Real `.xlsx` would need a new library (none installed today).

**Permissions**

- New keys in `packages/types/src/permissions.ts` (`reports.<name>.view`, `reports.export`),
  then re-run the seed.
- Admin / owner gets all of them. Branch Manager sees reports for their own branches.
  Accounts gets the money reports.

---

## 10. Customer 360 (later)

Not planned in detail yet. It comes after the reports and EBITA work.

**Goal:** clicking a customer anywhere opens one page with everything about them: profile,
orders, LRs, trips, bills, receipts, credit notes, outstanding + ageing, rate agreements / rate
matrix, pending PODs, revenue trend and profitability.

**What the reports work should do now so this is easy later:**

- Make every customer name in a report a link to a future `/customers/[id]` route.
- Keep per-customer queries reusable (filterable by `customerId`).
- Reuse the existing Debtor statement + Ageing ([CUSTOMER_LEDGER.md](./CUSTOMER_LEDGER.md)).
  Don't rebuild them.

---

## 11. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 11.1 | **EBITA or EBITDA?** No depreciation is recorded today. | Show both lines. Mark EBITA as "= EBITDA until depreciation is recorded" until the depreciation entries exist. |
| 11.2 | **Should EBITA match the books (Tally)?** | Yes: read from the journal, which means doing Phase 0 first. The faster operational estimate gives a second number that won't match the accounts. |
| 11.3 | **Who checks the P&L head mapping?** | Someone from Accounts signs off on which ledger goes under which line, and on the `VEHICLE_TRIP_EXPENSE` vs diesel question (§6.4-1). |
| 11.4 | **Is the phase order right?** | Confirm with the owner. Move a report earlier (e.g. Rake profitability) if it's needed sooner. |
