# LR Delivered & LR Acknowledgement — implementation plan

Status: proposed (net-new schema + server + web). Written while finishing the
container/logistics module and comparing against the old reference ERP
(`D:\Work\SK_Logistics code\SK_Logistics`) for gaps — this closes the two the
user called out by name.

## Problem

Once an LR is `FINALISED` and physically moving, there is currently no way to
record it reaching the consignee, and no reconciliation/claims step
afterward. Neither exists anywhere in this repo today — not as routes, not as
`LRStatus` enum values, not as permissions, not as UI. `LRStatus` is
`DRAFT | FINALISED | CANCELLED` only
([schema.prisma](../apps/server/prisma/schema.prisma) ~line 1848).
`docs/ERP_MODULE_PLAN_V2.md` §4.2 already speculatively specs an
`LRAcknowledgement` + `PODDispatch` pair as "planned, not yet built" — this
doc reconciles that speculative spec against what the legacy system actually
does field-by-field, and locks a minimal-but-correct shape instead of
building the full speculative dual-status-axis rebuild.

**What legacy actually does**, read directly from its C# source
(`SK_Logistic_UI/Transactions/Delivered.aspx` and
`.../LRAcknowledgment.aspx`), cross-checked against its own `LLM.md` and the
restored DB's confirmed `LRStatus` values (18=In Progress, 19=Finalised,
98=Delivered, 157=Cancelled):

- **Delivered** is the actual completion event — a single screen where office
  staff enter delivery date/time, a required remark, and required unloading
  charges for one LR. This flips the LR's status straight to Delivered
  (hardcoded id `98` in the old system). No POD upload, no receiver name or
  signature captured at this step in the old system.
- **Acknowledgment** is a separate, *later* reconciliation screen, only
  offered for LRs already Delivered (its LR-picker is explicitly filtered to
  delivered LRs) — it does **not** flip status again. It captures, per goods
  line, booked qty vs. received qty vs. damage qty (shortage is derived,
  `booked − received`), plus consignee-end detention days/amount, courier
  name/docket/charge (for POD paperwork sent back to office), a remark, and
  up to 5 damage photos as claims evidence.

## Decisions locked

1. **`LRStatus` gets one new terminal value: `DELIVERED`**
   (`DRAFT | FINALISED | DELIVERED | CANCELLED`) — not the full speculative
   dual `operationalStatus`/`billingStatus` axis from `ERP_MODULE_PLAN_V2.md`
   §4.2. That axis is a materially bigger, unrequested rebuild touching
   invoicing/billing state and intermediate transit states nothing here
   needs. A flat 4th value is the minimal match for "delivery is a single
   completion event that flips status," which is exactly what legacy does.
2. **Delivered does not gate on GRN/VP-Loading.** Those are a mid-route
   rail-head detail (see `GRN_VPLOADING_PLAN.md`); delivery is the
   destination-branch event and applies identically whether the LR ever
   touched a rail-head or not.
3. **Delivered adds `receiverName` + a signature/photo capture** — the one
   deliberate deviation from legacy, per explicit product decision. Captured
   via the existing generic attachments module (`entityType: "LRDelivered"`),
   not a new blob column.
4. **Acknowledgement does not introduce a further status value.** LR stays
   `DELIVERED` after acknowledgement — it's evidence/reconciliation data
   layered on top, matching legacy's actual behavior (its screen never
   touches LR status).
5. **`shortageQty` on acknowledgement goods lines is stored but
   server-computed** (`totalQty − receivedQty`), never accepted as client
   input — matching the sibling `GRNGoods` model already in this schema,
   which also persists a computed `shortageQty` column. Consistency with the
   existing rail-side pattern in this same codebase wins over copying
   legacy's pure-client-side compute.
6. **No separate `acknowledgedBy` field** — the existing `createdById`/
   `createdBy` audit relation already answers "who acknowledged," identical
   to every other model in this schema.
