/*
  Warnings:

  - You are about to drop the column `consigneeId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `consignorId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `destinationBranchId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `finalisedAt` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `finalisedById` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `hubId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `isMarketVehicle` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `marketDriverName` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `marketVehicleNumber` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `orderId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `originBranchId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `primaryTripId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `railheadBranchId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `sealNumber` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryTripId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `transportType` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `tripLegType` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the `LRCharge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `groupId` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LRGroupStatus" AS ENUM ('DRAFT', 'FINALISED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "LRCharge" DROP CONSTRAINT "LRCharge_lorryReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_consigneeId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_consignorId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_destinationBranchId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_finalisedById_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_hubId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_orderId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_originBranchId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_primaryTripId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_railheadBranchId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_secondaryTripId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_goodsId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropIndex
DROP INDEX "LorryReceipt_destinationBranchId_idx";

-- DropIndex
DROP INDEX "LorryReceipt_orderId_idx";

-- DropIndex
DROP INDEX "LorryReceipt_originBranchId_idx";

-- AlterTable
ALTER TABLE "LorryReceipt" DROP COLUMN "consigneeId",
DROP COLUMN "consignorId",
DROP COLUMN "destinationBranchId",
DROP COLUMN "finalisedAt",
DROP COLUMN "finalisedById",
DROP COLUMN "hubId",
DROP COLUMN "isMarketVehicle",
DROP COLUMN "marketDriverName",
DROP COLUMN "marketVehicleNumber",
DROP COLUMN "orderId",
DROP COLUMN "originBranchId",
DROP COLUMN "primaryTripId",
DROP COLUMN "priority",
DROP COLUMN "railheadBranchId",
DROP COLUMN "sealNumber",
DROP COLUMN "secondaryTripId",
DROP COLUMN "source",
DROP COLUMN "transportType",
DROP COLUMN "tripLegType",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "loadingLocationId" TEXT,
ADD COLUMN     "unloadingLocationId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "consigneeId" TEXT;

-- DropTable
DROP TABLE "LRCharge";

-- DropTable
DROP TABLE "OrderItem";

-- DropEnum
DROP TYPE "LRChargeType";

-- CreateTable
CREATE TABLE "OrderConsignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "truckIndex" INTEGER NOT NULL DEFAULT 1,
    "loadingLocationId" TEXT,
    "unloadingLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderConsignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderConsignmentGoods" (
    "id" TEXT NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),

    CONSTRAINT "OrderConsignmentGoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRGroup" (
    "id" TEXT NOT NULL,
    "groupNumber" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "source" "LRSource" NOT NULL,
    "orderId" TEXT,
    "truckIndex" INTEGER NOT NULL DEFAULT 1,
    "originBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "consignorId" TEXT NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "transportType" "LRTransportType" NOT NULL DEFAULT 'Road',
    "priority" "LRPriority" NOT NULL DEFAULT 'Normal',
    "isMarketVehicle" BOOLEAN NOT NULL DEFAULT false,
    "primaryTripId" TEXT,
    "secondaryTripId" TEXT,
    "marketVehicleNumber" TEXT,
    "marketDriverName" TEXT,
    "tripLegType" "LRTripLegType" NOT NULL DEFAULT 'DIRECT',
    "hubId" TEXT,
    "railheadBranchId" TEXT,
    "baseFreightAmount" BIGINT,
    "sealNumber" TEXT,
    "status" "LRGroupStatus" NOT NULL DEFAULT 'DRAFT',
    "cancelReason" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "finalisedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LRGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderConsignment_orderId_idx" ON "OrderConsignment"("orderId");

-- CreateIndex
CREATE INDEX "OrderConsignmentGoods_consignmentId_idx" ON "OrderConsignmentGoods"("consignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LRGroup_groupNumber_key" ON "LRGroup"("groupNumber");

-- CreateIndex
CREATE INDEX "LRGroup_status_idx" ON "LRGroup"("status");

-- CreateIndex
CREATE INDEX "LRGroup_orderId_idx" ON "LRGroup"("orderId");

-- CreateIndex
CREATE INDEX "LRGroup_originBranchId_idx" ON "LRGroup"("originBranchId");

-- CreateIndex
CREATE INDEX "LRGroup_destinationBranchId_idx" ON "LRGroup"("destinationBranchId");

-- CreateIndex
CREATE INDEX "LRGroup_fyCode_idx" ON "LRGroup"("fyCode");

-- CreateIndex
CREATE INDEX "LorryReceipt_groupId_idx" ON "LorryReceipt"("groupId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_loadingLocationId_fkey" FOREIGN KEY ("loadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_unloadingLocationId_fkey" FOREIGN KEY ("unloadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "OrderConsignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_primaryTripId_fkey" FOREIGN KEY ("primaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_secondaryTripId_fkey" FOREIGN KEY ("secondaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_railheadBranchId_fkey" FOREIGN KEY ("railheadBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LRGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_loadingLocationId_fkey" FOREIGN KEY ("loadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_unloadingLocationId_fkey" FOREIGN KEY ("unloadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
