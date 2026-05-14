/*
  Warnings:

  - You are about to drop the column `permanentLandline` on the `Driver` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OrderBy" AS ENUM ('Truck', 'Goods');

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "permanentLandline";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrderBooking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT NOT NULL,
    "orderBy" "OrderBy" NOT NULL,
    "goodsId" TEXT,
    "truckDetail" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatecById" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBooking_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_updatecById_fkey" FOREIGN KEY ("updatecById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
