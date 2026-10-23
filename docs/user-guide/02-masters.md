# Masters: the base records

> Last checked: 2026-10-09 · Who: admins, managers (add/edit); everyone else can usually only view

**Masters** are the base records the rest of the ERP uses: customers, vehicles, drivers, routes, rates and so on. Set them up **once**, and keep them correct. A wrong master (e.g. a wrong rate) gives wrong LRs and bills.

**Where:** sidebar → **Master Data → Masters**.

## How every master screen works

All masters use the **same screen**, so learn it once:

| Action | How | Note |
|---|---|---|
| **Find** | Type in the search box | Searches the main fields (name, code, phone…) |
| **Add** | Click **Add** → fill the form → **Save** | Fields with * are required |
| **Edit** | Click a row → change → **Save** | |
| **Delete** | Row menu → **Delete** | **Refused if the record is already used** (e.g. a branch with LRs). Then it stays |
| **Import** | **Import** → choose a file | To add many records at once. ⚠ Confirm the file format/template to use |
| **Export** | **Export** | Downloads the list as a CSV file (opens in Excel) |

[screenshot: a master list page with Add / Import / Export]

## Set them up in this order

Some masters need others first. Follow this order for a new setup:

```
1. Company → Branch (mark the Head Office) → State → City → Area (mark railheads)
2. Route (from city → to city)
3. Customer (+ their locations) → Agreement → Rate Matrix (freight per route & vehicle type)
4. Vehicle Type → Transport (transporters) → Vehicle (own or market) → Driver
5. Goods, Units of Measure, Labour, Pumps, Creditors, Cash Accounts
6. Rail: Wagons → Railway Freight
7. Workshop: Spare Categories → Spare Part Suppliers → Spare Parts
```

## Every master in one table

| Group | Master | What it is for | Needs first | Special rules |
|---|---|---|---|---|
| Places | **States / Cities / Areas** | Addresses and locations. An **Area** can be marked **Rail Head** (railway station) | State → City | An area used as a railhead can't be removed while branches, VP, freight or LRs use it |
| Places | **Routes** | From city → to city, used by orders, trips and rates | Cities | — |
| Places | **Branches** | Offices. One is the **Head Office** (base for journeys). A branch can manage **railheads** | Company, City | Code must be unique. The Head Office can't be deleted. A branch in use can't be deleted |
| Places | **Warehouses** | Godowns: size, rent, agreement dates | Branch, City | Can't be deleted while linked |
| Fleet | **Vehicles** | Truck number, type, own or **market**, insurance, KM | Vehicle type (+ transporter for market trucks) | Number must be unique. A **market vehicle needs a transporter**. **Expired insurance blocks** new trips/journeys |
| Fleet | **Vehicle Types** | 32HQ, 407, 6 Wheeler… with a freight range | — | Code must be unique |
| Fleet | **Drivers** | Name, mobile, **licence** (number, expiry), ID, **salary**, **joining/leaving date** | Branch | An **expired licence blocks** trips. Salary and dates are used by the salary run |
| Fleet | **OneLap Trackers** | GPS devices, synced from OneLap | — | — |
| Parties | **Customers** | Name, short code, GST, PAN, credit limit, TDS rate, contacts, **locations** (loading/unloading points) | City, State | A location used in orders can't be deleted. "**Disallow new booking**" makes the approver confirm before approving an order |
| Parties | **Transports** | Transporters / brokers (market trucks) | City, State | Name and mobile number must be unique |
| Parties | **Creditors** | Other suppliers we pay (rent, expenses…) | Branch | — |
| Parties | **Labours** | Hamali / loading labour | Branch, City | — |
| Parties | **Pumps** | Diesel pumps: current rate, credit limit, blacklisted | City, State | — |
| Parties | **Spare Part Suppliers** | Workshop suppliers | — | — |
| Rates & rail | **Agreements** | Contract with a customer (company, start/expiry dates) and **detention rates** | Customer, Company, Branch | — |
| Rates & rail | **Rate Matrix** | **Freight per truck** for an agreement + route + vehicle type + unit + Road / Rail | Agreement, Route, Vehicle type | Only **one rate** per agreement + route + vehicle type + unit + transport type. Orders take their freight from here |
| Rates & rail | **Railway Freight** | Rail freight per wagon between two railhead areas | Wagons, Areas marked Rail Head | Source and destination must be railheads in the chosen cities |
| Rates & rail | **Wagons** | Wagon types with size and capacity (CFT, MT) | — | Name must be unique |
| Goods & spares | **Goods / Units of Measure** | What is carried and its units | — | Unit code must be unique |
| Goods & spares | **Spare Parts / Spare Categories** | Workshop parts, **minimum stock** (low-stock badge) | Category, Supplier | — |
| Company | **Company** | Company details, PAN, TAN, logo | City, State | Name must be unique |
| Company | **Cash Accounts** | Cash and bank accounts used for payments | — | Starting balances: **Finance → Cash & Bank → Opening Balances** |

## Common problems

| Problem | What to do |
|---|---|
| "…already exists" | That name, code, number or phone is already used. Search for the existing record |
| Can't delete a record | It's already used (in LRs, orders, trips…). Leave it, or mark it inactive where that option exists |
| An order shows no freight | No **Rate Matrix** row for that customer's agreement + route + vehicle type. Add one |
| A truck can't start a trip | Check the vehicle's **insurance date** and the driver's **licence expiry** |
| A market truck can't be saved | Pick its **transporter** |
