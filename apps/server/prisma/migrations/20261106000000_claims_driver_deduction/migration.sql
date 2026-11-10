-- Claims C6: driver recoveries deducted through the salary run (docs/CLAIMS_JIRA.md).

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'CLAIM_DEDUCTION';

-- AlterTable
ALTER TABLE "DriverSalary" ADD COLUMN     "damageRecoveryPaise" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ClaimRecovery" ADD COLUMN     "deferredFromRunId" TEXT,
ADD COLUMN     "driverSalaryId" TEXT;

-- CreateIndex
CREATE INDEX "ClaimRecovery_driverSalaryId_idx" ON "ClaimRecovery"("driverSalaryId");

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_driverSalaryId_fkey" FOREIGN KEY ("driverSalaryId") REFERENCES "DriverSalary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_deferredFromRunId_fkey" FOREIGN KEY ("deferredFromRunId") REFERENCES "DriverSalaryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

