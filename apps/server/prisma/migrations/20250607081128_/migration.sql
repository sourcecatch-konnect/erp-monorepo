/*
  Warnings:

  - The `truckDetail` column on the `OrderBooking` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `OrderBooking` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- AlterTable
ALTER TABLE "OrderBooking" DROP COLUMN "truckDetail",
ADD COLUMN     "truckDetail" JSONB,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'Pending';
