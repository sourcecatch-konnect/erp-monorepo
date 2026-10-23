-- Corrects 20260923000000_add_bill_credit_note: journalEntryId must be
-- nullable. The note row is created first (to get an id for the voucher's
-- sourceId), the voucher is posted, then this column is patched — same
-- two-step order as Bill.journalEntryId / Receipt.journalEntryId, which are
-- both nullable for the same reason.

ALTER TABLE "BillCreditNote" DROP CONSTRAINT "BillCreditNote_journalEntryId_fkey";
ALTER TABLE "BillCreditNote" ALTER COLUMN "journalEntryId" DROP NOT NULL;
ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
