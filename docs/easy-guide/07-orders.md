# 7. Orders

> Last checked: 2026-10-12 · For: booking / operations staff (create), branch managers (approve)

## What is an order?

An **order** is the customer's request to move goods. It is the **first step** of every job.

> *"ABC Industries needs 3 trucks of 32 ft from Pune to Kolkata on 15 October."*

That sentence is one order. Nothing moves until an order exists (except an Instant LR, see Chapter 8).

## Why we need it

- It records **what the customer asked for**, before any truck is arranged.
- It fixes the **freight** from the customer's agreed rate, so nobody types a wrong amount.
- A manager **approves** it, so only genuine, correct orders go ahead.
- Later, every LR, truck and bill can be traced back to this order.

## Two types of order

| Type | In the form | Use it when | How freight is worked out |
|---|---|---|---|
| **Truck hire** | "Truck hire" | The customer books **whole trucks** (most common) | **Automatic**: rate per truck × number of trucks, from the **Rate Matrix** (e.g. ₹90,000 × 3 = ₹2,70,000) |
| **Item / Goods** | "Item / Goods" | The customer sends **goods by quantity**, not whole trucks | Entered **by hand** |

## Before you start (what must already exist)

These come from the **masters**. If one is missing, ask your admin or manager to add it first.

| Needed | Why |
|---|---|
| **Customer** | Who sends the goods and pays |
| **Consignee** | Who receives the goods |
| **Branches** (from / to) | Which office handles the start and end |
| **Route** (from city → to city) | Where the goods go |
| **Vehicle type** (for Truck hire) | 32 ft, 20 ft, 407… |
| **Rate Matrix** row for this customer + route + vehicle type | Without it, the order has **no freight** |
| **Customer location** (optional) | A saved pickup address |

## How to create an order

**Menu: Operations → Orders → Create New Order**

**Section 1: Customer & Route**

| Field | What to fill |
|---|---|
| **Customer (Consignor)** \* | The customer sending the goods |
| **Consignee** | The receiver |
| **From branch** / **To branch** \* | Starting and ending office |
| **Route** \* | e.g. Pune → Kolkata |
| **Pickup date** \* | When the truck should reach the customer |
| **Saved pickup location** | Choose the customer's saved loading address |
| **Pickup address override** | Type an address **only** if it's different from the saved one |

**Section 2: Order type**

Click **Truck hire** or **Item / Goods**.

- **Truck hire:** choose the **Vehicle type** and enter the **Truck quantity** (e.g. 3). You **don't** enter goods or loading points here. Those are added per truck when you make each LR.
- **Item / Goods:** add one line per item: **goods**, **quantity**, **weight** and **unit**.

**Section 3: Contact & Notes** (optional)

- Click **Add contact** if the pickup contact person is different from the customer: **Contact person**, **Mobile number** (10 digits), **Email address**.
- **Special instructions:** anything the team must know ("call before arriving", "fragile").

Click **Save**. The order gets a number and its status is **Pending approval**.

## How to approve an order (branch manager)

Open the order. You will see these buttons:

| Button | When to use it | What you must enter |
|---|---|---|
| **Approve** | The order is correct | Check the **freight**. To use a different amount, type it **and give a reason** |
| **Reject** | The order can't be accepted | A reason (at least 3 characters) |
| **Cancel** | The customer cancelled (only Pending or Confirmed orders) | A reason |
| **Edit** | Something needs fixing **before** any LR is made | — |

**Warning flag:** some customers are marked **"disallow new booking"** (e.g. unpaid dues). When approving their order, the ERP asks you to **confirm** that you really want to go ahead.

After approval, the status becomes **Confirmed**, and the **Create LR** button appears.

## Order status: what each one means

```
 Pending approval ──Approve──► Confirmed ──Create LR──► LR created
        │                         │
        └──Reject──► Rejected     └──Cancel──► Cancelled
```

| Status | Meaning | What to do next |
|---|---|---|
| **Pending approval** | Saved, waiting for the manager | Manager: approve or reject |
| **Confirmed** | Approved, trucks can be arranged | Make the LR for each truck (Chapter 10) |
| **LR created** | LRs have been made from this order | Follow the LRs |
| **Rejected** | Manager refused it | Nothing. Read the reason |
| **Cancelled** | Customer or company cancelled it | Nothing |

## Rules to remember

- An order **can't be edited** once LRs have been made from it, or after it is cancelled.
- One order for **3 trucks** = **3 LR groups** later (one per truck).
- Freight comes from the **Rate Matrix**. If the rate is wrong, fix the Rate Matrix (ask your manager). Don't just type over it.

## Common problems

| Problem | Reason | Fix |
|---|---|---|
| Order shows **no freight** | No Rate Matrix row for this customer + route + vehicle type | Ask the admin to add the rate, then open the order again |
| Customer not in the list | Not added to masters yet | Search with another spelling, then ask the admin |
| **Create LR** button missing | Order is not **Confirmed** yet | Get it approved first |
| Can't edit the order | LRs already exist, or it's cancelled | Ask your manager |

## Try it yourself (test system only)

1. Create a **Truck hire** order for 2 trucks. Check that the freight = rate × 2.
2. Sign in as a manager and **approve** it. Check the status changes to **Confirmed**.
3. Create another order and **reject** it with a reason. Check the status is **Rejected**.
