# 2. The full flow on one page

> Last checked: 2026-10-12 · For: everyone. Read this page before any other chapter.

Every job in SKERP follows the same path. Learn this path once, and every screen will make sense.

## The big picture

```
  ┌─────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌────────┐   ┌─────────┐
  │ 1 ORDER │──►│ 2 LR     │──►│ 3 TRUCK      │──►│ 4 DELIVER│──►│ 5 BILL │──►│ 6 PAID  │
  │ customer│   │ document │   │ own: Trip    │   │ goods    │   │ GST    │   │ receipt │
  │ asks    │   │ per truck│   │ market: hire │   │ + signed │   │ invoice│   │         │
  └─────────┘   └──────────┘   └──────────────┘   │   LR back│   └────────┘   └─────────┘
                                                  └──────────┘
                                         Every money step writes to the BOOKS automatically
```

## Step by step, in simple words

| Step | What happens in real life | What you do in SKERP | Screen |
|---|---|---|---|
| **1. Order** | Customer calls: "I need 3 trucks, Pune to Kolkata, on 15th" | Create an **order**. A manager **approves** it | Operations → Orders |
| **2. LR** | For each truck, a Lorry Receipt is made for the goods | Make an **LR group** (one per truck) with its **LRs** | Operations → Lorry Receipts |
| **3. Truck** | A truck is arranged | **Own truck:** link a **trip**. **Market truck:** enter the transporter, truck number and agreed freight | Inside the LR form / Trips |
| **4. Deliver** | Truck unloads at the customer. Customer signs the LR. Signed LR comes back to the office | Mark the LR **delivered**, then **acknowledge** the signed LR | Operations → Deliveries |
| **5. Bill** | We send a GST invoice to the customer | Pick the delivered LRs and make a **bill** | Finance → Billing & Receipts |
| **6. Paid** | Customer pays | Record the **receipt** against the bill | Finance → Client Receipts |

## What happens on the side

While the main path runs, three other things happen:

| Side work | What it is | Chapter |
|---|---|---|
| **Own truck journey** | Our truck leaves base, does one or more trips, comes back. Diesel and expenses are recorded, then a **log slip** settles the driver's account | Part D |
| **Road + rail** | For rail jobs, extra steps in the middle: goods reach the railway station, are loaded into wagons, travel by train, and go to the customer on a delivery truck | Part E |
| **Paying others** | Transporters (market trucks), hamali (labour) and drivers are paid through approval steps | Part G |

## Example: one job from start to end

> **Customer:** ABC Industries, Pune. **Needs:** 1 truck (32 ft) to Kolkata. **Rate:** ₹90,000 per truck.

1. Booking staff creates **Order** ORD-0101: ABC Industries, Pune → Kolkata, 1 truck, 32 ft. Freight ₹90,000 comes from the rate list automatically.
2. Branch manager **approves** it. Status: **Confirmed**.
3. Booking staff creates the **LR group** for truck #1 and its **LR 00051** (goods: 200 boxes, 18 tonnes).
4. An **own truck** MH19-AB-1234 is free, so staff link it through a **trip**. The trip starts: **In transit**.
5. Staff add the customer's **invoice number** and **e-way bill**, then **finalise** the LR. LR copies are printed for the driver.
6. Truck reaches Kolkata. Branch staff mark LR 00051 **delivered**.
7. The signed LR reaches the office. Staff **acknowledge** it. The LR is now **ready to bill**.
8. Billing makes a **bill** of ₹90,000 + GST. Accounts approve and finalise it.
9. ABC pays. Accounts record the **receipt**. Done.

Steps 8 and 9 also write the accounting entries in the books automatically. Nobody types them by hand.

## Status words

Every document moves through **statuses**. The status tells you what has happened and what to do next.

| Document | Statuses, in order |
|---|---|
| **Order** | Pending approval → Confirmed → LR created (or Rejected / Cancelled) |
| **LR group** | Draft → Finalised → Delivered (or Cancelled) |
| **LR** | Draft → Finalised → Delivered → Acknowledged |
| **Trip** | Planned → In transit → Closed (or Cancelled) |
| **Bill** | Draft → Pending review → Approved → Finalised → Sent → Partially paid → Paid |
