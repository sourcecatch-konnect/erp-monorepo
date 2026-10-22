# Glossary

> Last checked: 2026-10-09 · Audience: everyone

| Term | Meaning | Example / where you see it |
|---|---|---|
| **Order** | The customer's request for trucks to move goods | Orders screen |
| **Agreement** | Contract with a customer: rates and detention terms | Masters → Agreements |
| **Rate matrix** | Freight per truck for a customer, route and vehicle type | Pune → Kolkata ₹90,000 per truck |
| **Consignor** | The party sending the goods | On the LR |
| **Consignee** | The party receiving the goods | On the LR |
| **LR (Lorry Receipt)** | The transport document for one consignment | LR 00051 |
| **LR group** | All LRs carried by **one truck**. Freight, advance and vehicle are stored here | SKG/HO/26-27/00042 |
| **Instant LR** | An LR made without an order | Lorry Receipts → new |
| **Own vehicle** | A company truck with a company driver | Masters → Vehicles |
| **Market vehicle** | A truck hired from an outside transporter for the trip | Market vehicle on the LR group |
| **Transporter** | Owner or agent of a market truck; paid for freight | Masters → Transports |
| **Broker** | A party who provides delivery trucks (e.g. for DCs). In the ERP a broker is set up as a **Transport** today | ⚠ Confirm if a broker is always a transporter |
| **Road / Road + Rail** | How the goods travel: only by truck, or truck + train | Chosen on the LR group |
| **Railhead** | The railway station where goods are loaded into or unloaded from wagons | Source / destination railhead |
| **Hub** | A transfer point on the way | To-hub / from-hub on the LR group |
| **Trip** | One movement of an own truck from one city to another | Trips screen |
| **Vehicle journey** | One full round of an own truck from base and back, made of **legs** | Vehicle Journeys screen |
| **Leg** | One trip inside a journey (LR, DC, empty, local, return, workshop…) | Journey detail |
| **Onward freight** | Freight credited to the own truck for a leg | On the trip |
| **Booking freight** | Freight the customer pays for the truck | On the LR group |
| **Freight difference** | Booking freight − onward freight: the margin the company keeps | Vehicle Performance report |
| **Log slip** | Settlement of one journey: freight, diesel, expenses and the driver's balance | Generated after the truck returns |
| **Diesel average** | Kilometres per litre of diesel | On the log slip |
| **Trip advance** | Money given to a driver for trip expenses | Driver advances |
| **Salary advance** | Money given to a driver against his salary | Driver Payments → Salary Advances |
| **Salary run** | The monthly salary sheet for all drivers | Driver Payments → Salary Runs |
| **VP schedule** | Plan of how many wagons are needed, on which date, for which route | VP Management |
| **Indent rake / Lease rake** | Indent: booked through a railway schedule. Lease: without a schedule. It affects costing | On MR/RR |
| **MR / RR** | Railway Receipt data from the Railway website; one row per wagon | VP Management → MR/RR |
| **VP loading** | Loading received goods into the scheduled wagons | VP Management → VP Loading |
| **Wagon** | A railway coach type with capacity (CFT / MT) | Masters → Wagons |
| **Rake** | The train of wagons carrying the goods | Rake & DC/WC screens |
| **GRN** | Goods Received Note: goods received and checked (quantity, damage, shortage) | GRN at railhead / at branch |
| **DC (Delivery Challan)** | A document that puts goods from one or more LRs on a delivery truck from the destination branch | Delivery Challans |
| **LDC** | ⚠ Confirm the meaning. Used for the delivery-truck freight on a DC ("LDC freight") | — |
| **Detention** | Extra charge when a truck waits too long before unloading. **Customer** detention is billed; **broker/transporter** detention is paid | Acknowledgement / DC |
| **Detention slab** | The rules and rates for detention (free days, rate per day or per hour) | Planned module |
| **Hamali** | Loading / unloading labour and its charge | Vendor Payments (hamali) |
| **POD / signed LR** | Proof of delivery: the LR signed by the customer | Acknowledge |
| **Acknowledgement** | Recording that the signed LR has reached the office | Deliveries → Acknowledge |
| **TBB / To pay** | To be billed (GST invoice to the customer) / freight collected as "to pay" | Payment mode on the LR group |
| **Bill** | GST invoice to the customer | Billing Register |
| **Credit note** | A reduction on an issued bill | Bill detail |
| **Receipt** | A payment received from a customer | Client Receipts |
| **Vendor payment slip** | A payment document for a transporter or hamali, made from eligible LRs or GRNs | Vendor Payments |
| **Disbursement** | The actual payment of an approved slip from a cash or bank account | Vendor Payments → Disbursements |
| **Voucher** | One accounting entry (balanced debit and credit), like in Tally | Day Book |
| **Ledger** | An account in the books (customer, transporter, driver, cash, expense…) | Ledgers |
| **Reversal** | A new voucher that cancels a wrong one. Nothing is deleted | Any posted document |
| **Opening balance** | Money in a cash or bank account on the start date | Cash & Bank → Opening Balances |
| **Cash planning** | Daily view of money available and expected | Cash & Bank → Cash Planning |
| **TDS** | Tax deducted at source from a payment | Vendor payment slips |
| **Maker-checker** | The person who makes a document may not approve it | Approvals |
| **Branch scope** | A user sees all branches, or only the ones assigned | Settings → User access |
| **FY code** | Financial year code used in document numbers | 26-27 |
| **Paise** | ₹1 = 100 paise. All money is stored in paise | ₹90,000 = 9,000,000 paise |
| **Job card** | Workshop work order for a vehicle (parts + service) | Workshop → Job Cards |
| **Service bill** | Bill from an outside workshop | Workshop → Service Bills |
| **E-way bill** | Government document for moving goods (not in scope yet) | E-Way Bills |
| **OneLap tracker** | GPS device whose live location shows on the map | Wagon Tracking |
