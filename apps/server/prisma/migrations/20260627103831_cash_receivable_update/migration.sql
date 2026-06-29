-- CreateTable
CREATE TABLE "CashReceivableReceipt" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashReceivableReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashReceivableReceipt_receivableId_idx" ON "CashReceivableReceipt"("receivableId");

-- AddForeignKey
ALTER TABLE "CashReceivableReceipt" ADD CONSTRAINT "CashReceivableReceipt_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "CashReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
