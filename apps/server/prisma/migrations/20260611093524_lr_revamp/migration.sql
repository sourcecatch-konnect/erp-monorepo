/*
  Warnings:

  - The primary key for the `EwayBill` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `ewaybill_no` on the `EwayBill` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `EwayBill` table. All the data in the column will be lost.
  - You are about to drop the column `issueDate` on the `EwayBill` table. All the data in the column will be lost.
  - You are about to drop the column `lorryReceiptId` on the `Goods` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceNo` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceValue` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `isInvoiceGenerated` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `isPodUploaded` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `lrStatus` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `routeId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `transportType` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `tripId` on the `LorryReceipt` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lrNumber]` on the table `LorryReceipt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ewayBillNo` to the `EwayBill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `EwayBill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generatedAt` to the `EwayBill` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `EwayBill` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `EwayBill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consignorId` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationBranchId` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fyCode` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lrNumber` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originBranchId` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleId` to the `LorryReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LRStatus" AS ENUM ('DRAFT', 'FINALISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LRChargeType" AS ENUM ('BASE_FREIGHT');

-- CreateEnum
CREATE TYPE "LRSource" AS ENUM ('FROM_ORDER', 'INSTANT');

-- DropForeignKey
ALTER TABLE "Goods" DROP CONSTRAINT "Goods_lorryReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_routeId_fkey";

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_tripId_fkey";

-- AlterTable
ALTER TABLE "EwayBill" DROP CONSTRAINT "EwayBill_pkey",
DROP COLUMN "ewaybill_no",
DROP COLUMN "expiryDate",
DROP COLUMN "issueDate",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "ewayBillNo" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "generatedBy" TEXT,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "EwayBill_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Goods" DROP COLUMN "lorryReceiptId";

-- AlterTable
ALTER TABLE "LorryReceipt" DROP COLUMN "invoiceNo",
DROP COLUMN "invoiceValue",
DROP COLUMN "isInvoiceGenerated",
DROP COLUMN "isPodUploaded",
DROP COLUMN "lrStatus",
DROP COLUMN "priority",
DROP COLUMN "routeId",
DROP COLUMN "transportType",
DROP COLUMN "tripId",
ADD COLUMN     "consignorId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "destinationBranchId" TEXT NOT NULL,
ADD COLUMN     "finalisedAt" TIMESTAMP(3),
ADD COLUMN     "finalisedById" TEXT,
ADD COLUMN     "fyCode" TEXT NOT NULL,
ADD COLUMN     "lrNumber" TEXT NOT NULL,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "originBranchId" TEXT NOT NULL,
ADD COLUMN     "source" "LRSource" NOT NULL,
ADD COLUMN     "status" "LRStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vehicleId" TEXT NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropEnum
DROP TYPE "LRPriority";

-- DropEnum
DROP TYPE "LRstatus";

-- DropEnum
DROP TYPE "TransportType";

-- CreateTable
CREATE TABLE "LRGoods" (
    "id" TEXT NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRGoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRCharge" (
    "id" TEXT NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,
    "chargeType" "LRChargeType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LRGoods_lorryReceiptId_idx" ON "LRGoods"("lorryReceiptId");

-- CreateIndex
CREATE INDEX "LRCharge_lorryReceiptId_idx" ON "LRCharge"("lorryReceiptId");

-- CreateIndex
CREATE INDEX "EwayBill_lorryReceiptId_idx" ON "EwayBill"("lorryReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "LorryReceipt_lrNumber_key" ON "LorryReceipt"("lrNumber");

-- CreateIndex
CREATE INDEX "LorryReceipt_status_idx" ON "LorryReceipt"("status");

-- CreateIndex
CREATE INDEX "LorryReceipt_orderId_idx" ON "LorryReceipt"("orderId");

-- CreateIndex
CREATE INDEX "LorryReceipt_originBranchId_idx" ON "LorryReceipt"("originBranchId");

-- CreateIndex
CREATE INDEX "LorryReceipt_destinationBranchId_idx" ON "LorryReceipt"("destinationBranchId");

-- CreateIndex
CREATE INDEX "LorryReceipt_fyCode_idx" ON "LorryReceipt"("fyCode");

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGoods" ADD CONSTRAINT "LRGoods_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRCharge" ADD CONSTRAINT "LRCharge_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
