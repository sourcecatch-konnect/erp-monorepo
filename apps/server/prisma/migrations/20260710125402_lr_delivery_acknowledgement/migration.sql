-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LRStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "LRStatus" ADD VALUE 'ACKNOWLEDGED';

-- AlterTable
ALTER TABLE "LRGroup" ADD COLUMN     "hubArrivalAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LRDelivery" (
    "id" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "unloadingCharges" BIGINT,
    "remark" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRAcknowledgement" (
    "id" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "courierName" TEXT,
    "courierDocketNo" TEXT,
    "courierCharge" BIGINT,
    "detentionDays" INTEGER,
    "detentionAmount" BIGINT,
    "damageAmount" BIGINT,
    "remark" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRAcknowledgementItem" (
    "id" TEXT NOT NULL,
    "ackId" TEXT NOT NULL,
    "lrGoodsId" TEXT NOT NULL,
    "receivedQty" DECIMAL(65,30),
    "damagedQty" DECIMAL(65,30),

    CONSTRAINT "LRAcknowledgementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LRDelivery_lrId_key" ON "LRDelivery"("lrId");

-- CreateIndex
CREATE INDEX "LRDelivery_deliveredAt_idx" ON "LRDelivery"("deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "LRAcknowledgement_lrId_key" ON "LRAcknowledgement"("lrId");

-- CreateIndex
CREATE INDEX "LRAcknowledgement_receivedAt_idx" ON "LRAcknowledgement"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LRAcknowledgementItem_ackId_lrGoodsId_key" ON "LRAcknowledgementItem"("ackId", "lrGoodsId");

-- AddForeignKey
ALTER TABLE "LRDelivery" ADD CONSTRAINT "LRDelivery_lrId_fkey" FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRDelivery" ADD CONSTRAINT "LRDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRDelivery" ADD CONSTRAINT "LRDelivery_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRAcknowledgement" ADD CONSTRAINT "LRAcknowledgement_lrId_fkey" FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRAcknowledgement" ADD CONSTRAINT "LRAcknowledgement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRAcknowledgement" ADD CONSTRAINT "LRAcknowledgement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRAcknowledgementItem" ADD CONSTRAINT "LRAcknowledgementItem_ackId_fkey" FOREIGN KEY ("ackId") REFERENCES "LRAcknowledgement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRAcknowledgementItem" ADD CONSTRAINT "LRAcknowledgementItem_lrGoodsId_fkey" FOREIGN KEY ("lrGoodsId") REFERENCES "LRGoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
