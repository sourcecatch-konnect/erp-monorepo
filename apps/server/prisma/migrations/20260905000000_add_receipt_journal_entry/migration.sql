-- Link a Receipt to the double-entry voucher posted for it, mirroring
-- Bill.journalEntryId. Nullable + unique: a receipt has at most one voucher,
-- and a voucher belongs to at most one receipt.
ALTER TABLE "Receipt" ADD COLUMN "journalEntryId" TEXT;

CREATE UNIQUE INDEX "Receipt_journalEntryId_key" ON "Receipt"("journalEntryId");

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
