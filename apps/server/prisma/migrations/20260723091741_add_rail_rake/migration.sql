-- CreateEnum
CREATE TYPE "RailRakeStatus" AS ENUM ('CREATED', 'DISPATCHED', 'UNLOADING', 'RECEIVED');

-- CreateEnum
CREATE TYPE "RailBranchGRNStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterEnum
ALTER TYPE "VPScheduleStatus" ADD VALUE 'FINALISED';

-- AlterTable
ALTER TABLE "VPSchedule" ADD COLUMN     "finalisedAt" TIMESTAMP(3),
ADD COLUMN     "finalisedById" TEXT;

-- CreateTable
CREATE TABLE "RailRake" (
    "id" TEXT NOT NULL,
    "rakeNumber" TEXT NOT NULL,
    "railwayRakeNumber" TEXT,
    "fyCode" TEXT NOT NULL,
    "vpScheduleId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "RailRakeStatus" NOT NULL DEFAULT 'CREATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "expectedArrivalAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedById" TEXT,
    "unloadingStartedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "dispatchRemarks" TEXT,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailBranchGRN" (
    "id" TEXT NOT NULL,
    "railRakeId" TEXT NOT NULL,
    "vpWagonLoadingId" TEXT NOT NULL,
    "status" "RailBranchGRNStatus" NOT NULL DEFAULT 'DRAFT',
    "inDateTime" TIMESTAMP(3),
    "outDateTime" TIMESTAMP(3),
    "unloadingMinutes" INTEGER,
    "damagesBy" "GRNDamagesBy" NOT NULL DEFAULT 'NONE',
    "labourCount" INTEGER NOT NULL DEFAULT 0,
    "labourLeaderId" TEXT,
    "labourCharge" BIGINT,
    "unloadingSupervisorId" TEXT,
    "totalLoadedQty" INTEGER NOT NULL DEFAULT 0,
    "totalReceivedQty" INTEGER NOT NULL DEFAULT 0,
    "totalDamageQty" INTEGER NOT NULL DEFAULT 0,
    "totalShortageQty" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailBranchGRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailBranchGRNItem" (
    "id" TEXT NOT NULL,
    "railBranchGrnId" TEXT NOT NULL,
    "vpLoadingGoodsId" TEXT NOT NULL,
    "lrNumberSnapshot" TEXT NOT NULL,
    "consignorNameSnapshot" TEXT,
    "consigneeNameSnapshot" TEXT,
    "goodsNameSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT,
    "loadedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "damageQty" INTEGER NOT NULL DEFAULT 0,
    "shortageQty" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailBranchGRNItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RailRake_rakeNumber_key" ON "RailRake"("rakeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RailRake_vpScheduleId_key" ON "RailRake"("vpScheduleId");

-- CreateIndex
CREATE INDEX "RailRake_fromBranchId_status_idx" ON "RailRake"("fromBranchId", "status");

-- CreateIndex
CREATE INDEX "RailRake_toBranchId_status_idx" ON "RailRake"("toBranchId", "status");

-- CreateIndex
CREATE INDEX "RailRake_status_idx" ON "RailRake"("status");

-- CreateIndex
CREATE INDEX "RailRake_fyCode_idx" ON "RailRake"("fyCode");

-- CreateIndex
CREATE INDEX "RailRake_railwayRakeNumber_idx" ON "RailRake"("railwayRakeNumber");

-- CreateIndex
CREATE INDEX "RailRake_createdAt_idx" ON "RailRake"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RailBranchGRN_vpWagonLoadingId_key" ON "RailBranchGRN"("vpWagonLoadingId");

-- CreateIndex
CREATE INDEX "RailBranchGRN_railRakeId_status_idx" ON "RailBranchGRN"("railRakeId", "status");

-- CreateIndex
CREATE INDEX "RailBranchGRN_status_idx" ON "RailBranchGRN"("status");

-- CreateIndex
CREATE INDEX "RailBranchGRN_createdAt_idx" ON "RailBranchGRN"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RailBranchGRNItem_vpLoadingGoodsId_key" ON "RailBranchGRNItem"("vpLoadingGoodsId");

-- CreateIndex
CREATE INDEX "RailBranchGRNItem_railBranchGrnId_idx" ON "RailBranchGRNItem"("railBranchGrnId");

-- CreateIndex
CREATE INDEX "VPSchedule_finalisedById_idx" ON "VPSchedule"("finalisedById");

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRake" ADD CONSTRAINT "RailRake_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRake" ADD CONSTRAINT "RailRake_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRake" ADD CONSTRAINT "RailRake_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRake" ADD CONSTRAINT "RailRake_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRake" ADD CONSTRAINT "RailRake_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_railRakeId_fkey" FOREIGN KEY ("railRakeId") REFERENCES "RailRake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_vpWagonLoadingId_fkey" FOREIGN KEY ("vpWagonLoadingId") REFERENCES "VPWagonLoading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_labourLeaderId_fkey" FOREIGN KEY ("labourLeaderId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_unloadingSupervisorId_fkey" FOREIGN KEY ("unloadingSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRN" ADD CONSTRAINT "RailBranchGRN_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRNItem" ADD CONSTRAINT "RailBranchGRNItem_railBranchGrnId_fkey" FOREIGN KEY ("railBranchGrnId") REFERENCES "RailBranchGRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailBranchGRNItem" ADD CONSTRAINT "RailBranchGRNItem_vpLoadingGoodsId_fkey" FOREIGN KEY ("vpLoadingGoodsId") REFERENCES "VPLoadingGoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
