-- Log Slip Phase 6 (Accounts Posting), per TRIP_JOURNEY_LOGSLIP_PLAN.md §7.
-- Adds a driver party ledger (mirrors customer/transport/creditor/etc.) and
-- links LogSlip.postedJournalEntryId to a real JournalEntry.

ALTER TYPE "JournalSourceType" ADD VALUE 'LOG_SLIP';

ALTER TABLE "Ledger" ADD COLUMN "driverId" TEXT;
CREATE UNIQUE INDEX "Ledger_driverId_key" ON "Ledger"("driverId");
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LogSlip_postedJournalEntryId_key" ON "LogSlip"("postedJournalEntryId");
ALTER TABLE "LogSlip" ADD CONSTRAINT "LogSlip_postedJournalEntryId_fkey" FOREIGN KEY ("postedJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
