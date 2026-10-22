# 9. Types of LR

> Last checked: 2026-10-12 · For: booking / operations staff

Every LR group has **four choices**. Together they decide how the job runs. You make these choices in the LR form (Chapter 10).

| Choice | Options | Question it answers |
|---|---|---|
| **1. Transport** | Road · Road & Rail | How do the goods travel? |
| **2. Vehicle** | Own Vehicle · Market Vehicle | Whose truck carries them? |
| **3. Payment mode** | To be Billed · To Pay | How does the customer pay the freight? |
| **4. Priority** | Normal · Express · Critical | How urgent is it? |

There is also a fifth difference: whether the LR comes **from an order** or is an **Instant LR** (see Chapter 8).

## 1. Transport: Road or Road & Rail

### Road

The truck loads at the customer and drives **straight** to the receiver.

```
 Loading point ──── truck ────► Unloading point
```

Use it for most jobs.

### Road & Rail

The goods travel in **three parts**:

```
 Loading point ── truck ──► Railhead (station) ══ train ══► Railhead (station) ── delivery truck ──► Receiver
```

When you choose **Road & Rail**, three more fields appear:

| Field | Meaning |
|---|---|
| **Source railway branch** | The branch that handles the rail work at the starting station |
| **Source railhead** | The station where goods are loaded on the train |
| **Destination railhead** | The station where goods come off the train |

After this, the rail team takes over with extra screens (VP Schedule, wagon loading, GRN, delivery challan). These are explained in **Part E: Road + Rail**.

## 2. Vehicle: Own or Market

### Own Vehicle

A **company truck** with a **company driver**.

- You link the LR group to a **trip**. A trip is one movement of our truck (see Part D).
- Pick an existing trip, or click **Create trip** to make one without leaving the LR form.
- Linking a **planned** trip **dispatches** it: the trip becomes **In transit**.
- The truck's **insurance** and the driver's **licence** must be valid, or the trip is blocked.

### Market Vehicle

A truck **hired from an outside transporter** for this job. We pay the transporter.

You enter what was agreed with the transporter:

| Field | Meaning |
|---|---|
| **Transporter** | The transporter or broker (from masters) |
| **Vehicle number** and **driver** | The hired truck and its driver |
| **Freight amount** | What we pay the transporter for this truck |
| **Advance amount** | Paid to the transporter before the trip |
| **Commission** | Broker commission deducted |
| **Hamali** | Loading/unloading labour charge deducted |
| **TDS** | Tax deducted |

The ERP works out two totals for you:

| Total | Formula | Example |
|---|---|---|
| **Total Freight Advance** | Advance + Commission + Hamali + TDS | 30,000 + 1,000 + 500 + 600 = **₹32,100** |
| **Net Balance Freight** | Freight − Total Freight Advance | 60,000 − 32,100 = **₹27,900** still to pay |

A market truck or driver **can't be on two open LR groups** at the same time.

### Own vs market at a glance

| | Own Vehicle | Market Vehicle |
|---|---|---|
| Truck belongs to | SK Translines | An outside transporter |
| Linked to | A **trip** | A **transporter** |
| Costs recorded as | Diesel, tolls, driver expenses (on the trip and journey) | Freight, advance, commission, hamali, TDS (on the LR group) |
| Paid through | Driver advances, log slip, salary | **Vendor Payments** to the transporter |

## 3. Payment mode: To be Billed or To Pay

| Mode | Meaning | What happens next |
|---|---|---|
| **To be Billed** (default) | We send the customer a **GST bill** later | After delivery and the signed LR, the LR goes to **billing** |
| **To Pay** | Freight is **collected** at delivery | Freight is collected when the goods are handed over. ⚠ Confirm how To Pay freight is collected and recorded |

Most company customers are **To be Billed**.

## 4. Priority: Normal, Express or Critical

Tells the team how urgent the load is. **Normal** is the default. Choose **Express** or **Critical** when the customer needs it fast, so the team can plan accordingly.

## Which combination should I pick?

| Situation | Transport | Vehicle | Payment |
|---|---|---|---|
| Regular customer, our truck is free | Road | Own | To be Billed |
| Regular customer, no own truck free | Road | Market | To be Billed |
| Long distance, rail is cheaper | Road & Rail | Own or Market (for the first leg) | To be Billed |
| Small party pays on delivery | Road | Own or Market | To Pay |
