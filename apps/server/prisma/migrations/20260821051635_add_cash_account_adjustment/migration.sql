-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "receivedIntoAccountId" TEXT;

-- CreateTable
CREATE TABLE "CashAccountAdjustment" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "receiptId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashAccountAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashAccountAdjustment_dayId_accountId_idx" ON "CashAccountAdjustment"("dayId", "accountId");

-- CreateIndex
CREATE INDEX "CashAccountAdjustment_receiptId_idx" ON "CashAccountAdjustment"("receiptId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_receivedIntoAccountId_fkey" FOREIGN KEY ("receivedIntoAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountAdjustment" ADD CONSTRAINT "CashAccountAdjustment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CashPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountAdjustment" ADD CONSTRAINT "CashAccountAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountAdjustment" ADD CONSTRAINT "CashAccountAdjustment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountAdjustment" ADD CONSTRAINT "CashAccountAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