7. **POD/courier tracking stays three flat fields** (`docketNo`,
   `courierName`, `courierCharges`) directly on `LRAcknowledgement`, matching
   legacy's single-screen capture. The fuller speculative `PODDispatch`
   state-machine (dispatched → received-at-HO, `retentionAmount`) from
   `ERP_MODULE_PLAN_V2.md` §4.2 is explicitly **deferred** — a courier-tracking
   sub-workflow, not needed to close this gap.
8. **Damage photos reuse the existing generic attachments module**
   (`entityType: "LRAcknowledgement"`) — no new upload plumbing. "Max 5
   photos" is enforced as a soft UI rule, not a DB constraint.
9. **No reversal/undo path for Delivered** is designed here — legacy has none
   either. Flagged as an open question for the team, not built speculatively.

## Target model

### Schema additions

```prisma
model LRDelivered {
  id               String       @id @default(cuid())
  lorryReceiptId   String       @unique
  lorryReceipt     LorryReceipt @relation(fields: [lorryReceiptId], references: [id])

  deliveredAt      DateTime            // combines legacy DeliveryDate + DeliveryTime
  remarks          String              // required, per legacy
  unloadingCharges BigInt              // required, per legacy
  receiverName     String?             // new vs. legacy — product decision

  createdById String
  updatedById String?
  createdBy   User  @relation("CreatedLRDelivered", fields: [createdById], references: [id])
  updatedBy   User? @relation("UpdatedLRDelivered", fields: [updatedById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lorryReceiptId])
}

model LRAcknowledgement {
  id             String       @id @default(cuid())
  lorryReceiptId String       @unique
  lorryReceipt   LorryReceipt @relation(fields: [lorryReceiptId], references: [id])

  ackAt            DateTime            // combines legacy ReceivedDate + ReceivedTime
  detentionDays    Int      @default(0)
  detentionAmount  BigInt   @default(0)
  docketNo         String?
  courierName      String?
  courierCharges   BigInt?
  remarks          String?

  createdById String
  updatedById String?
  createdBy   User  @relation("CreatedLRAck", fields: [createdById], references: [id])
  updatedBy   User? @relation("UpdatedLRAck", fields: [updatedById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  goods LRAcknowledgementGoods[]

  @@index([lorryReceiptId])
}

model LRAcknowledgementGoods {
  id                  String            @id @default(cuid())
  lrAcknowledgementId String
  lrAcknowledgement   LRAcknowledgement @relation(fields: [lrAcknowledgementId], references: [id], onDelete: Cascade)

  lrGoodsId String?
  lrGoods   LRGoods? @relation(fields: [lrGoodsId], references: [id])

  goodsName   String
  totalQty    Int
  receivedQty Int
  damageQty   Int @default(0)
  shortageQty Int @default(0)   // server-computed: totalQty - receivedQty

  @@index([lrAcknowledgementId])
  @@index([lrGoodsId])
}
```

Extend `enum LRStatus` with `DELIVERED`.

### Validators

Add directly to the existing
`packages/validators/src/lorry-receipt/lorry-receipt.schema.ts` (same file
that already holds `addEwayBillSchema` — these are actions *on*
`LorryReceipt`, not new modules):

- `deliverLRSchema` — `{ deliveredAt, remarks: z.string().min(1),
  unloadingCharges: <non-negative>, receiverName?: string }`.
- `acknowledgeLRSchema` — `{ ackAt, detentionDays?, detentionAmount?,
  docketNo?, courierName?, courierCharges?, remarks?, goods: [{ lrGoodsId?,
  goodsName, totalQty, receivedQty, damageQty? }] }` — `shortageQty`
  intentionally absent from the input schema (server-derived).

### Server

Add two routes directly to the existing
`apps/server/src/modules/lorry-receipt/lorry-receipt.route.ts`, same shape
as its existing `POST /:id/eway-bills` handler:

