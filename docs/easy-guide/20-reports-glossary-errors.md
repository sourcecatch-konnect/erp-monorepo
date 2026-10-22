# 20. Reports, glossary and common errors

> Last checked: 2026-10-12 · For: everyone

## Part 1: Reports

**Menu: Reports → Vehicle Reports**

| Report | Answers | Made from |
|---|---|---|
| **Vehicle P&L** | **Is each truck making money?** | Freight − trip costs − repairs − monthly fixed costs |
| **Vehicle Performance** | Month-by-month sheet per truck, including the **freight difference** (booking freight − onward freight = the company's margin) | Trips and LRs |
| **Vehicle Costs** | Monthly fixed costs per truck: EMI, insurance… | Entered by accounts |

**How to read Vehicle P&L:**

```
   Freight earned (all legs)
 − Diesel, tolls, other trip expenses  (from log slips)
 − Repairs and parts                    (from job cards and service bills)
 − Monthly fixed costs                  (EMI, insurance… from Vehicle Costs)
 = Profit or loss of the truck
```

Open a truck to see the details behind each number. A **monthly** view is also available.

**Tip:** the report is only as good as the data. Settle log slips on time and enter vehicle costs every month.

## Part 2: Glossary A–Z

| Word | Meaning |
|---|---|
| **Acknowledgement** | Recording that the signed LR has reached the office |
| **Advance (trip)** | Cash given to a driver for road expenses |
| **Advance (salary)** | Money given to a driver against his salary |
| **Agreement** | Contract with a customer: rates and detention terms |
| **Bill** | GST invoice to the customer |
| **Branch scope** | Which branches a user can see |
| **Consignee** | Who receives the goods |
| **Consignor** | Who sends the goods (our customer) |
| **Credit note** | A reduction on a finalised bill |
| **DC (Delivery Challan)** | Puts goods on a delivery truck from the destination branch |
| **Demurrage / wharfage** | Railway charges when the rake or goods stay too long at a station |
| **Detention** | Extra charge when a truck waits too long before unloading |
| **Disbursement** | The actual payment of an approved vendor slip |
| **E-way bill** | Government document for moving goods. Needed on every LR before finalising |
| **Freight** | Money charged for carrying the goods |
| **Freight difference** | Booking freight − onward freight: the company's margin |
| **GRN** | Goods Received Note: goods counted and checked on arrival |
| **Hamali** | Loading/unloading labour and its charge |
| **Hub** | A transfer point where goods change trucks |
| **Instant LR** | An LR made without an order |
| **Journey (vehicle)** | One full round of an own truck from base and back |
| **Leg** | One trip inside a journey |
| **Ledger** | One account in the books |
| **Log slip** | Settlement of a journey: truck profit and driver balance |
| **LR (Lorry Receipt)** | Transport document for one consignment |
| **LR group** | All LRs on one truck |
| **Maker-checker** | The person who makes a document may not approve it |
| **Market vehicle** | A truck hired from an outside transporter |
| **Master** | A base record set up once and used everywhere |
| **MR / RR** | Railway Receipt details, one row per wagon |
| **Onward freight** | Freight credited to our own truck for a leg |
| **Order** | The customer's request for trucks |
| **Own vehicle** | A company truck with a company driver |
| **POD** | Proof of delivery: the signed LR |
| **Railhead** | The railway station where goods go on or off the train |
| **Rake** | The train of wagons carrying our goods |
| **Rate Matrix** | Freight per truck for a customer, route and vehicle type |
| **Receipt** | A payment received from a customer |
| **Reversal** | A new entry that cancels a wrong one. Nothing is deleted |
| **Role** | A set of permissions for one kind of job |
| **Salary run** | The monthly salary sheet for all drivers |
| **TDS** | Tax deducted at source |
| **To be Billed / To Pay** | Freight billed later by GST invoice / freight collected at delivery |
| **Transporter** | Owner or agent of a market truck |
| **Trip** | One movement of an own truck |
| **Voucher** | One accounting entry (debit = credit) |
| **VP schedule** | Plan of wagons needed for a date and route |
| **Wagon** | One railway coach |

## Part 3: Common errors and what to do

| You see | Meaning | Do this |
|---|---|---|
| A menu or button is missing | Your role doesn't allow it, or the record is in the wrong status | Check the status first, then ask your admin |
| "Forbidden" | Your role doesn't allow this action | Ask your admin |
| "…already exists" | Duplicate name, number or phone | Search for the existing record |
| Can't delete a record | It is already used elsewhere | Leave it |
| Order has no freight | No Rate Matrix row | Add the rate in masters |
| Truck or driver blocked | Insurance or licence expired | Update the vehicle or driver master |
| "A group can only be created for a Confirmed order" | Order not approved | Approve the order |
| "LR … is incomplete. Add: …" | Required LR details missing | Fill the listed fields, then finalise again |
| "A finalised group cannot be cancelled" | Too late to cancel | Tell your manager or admin |
| "Trip breaks journey continuity…" | KM or start city doesn't follow the last trip | Correct it, or give a reason (needs permission) |
| LR not in LR to Bill | Signed LR not acknowledged | Acknowledge the POD |
| "Exceeds outstanding balance" | Paying more than is due | Pay only the outstanding amount |
| Can't approve your own document | Maker-checker | Ask another approver |
| New permission not showing | Page is old | Refresh, or sign out and in |

**Golden rule:** if something finalised is wrong, **don't create a duplicate**. Tell your manager or admin. The ERP has proper ways to correct records.
