# Current Order to LR Flow Guide

This guide explains the flow currently built in this project. It is written for
learning and manual testing: how to create an Order, approve it, create an LR
Group/Lorry Receipt, and finalise it.

For the full future ERP vision, read `CONTEXT.md` and `ERP_MODULE_PLAN_V2.md`.
This file is only for the flow that exists now.

---

## 1. Big Picture

```text
Masters
  -> Order
  -> Order Approval
  -> LR Group / Lorry Receipt
  -> Trip attach
  -> LR Finalise with E-way Bill + Invoice
```

Simple meaning:

```text
Masters = setup data
Order = customer booking request
Approval = freight confirmed
LR Group = one truckload
LR = one consignment document
Trip = vehicle movement
Finalise = lock LR with invoice + e-way bill
```

---

## 2. Master Data Needed Before Order

Before creating an Order, these master records should exist:

```text
Customer
Customer Locations
Branch
Route
Goods
Vehicle Type
Vehicle / Driver / Trip, if using own vehicle
Agreement
Rate Matrix
```

Order depends heavily on Masters.

Example:

```text
Customer: ABC Cement
Consignee: XYZ Warehouse
From Branch: Pune
To Branch: Mumbai
Route: Pune -> Mumbai
Vehicle Type: 32 FT
Goods: Cement
Rate Matrix: Pune -> Mumbai, 32 FT, Rs. 25,000
```

---

## 3. Order Meaning

Order is the booking request from customer.

Order answers:

```text
Who wants transport?
Who receives goods?
From where to where?
Which route?
Which pickup date?
Truck based or item/goods based?
Which goods?
How much freight?
```

Current project supports two Order types:

```text
Truck
Item
```

Important current rule:

```text
LR from Order is allowed only for Truck orders.
```

Item/Goods orders can be created and approved, but current LR Group creation
from Order rejects Item orders.

---

## 4. Order Fields

### Customer & Route

```text
Customer / Consignor
Consignee
Pickup date
From branch
To branch
Route
Saved pickup location
Pickup address override
```

Meaning:

- `Customer / Consignor`: sender or booking party.
- `Consignee`: receiver of goods.
- `Pickup date`: planned pickup date.
- `From branch`: branch responsible for origin.
- `To branch`: destination branch.
- `Route`: route used for freight/rate matching.
- `Saved pickup location`: customer's saved loading point.
- `Pickup address override`: free-text address if saved location is not enough.

### Order Details

For Truck order:

```text
Order type = Truck
Vehicle type
Truck quantity
Consignment lines
```

For Item order:

```text
Order type = Item
Goods item lines
```

Current LR flow mainly uses Truck order.

### Consignment Lines For Truck Order

Truck orders need consignment lines.

Each consignment line has:

```text
Truck #
Loading location
Unloading location
Goods
Quantity
Unit
Weight
```

Important:

```text
One consignment line becomes one LR.
Lines with same Truck # become one LR Group.
```

Example:

```text
Order has truckQuantity = 1

Truck #1:
  Line 1: Pune warehouse -> Mumbai godown, Cement, 100 bags
  Line 2: Pune warehouse 2 -> Mumbai godown, Cement, 50 bags
```

This creates:

```text
LR Group for Truck #1
  -> LR 1
  -> LR 2
```

### Contact & Notes

```text
Contact person
Mobile
Email
Special instructions
```

These help operations coordinate pickup/delivery.

---

## 5. Order Status Flow

```text
Create Order
  -> PendingApproval
```

Then:

```text
PendingApproval
  -> Approve
  -> Confirmed
```

Or:

```text
PendingApproval
  -> Reject
  -> Rejected
  -> Edit / Resubmit
  -> PendingApproval
```

Or:

```text
PendingApproval / Confirmed
  -> Cancel
  -> Cancelled
```

Only confirmed Truck orders can create LR Group from Order.

---

## 6. Freight Approval

During approval, system tries to calculate freight from Rate Matrix.

It uses:

```text
Customer
Agreement
Route
Vehicle Type
Truck Quantity
Rate Matrix
```

Example:

