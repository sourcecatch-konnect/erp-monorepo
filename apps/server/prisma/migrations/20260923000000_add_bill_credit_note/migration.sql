-- Post-finalisation bill correction (Credit Note / Debit Note). GST makes
-- invoice fields immutable once a bill is finalised (see CONTEXT.md
-- "Freight is locked on bill"), so a correction is a separate document that
-- posts its own voucher and adjusts Bill.outstandingAmountPaise, rather than
-- editing or reversing the original SALES voucher.

CREATE TABLE "BillCreditNote" (
  "id" TEXT NOT NULL,
  "noteType" "VoucherType" NOT NULL,
  "noteNumber" TEXT NOT NULL,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "journalEntryId" TEXT,

  CONSTRAINT "BillCreditNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillCreditNote_noteNumber_key" ON "BillCreditNote"("noteNumber");
CREATE UNIQUE INDEX "BillCreditNote_journalEntryId_key" ON "BillCreditNote"("journalEntryId");
CREATE INDEX "BillCreditNote_billId_idx" ON "BillCreditNote"("billId");
CREATE INDEX "BillCreditNote_customerId_idx" ON "BillCreditNote"("customerId");
CREATE INDEX "BillCreditNote_branchId_fyCode_idx" ON "BillCreditNote"("branchId", "fyCode");

ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillCreditNote" ADD CONSTRAINT "BillCreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
