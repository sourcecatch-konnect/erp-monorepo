-- Claims C5: recovery lines — numbering, receipt details, recovery voucher source (docs/CLAIMS_JIRA.md).
-- ClaimRecovery has had no writer before C5, so adding the NOT NULL lineNo is safe.

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'CLAIM_RECOVERY';

-- DropIndex
DROP INDEX "ClaimRecovery_claimId_idx";

-- AlterTable
ALTER TABLE "ClaimRecovery" ADD COLUMN     "lineNo" INTEGER NOT NULL,
ADD COLUMN     "receiptMode" "PaymentMode",
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedIntoLedgerId" TEXT,
ADD COLUMN     "rejectedReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRecovery_claimId_lineNo_key" ON "ClaimRecovery"("claimId", "lineNo");

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_receivedIntoLedgerId_fkey" FOREIGN KEY ("receivedIntoLedgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

