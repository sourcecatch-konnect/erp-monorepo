# 12. Vehicle Journey

> Last checked: 2026-10-12 · For: operations staff, accounts

## What is a vehicle journey?

A **vehicle journey** is **one full round** of an own truck: it leaves its **home base**, does one or more trips, and **comes back**.

```
                    VEHICLE JOURNEY (one round)
 Jalgaon ──leg 1──► Pune ──leg 2──► Kolkata ──leg 3──► Nagpur ──leg 4──► Jalgaon
  (base)    LR        LR               Empty             Return           (back)
```

Each movement inside the journey is a **leg**. A leg is a **trip** (Chapter 11).

## Trip vs journey

| | Trip | Vehicle journey |
|---|---|---|
| **Covers** | One movement, A → B | The whole round, base → … → base |
| **Records** | KM, freight, LR for that movement | All legs, driver advances, expenses, diesel |
| **Ends with** | Closing the trip | The **log slip**: settlement of freight, costs and the driver's account |

## Why we need it

The driver gets **cash advances** and spends money on **diesel, tolls and food** across several trips. We can only check his account properly when the **whole round** is finished. The journey collects everything for that round in one place.

## Types of leg

| Leg type | Meaning |
|---|---|
| **LR** | Carries goods on an LR |
| **Rake (DC)** | Carries goods from a train to the customer (delivery challan) |
| **Empty** | Moves without goods |
| **Local** | Short local movement |
| **Return** | Coming back towards base |
| **Workshop** | Going to or from the workshop |
| **Other** | Anything else |

## How a journey starts

**Usually automatic:** when you create a trip for a truck that has no active journey, a new journey opens at the Head Office.

**By hand:** **Container → Vehicle Journeys → Start Journey**, then fill:

| Section | Fields |
|---|---|
| **Vehicle & Driver** | Vehicle, Driver |
| **Base / Return Rule** | **Home branch**, **Return city** (the journey closes when the truck gets back here) |
| **First Leg** | Leg type, Route, Client, Onward freight, Opening KM, Start date/time, "This leg runs empty" |

## During the journey

Open the journey to:

| Action | What it does |
|---|---|
| **Add leg** | Adds the next movement. Shows where the previous leg ended. KM must continue, or give an exception reason |
| **Edit leg** | Fix a leg's freight, route or KM |
| **Advances** | Record cash given to the driver (Chapter 13) |
| **Expenses** | Record diesel, tolls and other costs (Chapter 13) |
| **Download Journey PDF** | Printable summary of the journey |

## How a journey ends

```
 Active ──last leg closed at return city──► Returned ──Mark ready──► Ready for Log Slip
        ──Generate Log Slip──► (log slip generated) ──Post to accounts──► Settled
```

| Status | Meaning | What to do |
|---|---|---|
| **Active** | Truck is out | Add legs, advances and expenses |
| **Returned** | Last leg closed at the **return city** | Review expenses, then **Mark ready** |
| **Ready for Log Slip** | Expenses checked | **Generate Log Slip** |
| **Settled** | Log slip posted to accounts | Done |
| **Reopened** | A settled or ready journey was opened again for correction | Fix, then settle again |
| **Cancelled** | Journey cancelled | Allowed only while no leg has been dispatched or closed |

**Truck didn't come back to base?** Use **Close journey away from base** and give the reason.

## Common problems

| Problem | Fix |
|---|---|
| "Breaks journey continuity" when adding a leg | Opening KM must be the previous closing KM + 1, and the start city must match where the last leg ended. Correct it, or give a reason (needs permission) |
| Journey stays **Active** after the truck is back | The last leg's route doesn't end at the **return city**. Close the leg there, or use **Close journey away from base** |
| Can't cancel the journey | A leg has already been dispatched or closed |
