-- CreateEnum
CREATE TYPE "CashSegment" AS ENUM ('ROAD', 'RAIL', 'FCI');

-- AlterTable
ALTER TABLE "CashPayment" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "projectCode" TEXT,
ADD COLUMN     "segment" "CashSegment";

-- AlterTable
ALTER TABLE "Creditor" ADD COLUMN     "outstandingBalance" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CashReceivable" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "expectedDate" DATE,
    "receivedAmount" BIGINT,
    "ackReceived" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashReceivable_dayId_idx" ON "CashReceivable"("dayId");

-- AddForeignKey
ALTER TABLE "CashReceivable" ADD CONSTRAINT "CashReceivable_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CashPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
