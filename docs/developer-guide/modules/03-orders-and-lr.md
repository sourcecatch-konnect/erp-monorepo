# Orders and LR: developer notes

> Last checked: 2026-10-09 · User guide: [Orders and LR](../../user-guide/03-orders-and-lr.md)

## Data model

```
Order ──1:N──► LRGroup (one per truck: truckIndex 1..truckQuantity)
                 │  consignor/consignee, branches, transportType (Road/Rail/RoadAndRail),
                 │  paymentMode (TO_BE_BILLED/TO_PAY), tripLegType (DIRECT/TO_HUB/FROM_HUB),
                 │  railhead branch + areas, baseFreightAmount, sealNumber,
                 │  isMarketVehicle + market* (transporter, vehicle, driver, freight,
                 │  advance, commission, hamali, TDS), primaryTripId, secondaryTripId (hub leg 2)
                 └──1:N──► LorryReceipt (lrNumber, loading/unloading location, weight, unit,
                             invoice no./amount, status) ──► LRGoods, EwayBill (1:1),
                             LRDelivery (1:1), LRAcknowledgement (1:1), GRN (rail)
Order ──► OrderConsignment (written back as a record of what each truck carried)
```

| Status field | Values |
|---|---|
| `Order.status` | PendingApproval → Confirmed → LRCreated (+ Rejected, Cancelled). `InProgress` / `Completed` exist but **nothing sets them** (known gap) |
| `LRGroup.status` | DRAFT → FINALISED → DELIVERED (+ CANCELLED) |
| `LorryReceipt.status` | DRAFT → FINALISED → DELIVERED → ACKNOWLEDGED; `billingStatus` set by billing |

## Flow (screen → API → code)

| Step | API | Code | Notes |
|---|---|---|---|
| Create / edit order | `POST/PATCH /orders` | `order/order.route.ts` | Frozen once LRCreated / Cancelled / InProgress / Completed |
| Approve | `POST /orders/:id/approve` | `order.service.ts → computeFreight` | Freight from `RateMatrix` (agreement → route → vehicle type), × trucks; override needs a reason; `disallowNewLRBooking` needs `acknowledgeDisallow` |
| Reject / cancel / delete | `/orders/:id/reject`, `/cancel`, `DELETE` | | Delete only without LR groups or attachments |
| Create LR group | `POST /lr-groups` | `lr-group/lr-group.route.ts` | `FROM_ORDER` copies branches/consignor/consignee from the order; `assertGroupSlotAvailable` stops a truck # being used twice; LR numbers reserved in one block; market vehicle/driver can't be on two active groups |
| Attach own trip | in create/update (`primaryTripId`) | `lr-group.service.ts → dispatchTripOnAttach` | Planned trip → **dispatched** (InTransit); an InTransit (back-filled) trip is just linked; consignor must match |
| Add LR / edit / remove | `POST /lr-groups/:id/lorry-receipts`, `PATCH/DELETE /lorry-receipts/:id` | | Draft only; a group keeps at least one LR |
| E-way bill | `POST/PATCH /lorry-receipts/:id/eway-bills` | `lorry-receipt.route.ts` | Edit only before finalise. (WhiteBooks e-way integration is out of scope; the details are entered by hand) |
| Finalise | `POST /lr-groups/:id/finalise` | | Needs `baseFreightAmount`, optional seal; **every LR** must have loading/unloading point, goods, weight + unit, **invoice number** and **e-way bill**; LRs → FINALISED |
| Hub | `/:id/hold-at-hub`, `/:id/dispatch-from-hub` | | Finalised only, before any delivery; leg 1 trip must be Closed; leg 2 trip Planned/InTransit, same consignor |
| Deliver all | `POST /lr-groups/:id/deliver-all` | | Finalised LRs only |
| Cancel | `POST /lr-groups/:id/cancel` | | Draft only |
| PDF | `GET /lorry-receipts/:id/pdf`, `/print-preview`; `GET /orders/:id/pdf` | `lorry-receipt.pdf.ts`, `order.pdf.ts` | |

## Money

- **Customer freight:** the order's `bookingFreightAmount` (from the Rate Matrix), then the group's `baseFreightAmount` at finalise. Billing reads `baseFreightAmount` once per **group** (the first LR "owns" it) in `billing.service.ts → evaluateBillingForLR`.
- **Market truck costs:** `market*` fields on the group feed **Vendor Payment** (transporter slips).
  ⚠ **Known bug ERP-58:** the transporter calculator copies these group amounts onto **every LR**, so a truck with 2 LRs is counted twice. The GRN preview shows the same doubling.
- The market **advance** isn't posted to the books anywhere (it is entered in Tally today).
- **No vouchers are posted** by orders or LR groups themselves.

## Traps

- One LR's goods can later be **split across several delivery challans** (rail). Delivery dates stay per LR.
- `LRDelivery.reportedAt` exists but **no screen sets it** (needed for detention; see the DC detention plan).
- Trip consignor must equal the group consignor; Instant LR auto-sets the consignor from the picked trip.

## Next

For Road + Rail LRs, everything after the LR (railhead GRN, wagons, rake, delivery challan) is in [Road + Rail](04-road-and-rail.md).

## Files

- Server: `modules/order/*`, `modules/lr-group/*`, `modules/lorry-receipt/*` (incl. `lr-delivery*`), `modules/trip/trip.service.ts` (`buildTripName`, cargo summary)
- Validators: `packages/validators/src/order`, `lr-group`, `lorry-receipt`
- Website: `features/orders/*` (`OrderForm`, `OrderDetail`, `ApproveOrderModal`), `features/lorry-receipts/*` (`LRForm`, `LRDetail`, `FinaliseDialog`, `LRLineDialog`, `EwayBillSection`, `SplitAtHubDialog`, `DeliverDialog`), `features/trips/CreateTripDialog.tsx`

## How to test

Order (3 trucks) → approve (check freight = rate × 3) → truck #1 group with 2 LRs + own trip (trip becomes InTransit) → try to finalise without an e-way bill (refused, with the list) → add invoice + e-way → finalise → print. Then truck #2 as a market truck → check the same vehicle can't be on another active group.
