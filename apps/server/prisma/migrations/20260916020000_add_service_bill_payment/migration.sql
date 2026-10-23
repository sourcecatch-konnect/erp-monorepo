-- Service Bill Payment (Workshop Inventory — dedicated quick path, per
-- ACCOUNTS_MODULE_MAP scope: independent of the Vendor Payment 3-stage
-- engine for now)

ALTER TABLE "ServiceBill" ADD COLUMN "paidAmountPaise" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "ServiceBillPayment" (
  "id" TEXT NOT NULL,
  "serviceBillId" TEXT NOT NULL,
  "paidPaise" BIGINT NOT NULL,
  "paymentMode" "PaymentMode" NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "referenceNumber" TEXT,
  "fromAccountId" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "remarks" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceBillPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceBillPayment_journalEntryId_key" ON "ServiceBillPayment"("journalEntryId");
CREATE INDEX "ServiceBillPayment_serviceBillId_idx" ON "ServiceBillPayment"("serviceBillId");

ALTER TABLE "ServiceBillPayment" ADD CONSTRAINT "ServiceBillPayment_serviceBillId_fkey" FOREIGN KEY ("serviceBillId") REFERENCES "ServiceBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBillPayment" ADD CONSTRAINT "ServiceBillPayment_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBillPayment" ADD CONSTRAINT "ServiceBillPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceBillPayment" ADD CONSTRAINT "ServiceBillPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
