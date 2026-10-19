# 13. Advances, expenses and the log slip

> Last checked: 2026-10-12 · For: operations staff (enter), accounts and managers (approve and settle)

## The idea

During a journey, the driver gets **cash** and spends money on the road. At the end, the **log slip** answers two questions:

1. **Did this truck make money on this round?** (freight earned − costs)
2. **Does the driver owe us, or do we owe the driver?** (advances given − money he spent)

## 1. Driver advance

An **advance** is cash given to the driver for road expenses.

**Open the journey → Advances → Add.** Fill:

| Field | What to fill |
|---|---|
| **Amount** | How much was given |
| **Payment mode** | Cash, Bank, Card or UPI |
| **Cash account** | Which cash box or bank it came from |
| **Paid at** | Date and time |
| **Trip leg** | A specific leg, or leave as **Whole journey** |
| **Narration** | Optional note |

A wrong advance can be **reversed**. The reversal removes it from the driver's settlement.

⚠ Advances and cash expenses are not yet posted to the cash/bank books. This is waiting for the accountant's decision.

## 2. Trip expenses

Every cost on the road: diesel, toll, food, border fees, repairs…

**Open the journey → Expenses → Add.** Fill:

| Field | What to fill |
|---|---|
| **Expense type** | Diesel, Toll, Food… (add a new type if needed) |
| **Amount** | Cost |
| **Payment mode** | **Cash (driver advance)**, **Credit (pump/vendor)**, **Card / fuel card**, **Bank**, **UPI** |
| **Paid by driver from advance** | Tick if the driver paid from his advance |
| *(Diesel)* **Pump**, **Quantity (L)**, **Rate / L** | Where and how much diesel |
| **City**, **Expense date** | Where and when |
| **Bill / receipt no.** | From the receipt |
| **Trip leg** | A specific leg, or **Whole journey** |
| **Remarks** | Optional |

### Expense approval

```
 Draft ──Approve──► Approved (counted in the log slip)
   │
   └──Reject──► Rejected (not counted)
```

- A manager or accounts person **approves** or **rejects** each expense.
- Only **Draft** expenses can be edited or deleted.
- An approved expense can be **reversed** if it was wrong. It is then excluded from the log slip.

The journey screen shows **Cash expenses** and **Credit expenses** separately.

## 3. The log slip (settlement)

### Step 1: Mark ready

When the journey is **Returned** and all expenses are checked: **Mark ready**. Status: **Ready for Log Slip**.

### Step 2: Generate the log slip

Open the log slip screen. You enter only a few things:

| You enter | Meaning |
|---|---|
| **Log slip date** | Date of the settlement |
| **Previous diesel (L)** | Diesel already in the tank from the last journey, if any |
| **Diesel rate / L** | Rate used for the slip |
| **Standard avg (KM/L)** | What this truck should do per litre |
| **Remarks** | Optional |

The diesel **litres** come from the approved diesel expenses. Click **Generate Log Slip**, and the ERP calculates the rest:

**Truck mileage**

| Line | Meaning |
|---|---|
| **Total KM** | Closing KM − opening KM (+1) for the whole journey |
| **Actual avg** | KM ÷ diesel litres |
| **Short diesel (L)** | Diesel used beyond the standard average. A sign of overuse |

**Money**

| Line | Meaning |
|---|---|
| **Total freight** | Freight earned on all legs |
| **Diesel** + **Other Expenses** = **Total expenses** | All approved costs |
| **Net vehicle result** | Total freight − total expenses = **truck's profit or loss** for this round |

**Driver settlement**

| Line | Meaning |
|---|---|
| **Advances** | Total cash given to the driver |
| **Receivable from driver** | Advances − expenses he paid himself, when he spent **less** than he got: he must **return** the balance |
| **Payable to driver** | When he spent **more** than he got: we **owe** him the difference |

Only **approved** expenses count. Only expenses with payment mode **Cash (driver advance)** and **Paid by driver from advance** ticked reduce the driver's balance. Credit, card, bank and UPI expenses don't touch it.

### Worked example

> Freight: ₹18,000 + ₹15,000 = **₹33,000**. Diesel ₹18,000 + toll ₹2,000 + food ₹1,500 = **₹21,500**.
> **Net vehicle result = ₹11,500 profit.**
> Driver got ₹13,000 in advances and spent ₹3,500 in cash → **receivable from driver ₹9,500**.

### Step 3: Post to accounts

Check the slip, then click **Post to accounts**. The ERP writes the log slip voucher in the books. The journey becomes **Settled**.

**Download** the log slip PDF to print or file it.

**Mistake found?** Use **Reopen log slip** (or **Reopen review** before posting), fix it, and generate again.

## Who does what

| Step | Who (default roles) |
|---|---|
| Enter advances and expenses | Operations |
| Approve / reject / reverse expenses | Branch Manager, Accounts |
| Generate and post the log slip | Accounts |

## Try it yourself (test system only)

1. On a test journey, add an advance of ₹10,000.
2. Add a diesel expense (Credit, pump, 100 L × ₹90) and a ₹500 toll (Cash, tick **Paid by driver from advance**).
3. Approve both expenses. Close the last leg at the return city.
4. **Mark ready** → **Generate Log Slip**. Check the receivable from the driver: 10,000 − 500 = ₹9,500.
