# Trip → Close → Unloading → Log Slip → Accounts — Explained From Zero

> **Read this if you have no prior context.** It explains, in plain language with a worked numeric example, how the **legacy** SK ERP runs an own-truck trip from start to settlement, exactly which numbers flow into accounting, and what the **new** ERP must add to do the same. No accounting background assumed — §1 is a 2-minute primer.
>
> Companions: [`ACCOUNTS_MODULE_MAP.md`](./ACCOUNTS_MODULE_MAP.md) (the ledger/billing spine), [`ERP_MODULE_PLAN_V2.md`](./ERP_MODULE_PLAN_V2.md) §4.3 (Trip module plan).

---

## 1. Background you need first

### 1.1 What is a "trip" and a "log slip"?
SK runs freight trucks. There are two kinds of vehicle:

- **Own vehicle** — SK's own truck + driver. SK pays for its diesel, tolls, driver advances, repairs. At the end SK works out **did this truck make or lose money** — that document is the **Log Slip**. *(This doc is about own vehicles.)*
- **Market vehicle** — a hired truck. SK doesn't run it; it just pays the transporter a freight bill. That's a different flow (TransporterPayment in the accounts map), **no log slip**.

A **trip** = one movement of an own truck from a source city to a destination city, carrying one customer's goods (SK is full-load, one client per trip).

A **Log Slip** = the **profit & loss settlement** for an own truck over its whole round-trip out of the head office (HO = Jalgaon). It answers: *freight earned − all expenses = profit, and did the driver spend his cash advances correctly.*

### 1.2 The one accounting idea you must know: double-entry
Every money event is recorded as **two equal sides**: a **Debit** somewhere and a **Credit** somewhere, equal in amount. Think of each "account" (called a **ledger**) as a bucket.

