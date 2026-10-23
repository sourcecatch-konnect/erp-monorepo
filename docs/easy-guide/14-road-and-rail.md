# 14. Road + Rail

> Last checked: 2026-10-12 · For: rail team, destination branch staff

## The idea

For long distances, sending goods **by train** is cheaper than a truck all the way. A **Road & Rail** LR travels in **three parts**:

```
 1 FIRST MILE (road)         2 RAIL                          3 LAST MILE (road)
 Customer ── truck ──► Origin railhead ══ rake (train) ══► Destination railhead ── delivery truck ──► Consignee
```

The order and LR are made the normal way (Chapters 7–10), with **Transport = Road & Rail**. This chapter covers what happens **after** the first truck reaches the railway station.

## Words for this chapter

| Word | Meaning |
|---|---|
| **Railhead** | The railway station where goods go on or come off the train |
| **Wagon** | One railway coach. Types are set up in the **Wagons** master |
| **Rake** | The whole train of wagons carrying our goods |
| **VP schedule** | Our plan: on which date, which route, how many wagons of each type |
| **VP no.** | The railway's number for one wagon |
| **MR / RR** | Railway Receipt details from the Railway website, one row per wagon |
| **Indent / Lease rake** | Indent: booked through the railway schedule. Lease: without a schedule |
| **GRN** | Goods Received Note: goods counted and checked on arrival (quantity, damage, shortage) |
| **DC (Delivery Challan)** | Puts goods on a delivery truck from the destination branch to the consignee |
| **Demurrage / wharfage** | Railway charges when the rake or goods stay too long at a station |

## The 9 steps

```
 ORIGIN (railhead)                                     DESTINATION (branch)
 ① GRN at Rail Head ───────┐
 ② VP Schedule → ③ MR/RR ──┤
                           ▼
           ④ VP Loading (goods into wagons) → rake created
                           │
           ⑤ Rake at Rail Head ══ train ══ ⑥ Rake at Branch
                                            ⑦ GRN at Branch (per wagon)
                                            ⑧ Delivery Challan
                                            ⑨ Delivered → signed LR → bill
```

Steps ① and ②–③ can happen in any order. They meet at step ④.

| Step | Screen (Operations → VP Management) | What you do | Done when |
|---|---|---|---|
| **① GRN at Rail Head** | GRN At Rail Head | Pick the finalised Road & Rail LR. Count the goods that arrived: quantity, gate no., supervisor, checklist. **Damage needs a photo.** **Submit** | GRN **Submitted** (one per LR) |
| **② VP Schedule** | VP Schedule | Plan the rake: **date**, from/to branch, source/destination railhead, **wagon type × count**. Rail freight comes from the **Railway Freight** master. **Confirm** | Schedule **Planned** |
| **③ MR / RR** | MR / RR | One row per wagon: sequence no., **VP no.**, **MR/RR no.**, **seal no.**, and Indent or Lease. **Submit** | Schedule **MR/RR created** |
| **④ VP Loading** | VP Loading | For each wagon, choose which GRN goods go in, and how many. One LR can be split over several wagons. Add labour. Mark each wagon **Loaded**. A GPS tracker can be fitted on one wagon. **Finalise** | Rail **rake** created (number RK/…) |
| **⑤ Rake at Rail Head** | Rake & DC/WC (rail head) | Record how long the rake stood at the origin station, and any **demurrage / wharfage** | Submitted |
| **⑥ Rake at Branch** | Rake & DC/WC (branch) | The same at the destination station | Submitted |
| **⑦ GRN at Branch** | GRN At Branch | For **each wagon**: received, damaged and short quantities. **Submit** | When every wagon is done, the rake is **Received** |
| **⑧ Delivery Challan** | Delivery Challans | Put goods on a delivery truck (own or transporter's). **One consignee per DC.** Goods from several wagons can go on one DC. Enter LDC freight and advance. **Issue** | DC **Issued** |
| **⑨ Delivery** | Deliveries | Same as road (Chapter 15). An LR can be delivered only when **all** its goods are on issued DCs | LR **Delivered** |

## Statuses

| Document | Statuses |
|---|---|
| GRN (rail head / branch) | Draft → Submitted (or Cancelled) |
| VP schedule | Draft → Planned → MR/RR created → Loading → Loaded → Finalised (or Cancelled) |
| Rail rake | Created → Unloading → Received |
| Delivery challan | Draft → Issued (or Cancelled) |

## Tracking the wagons

**Container → Wagon Tracking** shows the live GPS position of the tracker fitted on the rake (OneLap).

## Rules to remember

- On a GRN, the total quantity must **equal** the LR's goods quantity.
- A GRN **can't be cancelled** once its goods are loaded in a wagon.
- Only **one VP schedule** per date and route.
- A delivery challan is for **one rake** and **one consignee**.

## Common problems

| Problem | Fix |
|---|---|
| LR not offered on GRN at Rail Head | The LR must be **Finalised**, **Road & Rail**, and its railhead branch must be one of your branches |
| Can't submit GRN with damage | Add the **damage photo** (image under 2 MB) |
| No rail freight on the schedule | Add the **Railway Freight** master row for that wagon type and stations |
| LR can't be marked delivered | Some of its goods are not yet on an **issued** delivery challan |

⚠ Confirm: what "LDC" stands for in the company.
