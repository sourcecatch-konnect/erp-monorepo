/*
  Warnings:

  - A unique constraint covering the columns `[shortCode]` on the table `Branch` will be added. If there are existing duplicate values, this will fail.
  - Made the column `shortCode` on table `Branch` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Branch" ALTER COLUMN "shortCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderBooking" ALTER COLUMN "truckDetail" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrderGoods" (
    "id" TEXT NOT NULL,
    "orderBookingId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderGoods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_shortCode_key" ON "Branch"("shortCode");

-- AddForeignKey
ALTER TABLE "OrderGoods" ADD CONSTRAINT "OrderGoods_orderBookingId_fkey" FOREIGN KEY ("orderBookingId") REFERENCES "OrderBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderGoods" ADD CONSTRAINT "OrderGoods_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