```text
Rate Matrix = Rs. 25,000 per truck
Truck Quantity = 2
Auto freight = Rs. 50,000
```

Approver can:

```text
Accept auto freight
Change freight manually
Add freight override reason
```

After approve:

```text
Order status = Confirmed
```

---

## 7. LR Meaning

LR means Lorry Receipt.

Simple difference:

```text
Order = booking request
LR = transport document
```

Current structure:

```text
LR Group = one truckload / one truck index
Lorry Receipt = one consignment inside that truck
```

Example:

```text
Order
  Truck #1
    LR Group
      LR 1
      LR 2
```

---

## 8. Create LR Group From Order

Start from a confirmed Truck order and click/create LR.

LR Form source becomes:

```text
FROM_ORDER
```

The system takes these values from Order:

```text
Consignor = Order customer
Consignee = Order consignee
Origin branch = Order from branch
Destination branch = Order to branch
Goods = Order consignment lines for selected truck
```

In LR Form you choose:

```text
Truck #
Transport mode
Priority
Own vehicle / Market vehicle
Trip, if own vehicle
Railhead branch, if Road & Rail
```

### Truck #

Truck number selects which truck slot you are creating LR Group for.

Example:

```text
Order truckQuantity = 3
```

You can create:

```text
Truck #1 -> LR Group
Truck #2 -> LR Group
Truck #3 -> LR Group
```

Each truck number can be used only once unless its group is cancelled.

### Common Error

Error:

```text
Order has no consignment lines for truck #1
```

Meaning:

```text
You selected Truck #1, but the Order has no consignment line with truckIndex = 1.
```

Fix:

```text
Go back to Order edit
Add consignment line under Truck #1
Save / resubmit / approve if needed
Create LR again
```

---

## 9. Create Instant LR Group

Instant LR means LR without parent Order.

LR Form source:

```text
INSTANT
```

You manually enter:

```text
Consignor
Consignee
Origin branch
Destination branch
Loading point
Unloading point
Goods
Vehicle / trip or market vehicle details
```

Use this when business wants direct LR creation without Order booking.

---

## 10. Own Vehicle vs Market Vehicle

### Own Vehicle

Choose:

```text
Own Vehicle
Trip
```

Trip must be a planned/attachable trip.

When LR Group attaches to trip:

```text
Trip status -> InTransit
Vehicle status -> ON_TRIP
```

### Market Vehicle

Choose:

```text
Market Vehicle
Market vehicle number
Market driver name
```

This means external/hired vehicle. It does not use own vehicle trip in the same
way.

---

## 11. LR Group Created

After successful LR create:

```text
LR Group status = DRAFT
Lorry Receipt status = DRAFT
```

Draft means:

```text
Document is prepared, but not locked/final yet.
```

At this point you can inspect the LR Group detail page.

---

## 12. Finalise LR Group

Finalise means:

```text
Complete and lock the LR Group.
```

Finalise requires group-level fields:

```text
Base freight amount
Seal number
```

And per-LR fields:

```text
Invoice number
Invoice amount
E-way bill number
E-way bill generated date
E-way bill expiry date
Generated by
Document URL
```

After finalise:

```text
LR Group status = FINALISED
Each LR status = FINALISED
E-way bill saved
Invoice details saved
Freight and seal saved on group
```

Only a DRAFT LR Group can be finalised.

Current cancel rule:

```text
Finalised group cannot be cancelled by normal cancel flow.
```

---

## 13. E-way Bill Meaning

E-way Bill is a government/legal goods movement document.

Simple difference:

```text
LR = company transport receipt
E-way Bill = government transit pass/tracking document
```

Current project stores:

```text
ewayBillNo
generatedAt
expiresAt
generatedBy
documentUrl
```

In real business, customer often generates Part A, and transporter updates Part B
with vehicle details.

---

## 14. After Finalise

Current implemented next step is mainly operational tracking through Trip.

If own vehicle trip was selected:

```text
LR Group created
Trip becomes InTransit
Vehicle becomes ON_TRIP
LR Group finalised
Trip later closes after delivery
```

Planned/full ERP docs go further:

```text
POD
Billing
Receipt
Tally
Claims
Complaints
Rail VP / RR / MR / DC
```

