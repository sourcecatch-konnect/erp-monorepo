# ERP flow: from order to money

> Last checked: 2026-10-10 · Audience: everyone

This page shows how work moves through SKERP. Each box is a screen. The arrows show the order of the work.

## 1. Road flow (truck goes directly to the customer)

```
 Order ──► LR group + LRs ──► Trip (own truck) or market truck
   │                              │
   │                              ▼
   │                     Delivered at customer ──► Signed LR received (acknowledgement)
   │                                                         │
   ▼                                                         ▼
 Order status                                   Ready to bill ──► Bill ──► Receipt (payment)
                                                                     │          │
                                                                     ▼          ▼
                                                                  Voucher in the books
```

| Step | Screen | What happens |
|---|---|---|
| 1 | **Orders** | The customer asks for trucks. Freight comes from the customer's **agreement / rate matrix** (per truck, per route). The order is approved |
| 2 | **Lorry Receipts** | One **LR group per truck**. It holds one or more **LRs** (consignments). Choose **Road** or **Road + Rail**, and **own** or **market** truck |
| 3 | **Trips** | For an own truck, attach the LR group to a trip. Attaching **dispatches** the trip. A market truck is recorded on the LR group (transporter, vehicle, freight, advance) |
| 4 | **Deliveries** | Mark each LR **delivered**, with the unloading time, receiver and photos |
| 5 | **Deliveries → Acknowledge** | The **signed LR** reaches the office. Add detention, damage and courier details. The LR becomes **ready to bill** |
| 6 | **LR to Bill → Billing Register** | Make the **bill** (GST) from ready LRs, then approve and finalise it. Finalising posts the **sales voucher** and a **receivable** |
| 7 | **Client Receipts** | Record the customer's **payment** against bills. Approving it posts the **receipt voucher** and reduces the outstanding amount |

## 2. Road + rail flow (extra steps in the middle)

The goods travel in 3 parts: **truck to the railhead → train (rake) → delivery truck to the customer**.

```
 ORIGIN (railhead)                                         DESTINATION (branch)
 LR (Road + Rail) ──► truck reaches railhead
        ──► 1 GRN at Rail Head (one per LR) ─────┐
 2 VP Schedule ──► 3 MR/RR ──────────────────────┤
                                                 ▼
                         4 VP Loading (goods into wagons) ──► Rail rake is created
                                                 │
                         5 Rake at Rail Head ──► train travels ──► 6 Rake at Branch
                                                                   7 GRN at Branch (one per wagon)
                                                                   8 Delivery Challan (truck to customer)
                                                                   9 Delivered ──► Signed LR ──► Bill ──► Receipt
```

Steps 1 and 2–3 can happen in any order. They meet at step 4.

| Step | Screen | What happens |
|---|---|---|
| 1 | **GRN At Rail Head** | Goods from each LR's truck are received at the railhead: quantities, gate no., damage (with photo), checklist |
| 2 | **VP Schedule** | Plan the rake: date, route (from/to branch and railhead) and how many wagons of each type. Rail freight comes from the **Railway Freight** master. Confirm it |
| 3 | **MR / RR** | One row per wagon with the Railway details: sequence no., **VP no.**, MR/RR no., seal no. Submit it |
| 4 | **VP Loading** | Put the received goods into each wagon (one LR can go into several wagons). Add labour. Mark each wagon **Loaded**. A GPS tracker can be put on one wagon. **Finalise** creates the **rail rake** (number `RK/…`) |
| 5 | **Rake at Rail Head** | Time the rake stood at the origin station, and its **demurrage** and **wharfage** charges |
| 6 | **Rake at Branch** | The same, at the destination station |
| 7 | **GRN At Branch** | Unload each wagon: received, damaged and short quantities. When every wagon is done, the rake is **Received** |
| 8 | **Delivery Challans** | A **DC** puts goods on a delivery truck (own or transporter's), one customer per DC, with **LDC freight** and advance. Goods from several wagons can go on one DC. **Issue** it |
| 9 | **Deliveries** | An LR can be delivered only when all its goods are on issued DCs. Then it works like road: delivered, acknowledged, billed, paid |

⚠ Confirm: what "LDC" stands for in the company.

Developers: see [Road + Rail developer notes](../developer-guide/modules/04-road-and-rail.md).

## 3. Truck side (own trucks): journey and log slip

```
 Vehicle Journey (start at base) ──► Legs (trips) ──► Expenses & diesel ──► Truck returns to base
        ──► Settlement review ──► Log slip ──► Post to accounts ──► Vehicle P&L
```

| Step | Screen | What happens |
|---|---|---|
| 1 | **Vehicle Journeys** | A journey is one full round of an own truck with its driver, from base and back. It is made of **legs** (each leg is a trip) |
| 2 | Trip expenses / driver advances | Diesel, tolls and other costs, and advances given to the driver |
| 3 | Return | Closing the last leg at the base marks the journey **Returned** |
| 4 | Settlement → **Log slip** | Check expenses, mark ready, and **generate** the log slip: freight, diesel, expenses, driver balance |
| 5 | **Post to accounts** | Posts the log slip voucher. The journey is **settled** |
| 6 | **Vehicle Reports** | Profit per truck: freight − trip costs − repairs − monthly costs |

## 4. Paying others (money out)

| Who | Screen | Flow |
|---|---|---|
| **Transporters** (market trucks) and **hamali** (labour) | **Vendor Payments** | Payment slip → approval → disbursement (pay) → vouchers |
| **Drivers** | **Driver Payments** | Salary advance · monthly **salary run** (create → edit → approve → pay) · other driver payments |
| **Workshop suppliers** | **Workshop** | Purchase order → inward stock → job card → service bill → pay |

## 5. The books (accounts)

Every money action above posts a **voucher** automatically:

| Action | Voucher |
|---|---|
| Bill finalised | Sales: customer owes us |
| Receipt approved | Receipt: money in |
| Vendor slip approved / paid | Accrual / Payment |
| Salary run approved / driver paid | Journal / Payment |
| Log slip posted | Log slip voucher |

See them in **Books of Account**: Ledgers, Day Book and Chart of Accounts. Corrections are made with **reversals**, never by deleting.

## 6. Status words you will see

| Document | Statuses (in order) |
|---|---|
| Order | Pending approval → Confirmed → LR created (+ Rejected, Cancelled) |
| LR group | Draft → Finalised → Delivered (+ Cancelled) |
| Trip | Planned → In transit → Closed (+ Cancelled) |
| Vehicle journey | Active → Returned → Ready for log slip → Settled (+ Reopened) |
| VP schedule | Draft → Planned → MR/RR created → Loading → Loaded → Finalised (+ Cancelled) |
| GRN (rail head / branch) | Draft → Submitted (+ Cancelled) |
| Rail rake | Created → Unloading → Received |
| Delivery challan | Draft → Issued (+ Cancelled) |
| Bill | Draft → Pending review → Approved → Finalised → Sent → Partially paid → Paid (+ Cancelled) |
| Client receipt | Draft → Pending approval → Posted (+ Cancelled) |
| Vendor payment slip | Draft → Pending approval → Approved → Partially paid → Paid (+ Cancelled) |
| Driver salary run | Draft → Approved → Paid (+ Cancelled) |
