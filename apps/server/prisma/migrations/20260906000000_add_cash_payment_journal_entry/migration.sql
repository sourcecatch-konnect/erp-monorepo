-- Link a CashPayment to the double-entry PAYMENT voucher posted for it,
-- mirroring Bill.journalEntryId and Receipt.journalEntryId. Nullable + unique:
-- a payment has at most one voucher, a voucher belongs to at most one payment.
ALTER TABLE "CashPayment" ADD COLUMN "journalEntryId" TEXT;

CREATE UNIQUE INDEX "CashPayment_journalEntryId_key" ON "CashPayment"("journalEntryId");

ALTER TABLE "CashPayment" ADD CONSTRAINT "CashPayment_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
