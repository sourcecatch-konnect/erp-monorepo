# 6. Each master explained

> Last checked: 2026-10-12 · For: everyone

## Places

| Master | What it is | Example | Remember |
|---|---|---|---|
| **Company** | Our company's legal details: PAN, TAN, logo | SK Translines | Printed on bills and LRs |
| **Branch** | One of our offices | Jalgaon (Head Office), Pune, Kolkata | One branch is the **Head Office**: own trucks start and end their journeys there |
| **State / City** | Addresses | Maharashtra → Pune | Add the state first |
| **Area** | A place inside a city. Can be marked **Rail Head** (railway station) | Amalner station | Railheads are used for road + rail jobs |
| **Route** | From city → to city | Pune → Kolkata | Used by orders, trips and rates |
| **Warehouse** | A godown: size, rent, agreement dates | Kolkata godown 1 | |

## Fleet (trucks and drivers)

| Master | What it is | Example | Remember |
|---|---|---|---|
| **Vehicle Type** | Kind of truck | 32 ft, 20 ft, 407, 6-wheeler | Rates are set per vehicle type |
| **Vehicle** | One truck: number, type, **own or market**, insurance date, KM | MH19-AB-1234 | Number must be unique. **Expired insurance blocks** new trips. A **market** vehicle needs its transporter |
| **Driver** | Name, mobile, **licence** (number, expiry), ID, **salary**, joining/leaving date | Ramesh Patil | **Expired licence blocks** trips. Salary and dates feed the monthly salary run |
| **OneLap Tracker** | GPS devices, synced from OneLap | Tracker 0042 | Shows live location in Wagon Tracking |

## Parties (people and companies we deal with)

| Master | What it is | Example | Remember |
|---|---|---|---|
| **Customer** | Who sends goods and pays us: GST, PAN, credit limit, TDS, contacts, **locations** | ABC Industries | **Locations** are the loading/unloading points chosen on LRs. "**Disallow new booking**" makes the approver confirm before approving their orders |
| **Transport** | Transporter or broker who gives us **market trucks** | Shree Roadlines | Name and mobile must be unique |
| **Creditor** | Other suppliers we pay (rent, services…) | Office landlord | |
| **Labour** | Hamali (loading/unloading labour) | Pune hamali team | Paid through Vendor Payments |
| **Pump** | Diesel pump: current rate, credit limit, blacklisted | HP pump, Dhule | Chosen when recording diesel |
| **Spare Part Supplier** | Workshop supplier | Patil Auto Parts | |

## Rates and rail

| Master | What it is | Example | Remember |
|---|---|---|---|
| **Agreement** | Contract with a customer: start/expiry dates and **detention** rates | ABC 2026-27 agreement | Needed before the rate matrix |
| **Rate Matrix** | **Freight per truck** for: agreement + route + vehicle type + unit + Road/Rail | ABC, Pune → Kolkata, 32 ft, Road = ₹90,000 | **Orders take their freight from here.** Only one rate per combination |
| **Wagon** | Railway wagon types with capacity (CFT, MT) | BCN wagon | Name must be unique |
| **Railway Freight** | Rail freight per wagon between two railheads | Amalner → Kolkata, BCN = ₹… | Both ends must be areas marked **Rail Head** |

## Goods and spares

| Master | What it is | Example |
|---|---|---|
| **Goods** | What we carry | Cotton bales, steel coils |
| **Units of Measure** | How it is counted or weighed | MT, KG, Boxes |
| **Spare Category** | Group of spare parts | Tyres, filters |
| **Spare Part** | One part, with **minimum stock** | Air filter 12" (low-stock badge appears below the minimum) |

## Money

| Master | What it is | Remember |
|---|---|---|
| **Cash Account** | A cash box or bank account we pay from | Starting balances are entered in **Finance → Cash & Bank → Opening Balances** |

## Common problems

| Problem | Reason | Fix |
|---|---|---|
| "…already exists" | That name, code, number or phone is already used | Search for the existing record and use it |
| Can't delete a record | It is already used (orders, LRs, trips…) | Leave it. Old records need it |
| Order shows no freight | No **Rate Matrix** row for that customer + route + vehicle type | Add the rate |
| Truck can't start a trip | Insurance date passed, or driver's licence expired | Update the vehicle or driver master with the new dates |
| Market truck can't be saved | No transporter chosen | Pick its **Transport** |

## Try it yourself (test system only)

1. Add a test **customer** with one **location**.
2. Add an **agreement** and a **rate matrix** row for Pune → Kolkata, 32 ft.
3. Create an order for that customer (Chapter 7). Check that the freight is filled automatically.
4. Try to **delete** the customer. Read the message. (It is refused, because the customer is now used.)
