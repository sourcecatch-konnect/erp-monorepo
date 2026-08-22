-- CreateEnum
CREATE TYPE "CashReceivableSource" AS ENUM ('MANUAL', 'BILL');

-- AlterTable
ALTER TABLE "CashReceivable" ADD COLUMN     "billId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "source" "CashReceivableSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "CashReceivable_billId_key" ON "CashReceivable"("billId");

-- CreateIndex
CREATE INDEX "CashReceivable_customerId_idx" ON "CashReceivable"("customerId");

-- AddForeignKey
ALTER TABLE "CashReceivable" ADD CONSTRAINT "CashReceivable_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashReceivable" ADD CONSTRAINT "CashReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