Those are part of the broader SKERP plan, not all fully completed in current
flow.

---

## 15. Current Important Routes

Web pages:

```text
/orders
/orders/new
/orders/:id
/orders/:id/edit
/lorry-receipts
/lorry-receipts/new
/lorry-receipts/:id
```

Server APIs:

```text
POST /orders
POST /orders/:id/approve
POST /orders/:id/reject
POST /orders/:id/cancel
POST /lr-groups
POST /lr-groups/:id/finalise
POST /lr-groups/:id/split-at-hub
POST /lr-groups/:id/cancel
```

---

## 16. Current Key Code Files

Order frontend:

```text
apps/web/features/orders/OrderForm.tsx
apps/web/features/orders/OrdersListPage.tsx
apps/web/features/orders/OrderDetail.tsx
apps/web/features/orders/ApproveOrderModal.tsx
apps/web/features/orders/components/ConsignmentLinesEditor.tsx
```

Order backend:

```text
apps/server/src/modules/order/order.route.ts
apps/server/src/modules/order/order.service.ts
```

LR frontend:

```text
apps/web/features/lorry-receipts/components/LRForm.tsx
apps/web/features/lorry-receipts/LRListPage.tsx
apps/web/features/lorry-receipts/LRDetail.tsx
apps/web/features/lorry-receipts/lr-group.service.ts
```

LR backend:

```text
apps/server/src/modules/lr-group/lr-group.route.ts
apps/server/src/modules/lr-group/lr-group.service.ts
apps/server/src/modules/lorry-receipt/lorry-receipt.route.ts
apps/server/src/modules/lorry-receipt/lorry-receipt.service.ts
```

Shared validation/types:

```text
packages/validators/src/order/order.schema.ts
packages/validators/src/lr-group/lr-group.schema.ts
packages/types/src/order/order.type.ts
packages/types/src/lr-group/lr-group.type.ts
```

---

## 17. Manual Test Path

Use this to understand and verify the current flow.

### Step 1: Prepare Masters

Create/check:

```text
Customer with locations
Consignee customer with locations
Branches
Route
Goods
Vehicle Type
Agreement
Rate Matrix
Planned trip, if using own vehicle
```

### Step 2: Create Truck Order

Create Order:

```text
Customer = consignor
Consignee = receiver
From branch
To branch
Route
Pickup date
Order type = Truck
Vehicle type
Truck quantity = 1
Consignment line for Truck #1
```

Submit:

```text
Status should become PendingApproval.
```

### Step 3: Approve Order

Open approve modal:

```text
Check auto freight
Edit freight if needed
Approve
```

Expected:

```text
Order status = Confirmed
```

### Step 4: Create LR

From confirmed Order:

```text
Create LR
Truck # = 1
Transport by = Own Vehicle or Market Vehicle
Trip = required for Own Vehicle
Submit
```

Expected:

```text
LR Group created
LR Group status = DRAFT
LR(s) status = DRAFT
```

### Step 5: Finalise LR Group

Enter:

```text
Base freight amount
Seal number
Invoice number
Invoice amount
E-way bill details
```

Submit finalise.

Expected:

```text
LR Group status = FINALISED
LR(s) status = FINALISED
```

### Step 6: Trip

If own vehicle was selected:

```text
Trip should become InTransit
Vehicle should become ON_TRIP
```

Later Trip can be closed through Trip module.

---

## 18. Current Done vs Planned

Currently done:

```text
Master setup
Order create/list/detail/edit
Order approval/reject/cancel
Rate Matrix freight preview during approval
Truck order consignment lines
LR Group create from confirmed Truck order
Instant LR Group create
Own vehicle / market vehicle selection
Trip attach and dispatch
Group finalise with invoice + e-way bill
Basic LR/LR Group list/detail
```

Planned/full ERP flow from docs:

```text
POD acknowledgement
POD courier tracking
Billing
Receipts
Tally sync
Claims
Complaints
Rail VP / RR / MR / DC workflows
Detention calculation
Broker payments
```

Use this guide for current project learning. Use `CONTEXT.md` for the full
business vision.
