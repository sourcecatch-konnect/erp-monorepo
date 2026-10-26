# 19. Workshop

> Last checked: 2026-10-12 · For: workshop and store staff, accounts

## The idea

Our own trucks need **repairs** and **spare parts**. The Workshop module tracks:
- buying parts (**purchase order**) and receiving them into stock (**inward**)
- using parts and services on a truck (**job card**)
- bills from outside garages (**service bill**)
- parts sent back to suppliers (**supplier replacement**)

The repair cost of each truck feeds its **profit report** (Chapter 20).

```
 Purchase Order ──► Inward Stock ──► Stock ──► Job Card (parts used on a truck)
                                                   └──► Service Bill (outside garage) ──► Pay
```

## The screens

**Menu: Workshop**

| Screen | What it is | Statuses |
|---|---|---|
| **Purchase Orders** | Order spare parts from a supplier | Draft → Approved → Sent → Partially received → Received → Closed (or Cancelled) |
| **Inward Stock** | Parts arrive and go into stock | Draft → Posted (or Cancelled) |
| **Stock** | Parts on hand. A **low-stock badge** shows when a part falls below its minimum | — |
| **Job Cards** | One repair job on one truck: parts and services used | Draft → Finalised (or Cancelled) |
| **Service Bills** | Bill from an outside workshop, and its payment | Draft → Posted (or Cancelled) |
| **Supplier Replacement** | Faulty parts returned to or replaced by the supplier | Pending → Partially received → Received → Posted (or Cancelled) |

## Step by step

### 1. Order parts (Purchase Order)

**Workshop → Purchase Orders → New.** Choose the **supplier** and add parts with quantity and rate. Save, get it **approved**, and send it to the supplier.

### 2. Receive parts (Inward Stock)

When the parts arrive: **Workshop → Inward Stock → New.** Link the purchase order, enter what actually arrived (quantity, batch no., invoice), and **post** it. The stock goes up, and the PO becomes **Partially received** or **Received**.

### 3. Repair a truck (Job Card)

**Workshop → Job Cards → New Job Card.** Fill:

| Field | What to fill |
|---|---|
| **Vehicle**, **Driver**, **Branch** | Which truck |
| **Truck status** | At HO or In Transit |
| **In date/time** / **Out date/time**, **Opening KM** | When the truck came in and went out |
| **Mechanic** | Who did the work |
| **Part List** | Parts used from stock (part name, batch, quantity) |
| **Service** | Work done (in-house or by an outside **provider**), with rate and amount |
| Removed parts | Condition of the removed part: Reusable, Repairable or Scrap |

**Finalise** when the work is done. Stock goes down for the parts used. **Undo Finalise** is available if it was finalised by mistake.

### 4. Outside garage bill (Service Bill)

When an outside workshop did the job: open the **Service Bill** from the job card, check the **Billed Services**, and **post** it. Then pay it: **Pay**, choose the **Mode** (Cash, Bank, Cheque), the **From account** and the **Payment date**, then **Confirm payment**.

### 5. Return a faulty part (Supplier Replacement)

**Workshop → Supplier Replacement.** Record the part sent back, then record the replacement when it arrives.

## Common problems

| Problem | Fix |
|---|---|
| Part not in the list | Add it in **Masters → Spare Parts** (with category and supplier) |
| Not enough stock for the job card | Receive the parts first (**Inward Stock**) |
| Low-stock badge showing | Make a purchase order for that part |
