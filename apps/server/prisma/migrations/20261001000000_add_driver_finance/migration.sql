-- CreateEnum
CREATE TYPE "DriverSalaryRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriverFinanceEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DriverPayoutSource" AS ENUM ('SALARY_RUN', 'LOG_SLIP', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalSourceType" ADD VALUE 'DRIVER_SALARY';
ALTER TYPE "JournalSourceType" ADD VALUE 'DRIVER_SALARY_ADVANCE';
ALTER TYPE "JournalSourceType" ADD VALUE 'DRIVER_PAYOUT';

-- CreateTable
CREATE TABLE "DriverSalaryRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "daysInMonth" INTEGER NOT NULL,
    "branchId" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "status" "DriverSalaryRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEarnedPaise" BIGINT NOT NULL DEFAULT 0,
    "totalNetPaise" BIGINT NOT NULL DEFAULT 0,
    "paidPaise" BIGINT NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSalaryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverSalary" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseSalaryPaise" BIGINT NOT NULL,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "presentDays" INTEGER NOT NULL,
    "earnedPaise" BIGINT NOT NULL,
    "salaryAdvancePaise" BIGINT NOT NULL DEFAULT 0,
    "logSlipBalancePaise" BIGINT NOT NULL DEFAULT 0,
    "previousBalancePaise" BIGINT NOT NULL DEFAULT 0,
    "netPaise" BIGINT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverSalaryAdvance" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "referenceNo" TEXT,
    "reason" TEXT,
    "fundingLedgerId" TEXT NOT NULL,
    "status" "DriverFinanceEntryStatus" NOT NULL DEFAULT 'POSTED',
    "clientRequestId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayout" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "source" "DriverPayoutSource" NOT NULL,
    "salaryRunId" TEXT,
    "logSlipId" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "referenceNo" TEXT,
    "fundingLedgerId" TEXT NOT NULL,
    "status" "DriverFinanceEntryStatus" NOT NULL DEFAULT 'POSTED',
    "clientRequestId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverSalaryRun_runNumber_key" ON "DriverSalaryRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSalaryRun_journalEntryId_key" ON "DriverSalaryRun"("journalEntryId");

-- CreateIndex
CREATE INDEX "DriverSalaryRun_month_idx" ON "DriverSalaryRun"("month");

-- CreateIndex
CREATE INDEX "DriverSalaryRun_branchId_status_idx" ON "DriverSalaryRun"("branchId", "status");

-- CreateIndex
CREATE INDEX "DriverSalary_runId_idx" ON "DriverSalary"("runId");

-- CreateIndex
CREATE INDEX "DriverSalary_driverId_idx" ON "DriverSalary"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSalaryAdvance_advanceNumber_key" ON "DriverSalaryAdvance"("advanceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSalaryAdvance_clientRequestId_key" ON "DriverSalaryAdvance"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSalaryAdvance_journalEntryId_key" ON "DriverSalaryAdvance"("journalEntryId");

-- CreateIndex
CREATE INDEX "DriverSalaryAdvance_driverId_paidAt_idx" ON "DriverSalaryAdvance"("driverId", "paidAt");

-- CreateIndex
CREATE INDEX "DriverSalaryAdvance_status_idx" ON "DriverSalaryAdvance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayout_payoutNumber_key" ON "DriverPayout"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayout_clientRequestId_key" ON "DriverPayout"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayout_journalEntryId_key" ON "DriverPayout"("journalEntryId");

-- CreateIndex
CREATE INDEX "DriverPayout_driverId_paidAt_idx" ON "DriverPayout"("driverId", "paidAt");

-- CreateIndex
CREATE INDEX "DriverPayout_salaryRunId_idx" ON "DriverPayout"("salaryRunId");

-- CreateIndex
CREATE INDEX "DriverPayout_logSlipId_idx" ON "DriverPayout"("logSlipId");

-- CreateIndex
CREATE INDEX "DriverPayout_status_idx" ON "DriverPayout"("status");

-- AddForeignKey
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalary" ADD CONSTRAINT "DriverSalary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DriverSalaryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalary" ADD CONSTRAINT "DriverSalary_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_fundingLedgerId_fkey" FOREIGN KEY ("fundingLedgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_salaryRunId_fkey" FOREIGN KEY ("salaryRunId") REFERENCES "DriverSalaryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_logSlipId_fkey" FOREIGN KEY ("logSlipId") REFERENCES "LogSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_fundingLedgerId_fkey" FOREIGN KEY ("fundingLedgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-authored below (Prisma has no syntax for these).

-- A driver can be in at most one ACTIVE salary run per month. Cancelling a
-- run flips its lines to isActive = false, which frees the driver for a new
-- run of the same month.
CREATE UNIQUE INDEX "DriverSalary_active_driver_month_key"
ON "DriverSalary" ("driverId", "month")
WHERE "isActive";

-- Month is always "YYYY-MM", and days-in-month a real calendar month length.
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_month_chk"
    CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "DriverSalaryRun" ADD CONSTRAINT "DriverSalaryRun_days_chk"
    CHECK ("daysInMonth" BETWEEN 28 AND 31);
ALTER TABLE "DriverSalary" ADD CONSTRAINT "DriverSalary_month_chk"
    CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Day counts can't be negative; earned/base can't be negative. netPaise and
-- the balance snapshots are signed on purpose (negative net carries forward).
ALTER TABLE "DriverSalary" ADD CONSTRAINT "DriverSalary_amounts_chk"
    CHECK ("absentDays" >= 0 AND "presentDays" >= 0
       AND "baseSalaryPaise" >= 0 AND "earnedPaise" >= 0
       AND "salaryAdvancePaise" >= 0);

-- Money actually handed over is always a positive amount.
ALTER TABLE "DriverSalaryAdvance" ADD CONSTRAINT "DriverSalaryAdvance_amount_chk"
    CHECK ("amountPaise" > 0);
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_amount_chk"
    CHECK ("amountPaise" > 0);

-- A payout points at exactly the source its type says: a salary run, a log
-- slip, or nothing (manual settlement).
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_source_chk"
    CHECK (
      ("source" = 'SALARY_RUN' AND "salaryRunId" IS NOT NULL AND "logSlipId" IS NULL)
   OR ("source" = 'LOG_SLIP'   AND "logSlipId" IS NOT NULL AND "salaryRunId" IS NULL)
   OR ("source" = 'MANUAL'     AND "salaryRunId" IS NULL AND "logSlipId" IS NULL)
    );