- Paying ₹8,000 cash advance to a truck → **Debit** "Truck MH18AB1234" ₹8,000 (it now owes us / we've invested in it), **Credit** "Cash" ₹8,000 (cash bucket went down).
- The two sides always balance. A bundle of balanced lines sharing one voucher number = a **voucher** (one journal entry).

In legacy, **every** line — from any screen — lands in **one table `LGST_AccountLedger`**, and is later pushed to **Tally** (the statutory accounting software). A "ledger" is either a **party** (a specific truck / driver / customer / pump) or a **named GL account** ("Cash", "Diesel", "Transportation", "OnwardFreight"). Keep this picture; every section below just adds lines to this table.

### 1.3 The cast (entities) in this story
| Thing | What it is |
|---|---|
| **Truck / Vehicle** | the own vehicle. Has its own ledger `Truck_<id>` that accumulates its advances, freight, expenses → its P&L. |
| **Driver** | drives it, is handed **cash advances** to spend on the road, must account for them. Has a driver ledger. |
| **LogProcess** | the **container for one round-trip cycle** of a truck (HO → … → back to HO). Holds opening/closing KM, start/end dates, and links all the trips in that cycle. **One LogProcess can contain several trips.** |
| **Trip** | one city-to-city leg with one LR (load). Belongs to a LogProcess. |
| **OrderExpense** | a single expense row against a trip (diesel, toll, food…). |
| **Log Slip** | the settlement document generated once per LogProcess when the truck is back at HO. |

---

## 2. The running example (we'll reuse these numbers everywhere)

Truck **MH18AB1234**, driver **Ramesh**. One cycle out of Jalgaon (HO):

| | Leg / Trip | Route | Load (LR) | Freight earned | Cash advance to driver |
|---|---|---|---|---|---|
| Trip 1 (first leg) | depart HO | **Jalgaon → Pune** | LR-A (Customer A) | ₹18,000 | ₹8,000 |
| Trip 2 (return leg) | back to HO | **Pune → Jalgaon** | LR-B (Customer B, return load) | ₹15,000 | ₹5,000 |

KM: opening **50,000** at HO departure; closing **50,950** at HO return → **950 km run**.

Expenses during the cycle:
- Diesel at **Pump-X**: 200 L @ ₹90 = **₹18,000**, bought **on credit** (SK owes Pump-X).
- Toll: **₹2,000**, paid **cash** (from driver's advance).
- Driver food/misc: **₹1,500**, paid **cash** (from driver's advance).

We'll carry these through every stage.

---

## 3. Stage-by-stage walkthrough (legacy)

### Stage A — Create the trip (truck leaves)
**Screen:** `Container/TripDetail.aspx`. **Code:** `TripDetail.aspx.cs` → `Trip_BL.InsertTrip` + `AccountLedgerEntry(...)`.

What the operator enters: truck, driver, from-city, to-city, **opening KM**, **start date/time**, the customer/LR, **onward freight** (what this truck earns for the leg), and a **cash advance** to the driver.

**Two pieces of automatic logic fire here:**

**(1) Open or join the LogProcess** (`TripDetail.aspx.cs:302`):
- If the trip **starts at HO** (`fromCityId == 9`, Jalgaon) and no cycle is open → **`InsertLogProcess`** creates a fresh LogProcess (records truck, driver, opening KM, start date) and marks this trip `isfirst = 1`.
- Otherwise → **`GetLogProcessId`** finds the truck's already-open LogProcess and the trip **joins** it.
- KM continuity: the next leg's opening KM auto-fills as the previous leg's **closing KM + 1** (`IsLogProcessCompleted` returns last closing KM).

So in our example: Trip 1 (Jalgaon → Pune) **opens** LogProcess #501 (`isfirst=1`, openingKm 50,000). Trip 2 (Pune → Jalgaon) **joins** #501.

**(2) Post the accounting for advance + onward freight** (`AccountLedgerEntry`, `TripDetail.aspx.cs:415`). For **Trip 1** (advance ₹8,000, onward freight ₹18,000):

Voucher 1 — *Cash Payment* (advance to driver, booked against the truck):
| Ledger | Debit | Credit |
|---|---|---|
| `Truck_MH18AB1234` | ₹8,000 | |
| `Cash` | | ₹8,000 |

Voucher 2 — *Journal* (accrue the freight the truck earns):
| Ledger | Debit | Credit |
|---|---|---|
| `Transportation` (expense) | ₹18,000 | |
| `OnwardFreight` (income) | | ₹18,000 |

Trip 2 posts the same shape with ₹5,000 advance and ₹15,000 freight. **Running total: Truck ledger has been debited ₹13,000 of advances; ₹33,000 freight accrued.**

> 🔎 **Fields that became accounting here:** `Advance`, `OnwardFreight`, payment mode (Cash/Bank/Card → which credit ledger), truck id, branch, start date.

### Stage B — On the road: capture expenses
**Screen:** `Container/TripExpense.aspx` (class `OrderExpense`). **Code:** `TripExpense.aspx.cs` → `OrderExpense_BL.InsertOrderExpense` + (for credit) `AccountLedger_BL.InsertLedgerEntry`.

Each expense row carries: trip, truck, **expense type** (Diesel / Toll / Food / …), **amount**, **city**, **pump** (for diesel) with **qty + rate**, **card no** (for fuel cards), and **payment mode = Cash or Credit**.

The accounting depends on **how it was paid**:
- **Cash** expenses (toll ₹2,000, food ₹1,500 in our example) → **no ledger posting now**. The cash already left as a driver advance (Stage A). These are just *recorded* so the Log Slip can total them and reconcile the driver.
- **Credit** expenses → posted **immediately**, because SK now owes a third party. Three concrete legacy patterns (`TripExpense.aspx.cs:195-218`):
  - Diesel "in credit" at a pump (type 18): **Dr `DiselinCredit`** / **Cr `Pump_<pumpId>`**.
  - Diesel by IOC fuel card (type 40): **Dr ExpenseType / Cr `IOC-AC`**.
  - Diesel by credit card (type 42): **Dr `Truck_<id>` / Cr `<CardNo>`**.

Our diesel (₹18,000, credit at Pump-X) posts a *Journal*:
| Ledger | Debit | Credit |
|---|---|---|
| `DiselinCredit` (expense) | ₹18,000 | |
| `Pump_X` (we owe the pump) | | ₹18,000 |

> 🔎 **Fields that became accounting here:** expense type, amount, qty, rate, pump/card, payment mode. The pump payable (`Pump_X`) is later cleared via the pump-payment screen — that's a separate accounts flow.

### Stage C — Unloading + closing each trip
**Screen:** `Container/TripCompletion.aspx`. **Code:** `TripCompletion.aspx.cs` → `Trip_BL.TripComplete` (and conditionally `LogProcess_BL.UpdateLogProcess`).

When a truck reaches its destination and the goods are unloaded, the operator closes that trip by entering **closing KM** + **end date/time**.

- `TripComplete` stamps `closingKm`, `endDate`, `endTime` on the trip.
- **The HO trigger** (`TripCompletion.aspx.cs:197`): if the trip's **destination is HO** (`toCityId == 9`, Jalgaon) → **`UpdateLogProcess(... IsProcessCompleted = 1)`** closes the whole LogProcess: records final closing KM + return date and flags the cycle complete.

In our example: closing Trip 1 at Pune just stamps KM/date (cycle stays open). Closing Trip 2 **at Jalgaon** stamps KM/date **and** completes LogProcess #501 (closingKm 50,950, returnDate set).

> ⚠️ Legacy "unloading" is thin: it's just the close (KM + date). There's **no per-drop unloading record** with an actual date. The new schema already has `TripUnloadingPoint.actualDate` — an opportunity to do this properly (§5).
>
> 🔎 **No accounting posts at close itself** — close only stamps KM/dates and may complete the LogProcess. The money is settled next, at the Log Slip.

### Stage D — Generate the Log Slip (the settlement)
**Screens:** truck now appears in the "**Log Pending**" list → `Container/LogSlipGeneration.aspx`. **Code:** `LogSlipGeneration.aspx.cs` → `LogProcess_BL.GenerateLogSlipNumber` (a stored procedure does the math + ledger posting). **Print:** `Prints/LogSlipPrint.aspx`.

The operator picks the truck (whose LogProcess is complete) and enters **total diesel quantity** and **diesel rate**, plus a remark. The stored proc then assembles the full P&L from everything tied to the LogProcess and assigns a **LogSlipNumber**.

**The Log Slip P&L for our example** (these are the exact fields `LogSlipPrint.aspx.cs` shows):

*Header / mileage:*
| Field | Value | Meaning |
|---|---|---|
| Opening / Closing KM | 50,000 / 50,950 | from the LogProcess |
| Total KM | **950** | distance run this cycle |
| Total Diesel | **200 L** | entered at generation |
| Average | **4.75 km/L** | 950 ÷ 200 |
| Std Average | 5.00 km/L | the truck's benchmark |
| **Short Liters** | **10 L** | 200 actual − (950÷5.0 = 190 expected) → driver overused 10 L (recoverable) |

*Freight & expense roll-up:*
| Field | Value | Source |
|---|---|---|
| **Total Freight** | **₹33,000** | Σ freight of LR-A + LR-B |
| Diesel Expenses | **₹18,000** | pump fuel |
| Other Expenses | **₹3,500** | toll ₹2,000 + food ₹1,500 |
| **Total Expenses** | **₹21,500** | |
| **Net Payable** | **₹11,500** | 33,000 − 21,500 = **the truck's profit** |

*Driver reconciliation (advances vs what he actually spent):*
| Field | Value | Meaning |
|---|---|---|
| Driver Advance | ₹13,000 | total cash handed to Ramesh (8,000 + 5,000) |
| Driver Expenses | ₹3,500 | cash he actually spent (toll + food) |
| **Driver Receivable** | **₹9,500** | he must **return** ₹9,500 unspent (13,000 − 3,500) |
| Driver Payable | ₹0 | (would be non-zero if he'd spent more than advanced) |

The stored proc posts a **`Logslip`**-type voucher capturing this settlement (freight income, expenses, and the net to the truck/driver ledgers). `Admin/OpenLogslip.aspx` can reopen a slip to fix it.

> 🔎 **Every field above is an accounting input.** Freight = income; diesel/toll/food = expenses; advances & receivable = driver ledger; net payable = vehicle P&L; short-liters = a driver-recovery trigger.

### Stage E — Push to Tally
`Accounts/TallyXML.aspx` exports all vouchers (including the dedicated **`Logslip`** voucher type) to Tally — either as a downloadable XML file or by live HTTP transfer. (Details in `ACCOUNTS_MODULE_MAP.md` §1.2.)

---

## 4. The whole flow on one page

```
TRIP CREATE (TripDetail)                      ── posts ──▶  Dr Truck / Cr Cash   (advance)
  • opens/joins LogProcess (HO = cityId 9)                  Dr Transportation / Cr OnwardFreight
  • isfirst on HO departure, KM continues
        │
        ▼
ON ROAD: EXPENSES (TripExpense / OrderExpense) ── posts ──▶ (credit only) Dr Diesel / Cr Pump|IOC|Card
  • cash expenses: recorded only                            (cash expenses: recorded, settled at log slip)
        │
        ▼
UNLOAD + CLOSE TRIP (TripCompletion)          ── no posting; stamps closingKm + endDate
  • if destination == HO → LogProcess complete
        │   (repeat create→close for each leg of the cycle)
        ▼
LOG SLIP (LogSlipGeneration)                  ── posts ──▶  "Logslip" voucher:
  • enter total diesel qty + rate                            Freight income − Diesel − Other expenses
  • P&L: Freight − Expenses = Net Payable                    = Net (truck P&L)  +  driver advance reconcile
  • driver advance vs spent reconciliation
        │
        ▼
TALLY (TallyXML)  ── exports Sale / Journal / Logslip / Cash & Bank vouchers
```

---

## 5. New ERP — what exists, what to build

### 5.1 What the new repo already has
- `VehicleTrip` model with `status: Planned → InTransit → Closed → Cancelled`, `openingKm`, `closingKm`, `startDateTime`, `endDateTime`, `onwardFreight`, `isTripEmpty`, links to vehicle/driver/route/consignor.
- `TripUnloadingPoint(sequence, cityId, locationId, plannedDate, actualDate)` — **the unloading model exists**; nothing stamps `actualDate` yet.
- Close route (`modules/trip/trip.route.ts:354`): validates InTransit → sets Closed + closingKm + endDateTime, **releases the vehicle**, writes status history. **Stops there** — no expenses, no log slip, no accounting.

### 5.2 What's missing (build list, in dependency order)
| # | Build | Mirrors legacy | Posts to accounts? |
|---|---|---|---|
| 1 | **Minimal Ledger core** — `Ledger` + `JournalEntry` + `JournalEntryLine` + a posting service | `LGST_AccountLedger` + `InsertLedgerEntry` | — (it *is* the accounts spine; see `ACCOUNTS_MODULE_MAP.md` §4.1) |
| 2 | **Trip advance posting on create** — `Dr Vehicle / Cr Cash`; `Dr Transportation / Cr OnwardFreight` | `AccountLedgerEntry` at trip save | ✅ |
| 3 | **`TripExpense`** `(tripId, expenseType, amount, paymentMode, pumpId?, cardLedgerId?, qty?, rate?, cityId?, attachmentId?)` | `OrderExpense` | ✅ credit purchases → `Dr Diesel / Cr Pump\|Card\|IOC` |
| 4 | **Unloading completion** — action stamping `TripUnloadingPoint.actualDate` per drop; optionally block Close until all drops done | legacy HO-close (but done properly per-drop) | — |
| 5 | **`DriverAdvance`** `(tripId, driverId, amount, mode, settledAmount)` + driver ledger | trip `Advance` + Truck Advance Slip | ✅ `Dr Driver / Cr Cash` |
| 6 | **`LogSlip`** + generation: aggregate freight & expenses, compute KM/avg/short-liters, driver reconciliation, **Net Payable**; post the `Logslip` voucher | `LogProcess` + `GenerateLogSlipNumber` | ✅ |
| 7 | **Tally export** of these vouchers | `TallyXML` | — |

### 5.3 The one modelling decision to make first
Legacy's **LogProcess wraps MANY trips** (a whole HO→…→HO cycle, triggered by `cityId == HO`). The new plan (§4.3) implies **one Log Slip per trip on Close**.

- If SK trucks usually do **one load and return** → **per-trip Log Slip is simpler** (recommended; no `LogProcess` entity — settle on Close).
- If a truck commonly does **several loads before returning to Jalgaon** → you need the **multi-trip `LogProcess`** container exactly like legacy.

**Confirm this against real operations before building #6** — it changes whether `LogSlip` hangs off a `Trip` or off a `LogProcess`.

---

## 6. Quick legacy file index
| Stage | File |
|---|---|
| Trip create + advance posting | `Container/TripDetail.aspx.cs` (`AccountLedgerEntry`, `btnSave_Click`) |
| Trip expenses | `Container/TripExpense.aspx.cs` (class `OrderExpense`) |
| Close / unloading | `Container/TripCompletion.aspx.cs` → `Trip_BL.TripComplete` |
| LogProcess lifecycle | `SK_Logistic_BL/LogProcess_BL.cs`, `SK_Logistic_DL/LogProcess_DL.cs` |
| Log slip generation | `Container/LogSlipGeneration.aspx.cs` → `GenerateLogSlipNumber` (stored proc) |
| Log slip print (P&L fields) | `Prints/LogSlipPrint.aspx.cs` |
| Driver advance slip | `Prints/TripAdvance.aspx.cs` |
| Reopen slip | `Admin/OpenLogslip.aspx.cs` |
| Ledger engine + Tally | `SK_Logistic_BL/AccountLedger_BL.cs`, `Accounts/TallyXML.aspx.cs` |
