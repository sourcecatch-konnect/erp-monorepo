-- DC Acknowledgement + Approval (LDC phase L5).
--
-- Two independent accounts of how a delivery challan went — SK's supervisor
-- and the broker — compared side by side, then one of them accepted by an
-- approver. CONTEXT.md §5.2: the broker's claim is "often inflated", and
-- mismatch detection between the two is the fraud control.
--
-- Decisions this encodes:
--   Q8  acknowledgement + approval are mandatory before detention and payment
--   Q9  approval posts NOTHING — it produces amounts; the vendor-payment slip
--       stays the single accrual point. No ledger column anywhere below.
--   Q18 the approved acknowledgement's dates drive the detention window
--   Q10 challans issued before the cutover are grandfathered, which is an
--       application rule (LDC_ACK_REQUIRED_FROM) — nothing here enforces it,
--       so no existing row is invalidated by this migration.
--
-- Purely additive: three new tables and one new enum. No existing table is
-- altered, no existing row is touched, and every `DeliveryChallanStatus`
-- guard in the application keeps working unchanged.

CREATE TYPE "DeliveryChallanAckType" AS ENUM ('SUPERVISOR', 'BROKER');

CREATE TABLE "DeliveryChallanAcknowledgement" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "ackType" "DeliveryChallanAckType" NOT NULL,
    "reportingDate" TIMESTAMP(3),
    "unloadingDate" TIMESTAMP(3),
    "collectionDate" TIMESTAMP(3),
    "claimedDetentionDays" INTEGER,
    "claimedDetentionPaise" BIGINT,
    "parkingPaise" BIGINT,
    "otherPaise" BIGINT,
    "labourPaise" BIGINT,
    "damagePaise" BIGINT,
    "remarks" TEXT,
    "podAttachmentId" TEXT,
    "filedById" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallanAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- One acknowledgement per party per challan: exactly the "two parallel rows"
-- the plan specifies, and no more.
CREATE UNIQUE INDEX "DeliveryChallanAcknowledgement_challanId_ackType_key"
    ON "DeliveryChallanAcknowledgement"("challanId", "ackType");
CREATE INDEX "DeliveryChallanAcknowledgement_challanId_idx"
    ON "DeliveryChallanAcknowledgement"("challanId");

-- Claimed money is never negative. Days are a count, so also never negative.
ALTER TABLE "DeliveryChallanAcknowledgement"
  ADD CONSTRAINT "DeliveryChallanAck_amounts_nonneg_chk" CHECK (
    coalesce("claimedDetentionPaise", 0) >= 0
    AND coalesce("parkingPaise", 0) >= 0
    AND coalesce("otherPaise", 0) >= 0
    AND coalesce("labourPaise", 0) >= 0
    AND coalesce("damagePaise", 0) >= 0
    AND coalesce("claimedDetentionDays", 0) >= 0
  );

-- A window that ends before it starts is bad data, not a zero-day detention.
ALTER TABLE "DeliveryChallanAcknowledgement"
  ADD CONSTRAINT "DeliveryChallanAck_window_order_chk" CHECK (
    "reportingDate" IS NULL
    OR "unloadingDate" IS NULL
    OR "unloadingDate" >= "reportingDate"
  );

CREATE TABLE "DeliveryChallanAckItem" (
    "id" TEXT NOT NULL,
    "ackId" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "lrNumberSnapshot" TEXT NOT NULL,
    "totalQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "damageQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallanAckItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryChallanAckItem_ackId_challanItemId_key"
    ON "DeliveryChallanAckItem"("ackId", "challanItemId");
CREATE INDEX "DeliveryChallanAckItem_ackId_idx"
    ON "DeliveryChallanAckItem"("ackId");

-- Shortage is derived as (totalQty - receivedQty) and never stored, so the
-- only thing to enforce is that the inputs make sense: nothing negative, and
-- neither received nor damaged exceeding what was sent.
ALTER TABLE "DeliveryChallanAckItem"
  ADD CONSTRAINT "DeliveryChallanAckItem_qty_chk" CHECK (
    "totalQty" >= 0
    AND "receivedQty" >= 0
    AND "damageQty" >= 0
    AND "receivedQty" <= "totalQty"
    AND "damageQty" <= "totalQty"
  );

CREATE TABLE "DeliveryChallanApproval" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "acceptedAckType" "DeliveryChallanAckType" NOT NULL,
    "acceptedAckId" TEXT NOT NULL,
    "approvedDetentionDays" INTEGER,
    "approvedParkingPaise" BIGINT,
    "approvedOtherPaise" BIGINT,
    "approvedLabourPaise" BIGINT,
    "approvedDamagePaise" BIGINT,
    "approvedShortagePaise" BIGINT,
    "remarks" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallanApproval_pkey" PRIMARY KEY ("id")
);

-- One ruling per challan, and an acknowledgement can be the accepted one at
-- most once (which follows from the first).
CREATE UNIQUE INDEX "DeliveryChallanApproval_challanId_key"
    ON "DeliveryChallanApproval"("challanId");
CREATE UNIQUE INDEX "DeliveryChallanApproval_acceptedAckId_key"
    ON "DeliveryChallanApproval"("acceptedAckId");
CREATE INDEX "DeliveryChallanApproval_challanId_idx"
    ON "DeliveryChallanApproval"("challanId");

ALTER TABLE "DeliveryChallanApproval"
  ADD CONSTRAINT "DeliveryChallanApproval_amounts_nonneg_chk" CHECK (
    coalesce("approvedParkingPaise", 0) >= 0
    AND coalesce("approvedOtherPaise", 0) >= 0
    AND coalesce("approvedLabourPaise", 0) >= 0
    AND coalesce("approvedDamagePaise", 0) >= 0
    AND coalesce("approvedShortagePaise", 0) >= 0
    AND coalesce("approvedDetentionDays", 0) >= 0
  );

ALTER TABLE "DeliveryChallanAcknowledgement"
  ADD CONSTRAINT "DeliveryChallanAcknowledgement_challanId_fkey"
  FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryChallanAcknowledgement"
  ADD CONSTRAINT "DeliveryChallanAcknowledgement_filedById_fkey"
  FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryChallanAckItem"
  ADD CONSTRAINT "DeliveryChallanAckItem_ackId_fkey"
  FOREIGN KEY ("ackId") REFERENCES "DeliveryChallanAcknowledgement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryChallanAckItem"
  ADD CONSTRAINT "DeliveryChallanAckItem_challanItemId_fkey"
  FOREIGN KEY ("challanItemId") REFERENCES "DeliveryChallanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryChallanApproval"
  ADD CONSTRAINT "DeliveryChallanApproval_challanId_fkey"
  FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryChallanApproval"
  ADD CONSTRAINT "DeliveryChallanApproval_acceptedAckId_fkey"
  FOREIGN KEY ("acceptedAckId") REFERENCES "DeliveryChallanAcknowledgement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryChallanApproval"
  ADD CONSTRAINT "DeliveryChallanApproval_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
