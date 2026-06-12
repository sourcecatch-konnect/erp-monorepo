/*
  Warnings:

  - You are about to alter the column `interestRateLatePayment` on the `Customer` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `creditLimit` on the `Customer` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `tdsDeductionRate` on the `Customer` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `rate` on the `DetentionRate` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `salary` on the `Driver` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `noTDSApplyAmount` on the `Driver` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `tdsRate` on the `Driver` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `amount` on the `LRCharge` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `tdsAmount` on the `Labour` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `tdsRate` on the `Labour` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `vehicleId` on the `LorryReceipt` table. All the data in the column will be lost.
  - You are about to alter the column `bookingFreightAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `currentDieselRate` on the `Pump` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `creditLimit` on the `Pump` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `freightAmount` on the `RailwayFreightMatrix` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `rate` on the `RateMatrix` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `rate` on the `SparePart` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `onwardFreight` on the `VehicleTrip` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `freightRangeFrom` on the `VehicleType` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `freightRangeTo` on the `VehicleType` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `monthlyRent` on the `Warehouse` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `securityDeposit` on the `Warehouse` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- CreateEnum
CREATE TYPE "LRTransportType" AS ENUM ('Road', 'Rail', 'RoadAndRail');

-- CreateEnum
CREATE TYPE "LRTripLegType" AS ENUM ('DIRECT', 'TO_HUB', 'FROM_HUB');

-- CreateEnum
CREATE TYPE "LRPriority" AS ENUM ('Normal', 'Express', 'Critical');

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_vehicleId_fkey";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "interestRateLatePayment" SET DATA TYPE INTEGER,
ALTER COLUMN "creditLimit" SET DATA TYPE INTEGER,
ALTER COLUMN "tdsDeductionRate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "DetentionRate" ALTER COLUMN "rate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Driver" ALTER COLUMN "salary" SET DATA TYPE INTEGER,
ALTER COLUMN "noTDSApplyAmount" SET DATA TYPE INTEGER,
ALTER COLUMN "tdsRate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "LRCharge" ALTER COLUMN "amount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Labour" ALTER COLUMN "tdsAmount" SET DATA TYPE INTEGER,
ALTER COLUMN "tdsRate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "LorryReceipt" DROP COLUMN "vehicleId",
ADD COLUMN     "hubId" TEXT,
ADD COLUMN     "invoiceAmount" INTEGER,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "isMarketVehicle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketDriverName" TEXT,
ADD COLUMN     "marketVehicleNumber" TEXT,
ADD COLUMN     "primaryTripId" TEXT,
ADD COLUMN     "priority" "LRPriority" NOT NULL DEFAULT 'Normal',
ADD COLUMN     "sealNumber" TEXT,
ADD COLUMN     "secondaryTripId" TEXT,
ADD COLUMN     "transportType" "LRTransportType" NOT NULL DEFAULT 'Road',
ADD COLUMN     "tripLegType" "LRTripLegType" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "bookingFreightAmount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Pump" ALTER COLUMN "currentDieselRate" SET DATA TYPE INTEGER,
ALTER COLUMN "creditLimit" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "RailwayFreightMatrix" ALTER COLUMN "freightAmount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "RateMatrix" ALTER COLUMN "rate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "SparePart" ALTER COLUMN "rate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "VehicleTrip" ALTER COLUMN "onwardFreight" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "VehicleType" ALTER COLUMN "freightRangeFrom" SET DATA TYPE INTEGER,
ALTER COLUMN "freightRangeTo" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Warehouse" ALTER COLUMN "monthlyRent" SET DATA TYPE INTEGER,
ALTER COLUMN "securityDeposit" SET DATA TYPE INTEGER;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_primaryTripId_fkey" FOREIGN KEY ("primaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_secondaryTripId_fkey" FOREIGN KEY ("secondaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
