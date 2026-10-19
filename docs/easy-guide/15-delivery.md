# 15. Delivery and the signed LR

> Last checked: 2026-10-12 · For: branch staff, operations, accounts

## The idea

Two things must happen before we can bill the customer:

1. The goods are **delivered**: unloaded and handed to the receiver.
2. The **signed LR** (proof of delivery, **POD**) reaches our office and is **acknowledged**.

```
 LR Finalised ──► Mark delivered ──► Delivered ──► Signed LR reaches office ──► Acknowledge POD ──► Ready to bill
```

## Why two steps?

- **Delivered** happens at the customer's place, on the day of unloading.
- The **signed LR** travels back later (by hand or courier) to the office. Only then do we have proof, and only then can we bill.

## The Deliveries screen

**Menu: Operations → Deliveries.** At the top you see counts:

| Box | Meaning |
|---|---|
| **Pending delivery** | LRs on the road, not yet delivered |
| **Pending POD** | Delivered, but the signed LR hasn't been acknowledged |
| **At hub** | LR groups waiting at a hub for the next truck |
| **Avg delivery days (30d)** | How long deliveries took on average |

## Step 1: Mark delivered

Find the LR → **Mark delivered**. Fill:

| Field | What to fill |
|---|---|
| **Delivered at** | Date and time the goods were handed over |
| **Unloading completed at** | When unloading finished |
| **Receiver name** / **Receiver phone** | Who took the goods |
| **Unloading charge paid** | If we paid for unloading |
| **POD photos** | Photo of the signed LR or stacked goods (optional) |
| **Remark** | Optional |

**Many LRs delivered together?** Select them and use **bulk deliver**. Shared details apply to all, with an override per LR where needed.

Made a mistake? Open the delivery and **Save changes**. The delivered status is not affected.

## Step 2: Acknowledge the signed LR (POD)

When the signed LR arrives at the office: find the LR → **Acknowledge POD**. Fill:

| Field | What to fill |
|---|---|
| **POD received at** | Date and time the signed LR arrived |
| **Received qty** / **Damaged qty** | As written by the receiver on the LR |
| **Damage amount** | Value of damage, if any |
| **Detention days** / **Detention amount** | If the customer kept the truck waiting too long. This is **billed to the customer** |
| **Courier name**, **Courier docket no.**, **Courier charge** | If the LR came by courier |
| **POD scans** | Scan of the signed LR |
| **Remark** | Optional |

After this, the LR is **Acknowledged** and appears in **Finance → LR to Bill**.

## LR Unloading Report

**Operations → LR Unloading Report** lists unloading details for all LRs: when, where, who received, and how long it took. Use it to follow up on late deliveries.

## Who does what

| Step | Who (default roles) |
|---|---|
| Mark delivered | Operations, Branch Manager |
| Acknowledge POD | Branch Manager, Accounts |

## Common problems

| Problem | Fix |
|---|---|
| LR not in Pending delivery | It isn't **Finalised** yet (Chapter 10) |
| Road & Rail LR can't be delivered | Not all goods are on **issued** delivery challans (Chapter 14) |
| LR not in LR to Bill | The signed LR hasn't been **acknowledged** yet |

## Try it yourself (test system only)

1. Take the finalised LR from Chapter 10. **Mark delivered** with a receiver name.
2. Check it moved from **Pending delivery** to **Pending POD**.
3. **Acknowledge POD** with 1 detention day of ₹1,000.
4. Open **Finance → LR to Bill** and find the LR.