```
POST /lorry-receipts/:id/deliver
  can(PERMS.LORRY_RECEIPT.DELIVER)
  - find LR (deletedAt null), include group.{destinationBranchId}, delivered: {select:{id:true}}
  - guard: status must be FINALISED (not DRAFT/CANCELLED/already DELIVERED)
  - assertBranchAccess(req, group.destinationBranchId)  ← destination branch, not origin
  - $transaction: create LRDelivered + update LorryReceipt.status = "DELIVERED"
  - re-fetch full detail include after commit

POST /lorry-receipts/:id/acknowledge
  can(PERMS.LORRY_RECEIPT.ACKNOWLEDGE)
  - find LR, include group.destinationBranchId, delivered: {select:{id:true}},
    acknowledgement: {select:{id:true}}, goods
  - guard: LR.status must be DELIVERED (mirrors legacy's Ack picker being
    filtered to delivered LRs only)
  - guard: no existing acknowledgement (1:1)
  - assertBranchAccess(req, group.destinationBranchId)
  - compute shortageQty per line server-side
  - $transaction: create LRAcknowledgement + LRAcknowledgementGoods rows
  - re-fetch full detail include after commit
```

New permission keys added to the existing `LORRY_RECEIPT` block in
`packages/types/src/permissions.ts`:

```ts
DELIVER: "lorry_receipt.deliver",
ACKNOWLEDGE: "lorry_receipt.acknowledge",
```

No new router/mount needed — both live on the existing `/lorry-receipts`
base path.

### Web

Add to the existing `apps/web/features/lorry-receipts/` folder (same place
as `FinaliseDialog.tsx`/`SplitAtHubDialog.tsx`):

- `components/DeliverDialog.tsx` — delivered date/time, remarks, unloading
  charges, receiver name, and a signature/photo uploader (reuse whatever the
  attachments feature already exposes — check before building a new
  uploader). Gated to destination-branch users, visible only when LR status
  is `FINALISED`.
- `components/AcknowledgeDialog.tsx` + `components/AcknowledgeGoodsTable.tsx`
  — per-line received/damage qty entry (shortage shown read-only, computed),
  detention days/amount, courier/docket fields, remarks, and a damage-photo
  uploader (same reuse note, max 5 enforced client-side). Gated to LRs with
  `status === "DELIVERED"` and no existing acknowledgement. A dedicated
  print/slip output can reuse the existing PDF template pattern
  (`apps/server/src/templetes/pdf/`) rather than building new PDF plumbing.

## Verification

- `pnpm --filter @skerp/validators build`, `pnpm --filter @skerp/server
  check-types`, `pnpm --filter @skerp/web check-types`.
- Manually exercise: finalise an LR → attempt acknowledge (should be
  rejected, not yet delivered) → deliver it (status flips to `DELIVERED`,
  receiver name + photo saved) → acknowledge it (goods reconciliation +
  detention + courier info + up to 5 damage photos saved, status unchanged)
  → attempt a second acknowledge on the same LR (should be rejected, 1:1).

## Explicitly deferred (flagged, not designed here)

1. Dual `operationalStatus`/`billingStatus` axis from `ERP_MODULE_PLAN_V2.md`
   §4.2 — superseded by the flat `DELIVERED` enum value here; billing-status
   modeling is a separate, larger accounts-side effort.
2. Full `PODDispatch` courier tracker (status machine, `receivedAtHOAt`) —
   replaced by three flat fields on `LRAcknowledgement`. Revisit only if
   courier-side reconciliation becomes its own operational problem.
3. `LRFreightRevision`, `LRTripAssignmentHistory`, frozen party snapshots,
   `paymentMode`/`currentVehicleNo` — all separately listed as "planned" in
   `ERP_MODULE_PLAN_V2.md` §4.2 but unrelated to this gap; not touched.
4. The parallel rail-side `DCAcknowledgment` (Supervisor + Broker dual-ack)
   and detention-slab chain (§4.4 of the same doc) — a separate, larger rail
   settlement chain; out of scope here.
5. Reversal/undo of LR Delivered — legacy has no such path; open question for
   the team rather than a speculative design.
