# Orders and Lorry Receipts (LR)

> Last checked: 2026-10-09 · Who: booking / operations staff (create), branch managers (approve)

**The idea:** a customer **orders** trucks. For **each truck** you make an **LR group**, which holds that truck's **LRs** (one LR per consignment). The LR group is then linked to a **truck**: an own truck through a **trip**, or a **market truck** hired from a transporter.

```
Order (3 trucks) ──► LR group Truck #1 ──► LR 0051, LR 0052 ──► own trip / market truck
                 ──► LR group Truck #2 ──► LR 0053
                 ──► LR group Truck #3 ──► …
```

**Before you start:** the customer, consignee, branches, route and **Rate Matrix** must exist (see [Masters](02-masters.md)).

---

## 1. Create an order

**Operations → Orders → Create New Order**

1. **Customer** (who pays) and **Consignee** (who receives)
2. **From branch** and **To branch**, and the **Route**
3. **Pickup date**, pickup **location** (or type an address)
4. **Order type:**
   - **Truck:** enter the **number of trucks** and the **vehicle type**. The ERP works out the freight from the Rate Matrix (e.g. ₹90,000 × 3 trucks)
   - **Item:** enter the items. Freight is entered **by hand**
5. Contact person, mobile, email, special instructions (optional)
6. **Save.** The order is **Pending approval**.

[screenshot: New order form]

## 2. Approve, reject or cancel an order

Open the order (branch manager):

| Action | When | Notes |
|---|---|---|
| **Approve** | The order is correct | Freight is filled from the Rate Matrix. To use a different amount, type it **and give a reason**. If the customer is flagged "**disallow new booking**", you must confirm |
| **Reject** | The order can't be taken | Give a reason (min 3 characters) |
| **Cancel** | Pending or Confirmed orders only | Give a reason |
| **Edit** | Before LRs are made | An order with LRs (or cancelled/completed) can't be edited |

**Statuses:** Pending approval → **Confirmed** → **LR created** (+ Rejected, Cancelled)

---

## 3. Make the LR group for a truck

**From an order:** open the confirmed order → **Create LR**. **Without an order:** Lorry Receipts → **Create LR** (an "Instant LR"), then pick the consignor, consignee and branches yourself.

1. **Truck #:** for an order, choose which truck (#1, #2…). Trucks already done aren't offered.
2. **Transport:** **Road**, or **Road + Rail**. For Road + Rail, choose the **railhead branch** and the **source / destination railhead**.
3. **The truck:**
   - **Own truck:** pick a **trip**, or click **Create trip** to make one. Attaching a planned trip **dispatches** it.
   - **Market truck:** pick the **transporter**, **vehicle number** and **driver name**, then enter the **freight, advance, commission, hamali and TDS** agreed with the transporter.
4. **LR lines (consignments):** for each LR, the **loading point**, **unloading point**, **goods** (name, quantity, size) and **total weight + unit**.
5. **Save.** The group is **Draft**, and each line gets an **LR number**.

[screenshot: LR form — truck and LR lines]

## 4. Complete and finalise

Each LR also needs its **invoice number** and an **e-way bill** before the group can be finalised.

1. Open the group → fill each LR's **invoice** details and add its **e-way bill**.
2. Click **Finalise LR** → enter the **base freight** (the truck's freight to the customer) and the **seal number**.
3. The group and its LRs become **Finalised**. They can now be delivered, then billed.

If something is missing, the ERP says exactly what, e.g. *"LR 0052 is incomplete. Add: invoice number, e-way bill"*.

## 5. Other tasks

| Task | How | Rules |
|---|---|---|
| **Print the LR** | Open the LR → **Print / PDF** | |
| **Add another LR to the truck** | Group → **Add LR** | Only while the group is **Draft** |
| **Remove an LR** | LR → **Delete** | Only a Draft LR in a Draft group; a group keeps at least one LR |
| **Hub transfer** (goods change trucks at the hub) | Group → **Hold at hub**, then **Dispatch from hub** with the second (leg 2) trip | Only on a finalised group, before any LR is delivered; the first trip must be closed |
| **Cancel the group** | Group → **Cancel** (with reason) | Only while **Draft**. A finalised group can't be cancelled |

## Statuses

| Item | Statuses |
|---|---|
| LR group | Draft → **Finalised** → Delivered (+ Cancelled) |
| LR | Draft → **Finalised** → Delivered → **Acknowledged** (signed copy received) |

## Common problems

| Message | Meaning / fix |
|---|---|
| "A group can only be created for a Confirmed order" | Approve the order first |
| "Set the order's consignee before creating a group" | Edit the order and add the consignee |
| "Vehicle … is already assigned to LR group …" | That market truck or driver is already on another open group |
| "Trip … belongs to a different consignor" | Pick (or create) a trip for this customer |
| "LR … is incomplete. Add: …" | Fill the listed fields on that LR, then finalise again |
| "A finalised group cannot be cancelled" | Too late to cancel. Contact the office/admin to correct it |
| Order shows no freight | Add the **Rate Matrix** row (Masters) |
