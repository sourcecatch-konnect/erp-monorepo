/*
  Warnings:

  - You are about to drop the column `updatecById` on the `OrderBooking` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrderBooking" DROP CONSTRAINT "OrderBooking_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "OrderBooking" DROP CONSTRAINT "OrderBooking_updatecById_fkey";

-- AlterTable
ALTER TABLE "OrderBooking" DROP COLUMN "updatecById",
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "approvedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBooking" ADD CONSTRAINT "OrderBooking_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
