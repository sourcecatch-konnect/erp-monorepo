# 11. Trips

> Last checked: 2026-10-12 · For: booking / operations staff

## What is a trip?

A **trip** is **one movement of our own truck** from one place to another.

> *Truck MH19-AB-1234, driver Ramesh, Pune → Kolkata, carrying ABC Industries' goods.* That is one trip.

Trips are **only for own trucks**. A market (hired) truck has no trip: its details are on the LR group instead (Chapter 9).

## Why we need it

- Shows **which truck** is where, and **who** is driving it.
- Records **KM** (opening and closing), so we know distance and diesel average.
- Records the **onward freight** the truck earns for this movement, which is used for the truck's profit.
- Each trip is a **leg** of a **vehicle journey** (Chapter 12), which later settles the driver's account.

## Types of trip

| Type | What the truck does | Example |
|---|---|---|
| **LR trip** | Carries goods on an **LR** (normal road job) | Pune → Kolkata with LR 00051 |
| **DC trip** (shown as "Rake (DC)") | Carries goods from a **train** (rake) to the customer, on a **delivery challan** | Kolkata station → customer warehouse |
| **Empty trip** | Moves **without goods** | Going empty to pick up the next load |

When you look at a journey, you will also see **Local**, **Return**, **Workshop** and **Other** legs (Chapter 12).

## Before you start

- The **vehicle** is an **own** truck with **valid insurance**.
- The **driver** has a **valid licence**.
- The **route** exists in masters.

## How to create a trip

You can create a trip in two places:

| Where | When |
|---|---|
| Inside the **LR form** → **Create trip** | Most common. The trip is selected on the LR automatically |
| **Container → Trips → New Trip** | To plan a trip first, or for an empty trip |

Fill in:

| Field | What to fill |
|---|---|
| **Vehicle** | Our truck |
| **Driver** | Its driver (if the truck is already on a journey, the journey's driver is used) |
| **Route** | From → to |
| **Client** | The customer (for an LR trip) |
| **Onward freight** | What this truck earns for this movement |
| **Opening KM** | Odometer reading at start. The ERP suggests **previous closing KM + 1** |
| **This is an empty trip (no goods)** | Tick for an empty movement |
| **Truck already dispatched** | Tick if the truck **already left**, then enter the real start date/time. Otherwise enter the **planned dispatch** date/time |

Click **Save**.

## What happens after you save

The ERP automatically adds the trip to the truck's **vehicle journey**:
- If the truck has an **active journey**, the trip becomes its **next leg**.
- If not, a **new journey** is started at the Head Office.

**KM must continue:** the new trip's opening KM should equal the last trip's closing KM + 1. If it doesn't, the ERP asks for an **exception reason**. Only users with the chain-override permission can save it.

## The life of a trip

```
 Planned ──dispatch──► In transit ──close──► Closed
    │
    └──cancel──► Cancelled
```

| Status | Meaning | How it gets there |
|---|---|---|
| **Planned** | Created, truck hasn't left | Saved with a planned dispatch time |
| **In transit** | Truck is on the road | Attaching an **LR group** dispatches it, or it was saved as "already dispatched" |
| **Closed** | Truck reached and unloaded | You **close** the trip |
| **Cancelled** | Not going ahead | Cancel (only if it is not a journey leg in use) |

## How to close a trip

When the truck reaches and unloads: open the trip → **Close** and enter:

| Field | |
|---|---|
| **Closing KM** | Odometer at arrival (must be a positive number) |
| **Arrival at destination** | Date/time the truck arrived |
| **Unloading completed** | Date/time unloading finished |

If this trip ends at the journey's **return city**, the journey becomes **Returned** (Chapter 12).

## Other actions

| Action | Use it when |
|---|---|
| **Reschedule** | A planned trip's dispatch time changes |
| **Correct** (in transit) | The real dispatch time or freight was entered wrong. No need to wait for the trip to close |
| **Correct** (closed) | The closing details were wrong |

## Common problems

| Problem | Reason | Fix |
|---|---|---|
| Truck not in the list | Insurance expired, it is a market truck, or it is busy | Check the vehicle master |
| "Trip breaks journey continuity…" | Opening KM or start city doesn't follow the last trip | Correct the KM, or give a reason (needs permission) |
| "This trip is a journey leg and can't be deleted or cancelled directly" | Trips are managed from their journey | Open the vehicle journey |
| "Trip … belongs to a different consignor" (on the LR) | The trip is for another customer | Create a trip for this customer |

## Try it yourself (test system only)

1. Create a planned trip for a test truck, Pune → Kolkata.
2. Attach it to an LR group. Check the trip becomes **In transit**.
3. Close it with a closing KM. Check it is **Closed**, and open its **journey**.
