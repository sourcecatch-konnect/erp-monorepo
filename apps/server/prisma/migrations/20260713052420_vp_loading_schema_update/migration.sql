/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `gateNo` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `labourCharge` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `labourId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `loadingCompletedAt` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `loadingStartedAt` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `loadingSupervisorId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `lorryReceiptId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `mrRrId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `mrRrRowId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to drop the column `vpScheduleId` on the `VPLoading` table. All the data in the column will be lost.
  - You are about to alter the column `loadedCft` on the `VPLoading` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `loadedWeightMt` on the `VPLoading` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - A unique constraint covering the columns `[vpWagonLoadingId,grnId]` on the table `VPLoading` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `vpWagonLoadingId` to the `VPLoading` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CapacityCheckStatus" AS ENUM ('NOT_CHECKED', 'UNKNOWN', 'WITHIN_ESTIMATE', 'EXCEEDED_ESTIMATE', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('UNKNOWN', 'GOODS_MASTER_ESTIMATE', 'LR_DECLARED', 'GRN_DECLARED', 'CUSTOMER_DECLARED', 'INVOICE', 'WEIGHBRIDGE', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "VPWagonLoadingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VPScheduleStatus" ADD VALUE 'LOADING';
ALTER TYPE "VPScheduleStatus" ADD VALUE 'LOADED';
ALTER TYPE "VPScheduleStatus" ADD VALUE 'VERIFIED';

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_labourId_fkey";

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_loadingSupervisorId_fkey";

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_lorryReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_mrRrId_fkey";

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_mrRrRowId_fkey";

-- DropForeignKey
ALTER TABLE "VPLoading" DROP CONSTRAINT "VPLoading_vpScheduleId_fkey";

-- DropIndex
DROP INDEX "VPLoading_deletedAt_idx";

-- DropIndex
DROP INDEX "VPLoading_lorryReceiptId_idx";

-- DropIndex
DROP INDEX "VPLoading_mrRrId_idx";

-- DropIndex
DROP INDEX "VPLoading_mrRrRowId_idx";

-- DropIndex
DROP INDEX "VPLoading_mrRrRowId_lorryReceiptId_key";

-- DropIndex
DROP INDEX "VPLoading_vpScheduleId_idx";

-- AlterTable
ALTER TABLE "VPLoading" DROP COLUMN "deletedAt",
DROP COLUMN "gateNo",
DROP COLUMN "labourCharge",
DROP COLUMN "labourId",
DROP COLUMN "loadingCompletedAt",
DROP COLUMN "loadingStartedAt",
DROP COLUMN "loadingSupervisorId",
DROP COLUMN "lorryReceiptId",
DROP COLUMN "mrRrId",
DROP COLUMN "mrRrRowId",
DROP COLUMN "vpScheduleId",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "vpWagonLoadingId" TEXT NOT NULL,
ALTER COLUMN "loadedCft" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "loadedWeightMt" SET DATA TYPE DECIMAL(14,4);

-- CreateTable
CREATE TABLE "VPWagonLoading" (
    "id" TEXT NOT NULL,
    "mrRrRowId" TEXT NOT NULL,
    "status" "VPWagonLoadingStatus" NOT NULL DEFAULT 'DRAFT',
    "gateNo" TEXT,
    "labourId" TEXT,
    "labourCharge" BIGINT,
    "wagonCapacityCftSnapshot" DECIMAL(14,4),
    "wagonCapacityMtSnapshot" DECIMAL(14,4),
    "capacityCheckStatus" "CapacityCheckStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "capacityExceededCft" DECIMAL(14,4),
    "capacityExceededMt" DECIMAL(14,4),
    "capacityOverrideReason" TEXT,
    "capacityOverrideById" TEXT,
    "capacityOverrideAt" TIMESTAMP(3),
    "loadingSupervisorId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "loadingStartedAt" TIMESTAMP(3),
    "loadingCompletedAt" TIMESTAMP(3),
    "totalLoadedQty" INTEGER NOT NULL DEFAULT 0,
    "totalLoadedCft" DECIMAL(14,4),
    "totalLoadedWeightMt" DECIMAL(14,4),
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPWagonLoading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPLoadingGoods" (
    "id" TEXT NOT NULL,
    "vpLoadingId" TEXT NOT NULL,
    "grnGoodsId" TEXT NOT NULL,
    "loadedQty" INTEGER NOT NULL DEFAULT 0,
    "loadingDamageQty" INTEGER NOT NULL DEFAULT 0,
    "unitWeightKgSnapshot" DECIMAL(12,3),
    "unitCftSnapshot" DECIMAL(12,4),
    "loadedWeightMt" DECIMAL(14,4),
    "loadedCft" DECIMAL(14,4),
    "measurementSource" "MeasurementSource" NOT NULL DEFAULT 'UNKNOWN',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPLoadingGoods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VPWagonLoading_mrRrRowId_key" ON "VPWagonLoading"("mrRrRowId");

-- CreateIndex
CREATE INDEX "VPWagonLoading_mrRrRowId_idx" ON "VPWagonLoading"("mrRrRowId");

-- CreateIndex
CREATE INDEX "VPWagonLoading_labourId_idx" ON "VPWagonLoading"("labourId");

-- CreateIndex
CREATE INDEX "VPWagonLoading_loadingSupervisorId_idx" ON "VPWagonLoading"("loadingSupervisorId");

-- CreateIndex
CREATE INDEX "VPWagonLoading_status_idx" ON "VPWagonLoading"("status");

-- CreateIndex
CREATE INDEX "VPLoadingGoods_vpLoadingId_idx" ON "VPLoadingGoods"("vpLoadingId");

-- CreateIndex
CREATE INDEX "VPLoadingGoods_grnGoodsId_idx" ON "VPLoadingGoods"("grnGoodsId");

-- CreateIndex
CREATE UNIQUE INDEX "VPLoadingGoods_vpLoadingId_grnGoodsId_key" ON "VPLoadingGoods"("vpLoadingId", "grnGoodsId");

-- CreateIndex
CREATE INDEX "VPLoading_vpWagonLoadingId_idx" ON "VPLoading"("vpWagonLoadingId");

-- CreateIndex
CREATE UNIQUE INDEX "VPLoading_vpWagonLoadingId_grnId_key" ON "VPLoading"("vpWagonLoadingId", "grnId");

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_vpWagonLoadingId_fkey" FOREIGN KEY ("vpWagonLoadingId") REFERENCES "VPWagonLoading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoading" ADD CONSTRAINT "VPLoading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_mrRrRowId_fkey" FOREIGN KEY ("mrRrRowId") REFERENCES "MRRRRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_capacityOverrideById_fkey" FOREIGN KEY ("capacityOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_loadingSupervisorId_fkey" FOREIGN KEY ("loadingSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPWagonLoading" ADD CONSTRAINT "VPWagonLoading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoadingGoods" ADD CONSTRAINT "VPLoadingGoods_vpLoadingId_fkey" FOREIGN KEY ("vpLoadingId") REFERENCES "VPLoading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPLoadingGoods" ADD CONSTRAINT "VPLoadingGoods_grnGoodsId_fkey" FOREIGN KEY ("grnGoodsId") REFERENCES "GRNGoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
