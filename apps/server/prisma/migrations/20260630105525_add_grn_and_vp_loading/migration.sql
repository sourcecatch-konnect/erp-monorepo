-- CreateEnum
CREATE TYPE "GRNStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GRNDamagesBy" AS ENUM ('NONE', 'TRANSPORTER', 'LABOUR', 'RAILWAY', 'CUSTOMER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VPLoadingStatus" AS ENUM ('DRAFT', 'LOADED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "VPScheduleStatus" ADD VALUE 'MRRR_CREATED';

-- CreateTable
CREATE TABLE "GRN" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,
    "vpScheduleId" TEXT NOT NULL,
    "status" "GRNStatus" NOT NULL DEFAULT 'DRAFT',
    "gateNo" TEXT,
    "inDateTime" TIMESTAMP(3),
    "outDateTime" TIMESTAMP(3),
    "unloadingMinutes" INTEGER,
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "damageQty" INTEGER NOT NULL DEFAULT 0,
    "shortageQty" INTEGER NOT NULL DEFAULT 0,
    "totalWeightMt" DECIMAL(65,30),
    "totalFreight" BIGINT,
    "balanceFreight" BIGINT,
    "freightPerMt" BIGINT,
    "detentionDays" INTEGER NOT NULL DEFAULT 0,
    "detentionRate" BIGINT,
    "detentionAmount" BIGINT NOT NULL DEFAULT 0,
    "grossTotal" BIGINT NOT NULL DEFAULT 0,
    "advanceAmount" BIGINT NOT NULL DEFAULT 0,
    "damageAmount" BIGINT NOT NULL DEFAULT 0,
    "tdsAmount" BIGINT NOT NULL DEFAULT 0,
    "hamaliAmount" BIGINT NOT NULL DEFAULT 0,
    "printingStationaryAmount" BIGINT NOT NULL DEFAULT 0,
    "netAmount" BIGINT NOT NULL DEFAULT 0,
    "labourId" TEXT,
    "labourCharge" BIGINT,
    "unloadingSupervisorId" TEXT,
    "damagesBy" "GRNDamagesBy",
    "lrCopyChecked" BOOLEAN NOT NULL DEFAULT false,
    "invoiceChecked" BOOLEAN NOT NULL DEFAULT false,
    "kataReceiptChecked" BOOLEAN NOT NULL DEFAULT false,
    "wayBillChecked" BOOLEAN NOT NULL DEFAULT false,
    "sealNoChecked" BOOLEAN NOT NULL DEFAULT false,
    "lrCopyRemark" TEXT,
    "invoiceRemark" TEXT,
    "kataReceiptRemark" TEXT,
    "wayBillRemark" TEXT,
    "sealNoRemark" TEXT,
    "remarks" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRNGoods" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "lrGoodsId" TEXT,
    "goodsName" TEXT NOT NULL,
    "description" TEXT,
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "damageQty" INTEGER NOT NULL DEFAULT 0,
    "shortageQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "weight" DECIMAL(65,30),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRNGoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPLoading" (
    "id" TEXT NOT NULL,
    "loadingNumber" TEXT NOT NULL,
    "vpScheduleId" TEXT NOT NULL,
    "mrRrId" TEXT NOT NULL,
    "mrRrRowId" TEXT NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "status" "VPLoadingStatus" NOT NULL DEFAULT 'DRAFT',
    "gateNo" TEXT,
    "loadedQty" INTEGER NOT NULL DEFAULT 0,
    "loadedCft" DOUBLE PRECISION,
    "loadedWeightMt" DECIMAL(65,30),
    "labourId" TEXT,
    "labourCharge" BIGINT,
    "loadingSupervisorId" TEXT,
    "loadingStartedAt" TIMESTAMP(3),
    "loadingCompletedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VPLoading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GRN_grnNumber_key" ON "GRN"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_lorryReceiptId_key" ON "GRN"("lorryReceiptId");

-- CreateIndex
CREATE INDEX "GRN_vpScheduleId_idx" ON "GRN"("vpScheduleId");

-- CreateIndex
CREATE INDEX "GRN_status_idx" ON "GRN"("status");

-- CreateIndex
CREATE INDEX "GRN_createdById_idx" ON "GRN"("createdById");

-- CreateIndex
CREATE INDEX "GRN_deletedAt_idx" ON "GRN"("deletedAt");

-- CreateIndex
CREATE INDEX "GRNGoods_grnId_idx" ON "GRNGoods"("grnId");

-- CreateIndex
CREATE INDEX "GRNGoods_lrGoodsId_idx" ON "GRNGoods"("lrGoodsId");

-- CreateIndex
CREATE UNIQUE INDEX "VPLoading_loadingNumber_key" ON "VPLoading"("loadingNumber");

-- CreateIndex
CREATE INDEX "VPLoading_vpScheduleId_idx" ON "VPLoading"("vpScheduleId");

-- CreateIndex
CREATE INDEX "VPLoading_mrRrId_idx" ON "VPLoading"("mrRrId");

-- CreateIndex
CREATE INDEX "VPLoading_mrRrRowId_idx" ON "VPLoading"("mrRrRowId");

-- CreateIndex
CREATE INDEX "VPLoading_lorryReceiptId_idx" ON "VPLoading"("lorryReceiptId");

-- CreateIndex
CREATE INDEX "VPLoading_grnId_idx" ON "VPLoading"("grnId");

-- CreateIndex
CREATE INDEX "VPLoading_status_idx" ON "VPLoading"("status");

-- CreateIndex
CREATE INDEX "VPLoading_deletedAt_idx" ON "VPLoading"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VPLoading_mrRrRowId_lorryReceiptId_key" ON "VPLoading"("mrRrRowId", "lorryReceiptId");

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_unloadingSupervisorId_fkey" FOREIGN KEY ("unloadingSupervisorId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNGoods" ADD CONSTRAINT "GRNGoods_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNGoods" ADD CONSTRAINT "GRNGoods_lrGoodsId_fkey" FOREIGN KEY ("lrGoodsId") REFERENCES "LRGoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_mrRrId_fkey" FOREIGN KEY ("mrRrId") REFERENCES "MRRR"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_mrRrRowId_fkey" FOREIGN KEY ("mrRrRowId") REFERENCES "MRRRRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_loadingSupervisorId_fkey" FOREIGN KEY ("loadingSupervisorId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
