# 5. What is a master?

> Last checked: 2026-10-12 · For: everyone (understand it), admins and managers (set it up)

## The idea

A **master** is a **base record** that you set up **once** and then **pick from a list** everywhere else.

> Instead of typing "ABC Industries Pvt Ltd, Pune, GST 27AAB…" on every order, you add **ABC Industries** once in the **Customers** master. After that, you just pick it from the drop-down.

Customers, trucks, drivers, routes, branches and rates are all masters.

## Why masters matter

- **No typing mistakes:** "ABC Ind." and "ABC Industries" don't become two different customers.
- **Correct money:** freight on an order comes from the **Rate Matrix** master. A wrong rate there means wrong bills everywhere.
- **Checks and blocks:** the ERP uses masters to stop mistakes. Example: a truck with **expired insurance** or a driver with an **expired licence** can't start a trip.
- **Reports work:** profit per truck or per customer is only possible if every record points to the same truck or customer.

**Rule: a wrong master gives wrong LRs and wrong bills.** Keep masters correct.

## Where to find them

**Menu: Master Data → Masters.** All masters are in one place, grouped as Places, Fleet, Parties, Rates & rail, Goods & spares, and Company.

## Every master screen works the same way

| Action | How | Note |
|---|---|---|
| **Find** | Type in the search box | Searches name, code, phone… |
| **Add** | **Add** → fill the form → **Save** | Fields with \* are required |
| **Edit** | Click the row → change → **Save** | |
| **Delete** | Row menu → **Delete** | **Refused if the record is already used** (e.g. a customer with orders). This protects old records |
| **Import** | **Import** → choose a file | Add many records at once |
| **Export** | **Export** | Download the list as CSV (opens in Excel) |

**Search before you add.** The record may already exist with a slightly different name.

## Set them up in this order

Some masters need others first. For example, you can't add a city before its state, or a rate before the route exists.

```
 1 PLACES     Company → Branch (mark Head Office) → State → City → Area (mark railheads)
                 │
 2 ROUTES     Route (from city → to city)
                 │
 3 CUSTOMERS  Customer (+ locations) → Agreement → Rate Matrix
                 │
 4 FLEET      Vehicle Type → Transport (transporters) → Vehicle → Driver
                 │
 5 OTHERS     Goods, Units, Labour, Pumps, Creditors, Cash Accounts
                 │
 6 RAIL       Wagons → Railway Freight
                 │
 7 WORKSHOP   Spare Categories → Spare Part Suppliers → Spare Parts
```

## What you need before your first order

To create one order and one LR, at least these must exist:

- [ ] **Branch** (from and to)
- [ ] **City** and **Route**
- [ ] **Customer** with its **locations** (loading point) and the **consignee** (with its unloading point)
- [ ] **Agreement** for the customer, and a **Rate Matrix** row for the route + vehicle type
- [ ] **Vehicle Type**
- [ ] **Goods** and **Units of Measure**
- [ ] For an own truck: **Vehicle** + **Driver** (valid insurance and licence)
- [ ] For a market truck: **Transport** (the transporter)

The next chapter explains each master in simple words.
