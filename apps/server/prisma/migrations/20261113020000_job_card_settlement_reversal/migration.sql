BEGIN;
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_settlement_positive_chk" CHECK ("paidPaise" >= 0 AND "tdsPaise" >= 0 AND "paidPaise"::numeric + "tdsPaise" > 0);
ALTER TABLE "VendorPaymentDisbursement" ADD COLUMN "reversedAt" TIMESTAMP(3), ADD COLUMN "reversedById" TEXT,
  ADD COLUMN "reversalReason" TEXT, ADD COLUMN "reversalJournalEntryId" TEXT;
ALTER TABLE "ServiceBillPayment" ADD COLUMN "reversedAt" TIMESTAMP(3), ADD COLUMN "reversedById" TEXT,
  ADD COLUMN "reversalReason" TEXT, ADD COLUMN "reversalJournalEntryId" TEXT;
CREATE UNIQUE INDEX "VendorPaymentDisbursement_reversalJournalEntryId_key" ON "VendorPaymentDisbursement"("reversalJournalEntryId");
CREATE UNIQUE INDEX "ServiceBillPayment_reversalJournalEntryId_key" ON "ServiceBillPayment"("reversalJournalEntryId");
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_reversalJournalEntryId_fkey" FOREIGN KEY ("reversalJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "VendorPaymentDisbursement_reversal_complete_chk" CHECK (("reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL AND "reversalJournalEntryId" IS NULL) OR ("reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND "reversalReason" IS NOT NULL AND "reversalJournalEntryId" IS NOT NULL));
ALTER TABLE "ServiceBillPayment" ADD CONSTRAINT "ServiceBillPayment_reversalJournalEntryId_fkey" FOREIGN KEY ("reversalJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceBillPayment_reversal_complete_chk" CHECK (("reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL AND "reversalJournalEntryId" IS NULL) OR ("reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND "reversalReason" IS NOT NULL AND "reversalJournalEntryId" IS NOT NULL));
COMMIT;
