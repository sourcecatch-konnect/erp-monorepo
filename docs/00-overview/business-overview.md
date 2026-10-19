# Business overview

> Last checked: 2026-10-09 · Audience: everyone

## What the company does

SK Translines moves customers' goods across India in two ways:

- **By road:** a truck carries the goods from the loading point to the customer's delivery point.
- **By road + rail:** a truck takes the goods to a **railhead** (railway station). The goods travel by **rail rake** (a train of wagons). At the destination station they are unloaded and taken to the customer by a **delivery truck**.

The trucks are of two kinds:

- **Own vehicles:** the company's own trucks, with its own drivers.
- **Market vehicles:** trucks hired from outside **transporters / brokers** for a trip.

The **head office** is the base branch. Own trucks start and end their journeys there, and the signed copy of every LR comes back to the Jalgaon office. ⚠ Confirm the head-office city in this line.

## How the company earns and spends

| Money in (from customers) | Money out (to others) |
|---|---|
| **Freight** for each truck, from the customer's rate agreement (e.g. ₹90,000 per truck on a route) | Market truck **freight**, **advances**, **detention** to transporters/brokers |
| **Detention**, when the customer keeps the truck waiting | **Hamali** (loading/unloading labour) |
| Other charges on the bill (unloading, etc.) | **Diesel**, tolls and trip expenses of own trucks |
| | **Driver salaries** and salary advances |
| | **Railway** charges, workshop repairs, spare parts |

## Who uses the ERP

| Team | Main work in the ERP |
|---|---|
| **Booking / operations** | Orders, LRs, trips, vehicle journeys, deliveries |
| **Rail team** | VP schedule, MR/RR, wagon loading, GRNs, rakes, delivery challans |
| **Branch staff** | Deliveries, signed-LR acknowledgement, local trips |
| **Billing** | LR to bill, billing register, client receipts |
| **Accounts** | Vendor payments, driver salary and payments, cash & bank, ledgers, day book, log slips |
| **Workshop / store** | Purchase orders, inward stock, job cards, service bills |
| **Managers / owner** | Approvals, vehicle P&L and performance, reports |
| **Admin** | Users, roles and permissions, notification settings, audit log |

Each user only sees the menus their **role** allows. A user can be limited to **their own branches**.

## The main areas of the ERP

1. **Operations:** orders, lorry receipts (LR), deliveries, rail (VP management)
2. **Fleet (Container):** trips, vehicle journeys, log slips, wagon tracking
3. **Finance:** billing & receipts, vendor payments, driver payments, cash & bank, books of account
4. **Reports:** vehicle P&L, vehicle performance, vehicle costs
5. **Workshop:** purchase orders, stock, job cards, service bills
6. **Master data:** customers, transporters, drivers, vehicles, routes, rates and other base records
7. **Administration:** users, roles, notifications, audit log

The full flow is explained in [ERP flow](erp-flow.md). All terms are in the [Glossary](glossary.md).

## Important rules the ERP follows

- **Money is stored in paise** (₹1 = 100 paise) so there are no rounding errors.
- **Every money action posts a voucher** in the books (double entry, like Tally).
- **Nothing is deleted from the books.** A mistake is corrected with a **reversal** entry.
- **Payments need approval** where configured, and the person who made a document may not be allowed to approve it (maker-checker).
- **You can't pay more than a cash or bank account holds** (driver payments).
- The **local/test** ERP and the **live** ERP use **separate databases**.
