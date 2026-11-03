-- Claims C4: manual claims, assessment and settlement (docs/CLAIMS_JIRA.md).

-- CreateEnum
CREATE TYPE "ClaimSettlementMode" AS ENUM ('RECEIPT_DEDUCTION', 'CREDIT_NOTE', 'PAID_SEPARATELY');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'CLAIM_SETTLEMENT';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "creditNoteId" TEXT,
ADD COLUMN     "pendingSettlement" JSONB,
ADD COLUMN     "receiptAllocationId" TEXT,
ADD COLUMN     "settledById" TEXT,
ADD COLUMN     "settlementApprovedById" TEXT,
ADD COLUMN     "settlementFundingLedgerId" TEXT,
ADD COLUMN     "settlementJournalEntryId" TEXT,
ADD COLUMN     "settlementMode" "ClaimSettlementMode",
ADD COLUMN     "settlementNote" TEXT,
ADD COLUMN     "settlementPaymentMode" "PaymentMode",
ADD COLUMN     "settlementReferenceNo" TEXT,
ADD COLUMN     "settlementRequestedAt" TIMESTAMP(3),
ADD COLUMN     "settlementRequestedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_receiptAllocationId_key" ON "Claim"("receiptAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_creditNoteId_key" ON "Claim"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_settlementJournalEntryId_key" ON "Claim"("settlementJournalEntryId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_receiptAllocationId_fkey" FOREIGN KEY ("receiptAllocationId") REFERENCES "ReceiptAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "BillCreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_settlementFundingLedgerId_fkey" FOREIGN KEY ("settlementFundingLedgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_settlementJournalEntryId_fkey" FOREIGN KEY ("settlementJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_settlementApprovedById_fkey" FOREIGN KEY ("settlementApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_settlementRequestedById_fkey" FOREIGN KEY ("settlementRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

