-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('PARTY', 'GL');

-- CreateEnum
CREATE TYPE "LedgerAccountGroup" AS ENUM ('SUNDRY_DEBTOR', 'SUNDRY_CREDITOR', 'DIRECT_INCOME', 'INDIRECT_INCOME', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DUTIES_AND_TAXES', 'BANK', 'CASH', 'CURRENT_ASSET', 'CURRENT_LIABILITY');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('SALES', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "TallySyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('BILL', 'RECEIPT', 'VENDOR_PAYMENT', 'MANUAL', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "AllocationRefType" AS ENUM ('NEW_REF', 'AGAINST_REF');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "journalEntryId" TEXT;

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "group" "LedgerAccountGroup" NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "customerId" TEXT,
    "transportId" TEXT,
    "creditorId" TEXT,
    "labourId" TEXT,
    "pumpId" TEXT,
    "cashAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3) NOT NULL,
    "fyCode" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "narration" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" "JournalSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT,
    "reversesId" TEXT,
    "tallyMasterId" TEXT,
    "tallySyncStatus" "TallySyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "tallySyncedAt" TIMESTAMP(3),
    "tallySyncError" TEXT,
    "tallySyncAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "debitPaise" BIGINT NOT NULL DEFAULT 0,
    "creditPaise" BIGINT NOT NULL DEFAULT 0,
    "narration" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAllocation" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "journalLineId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "refType" "AllocationRefType" NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_code_key" ON "Ledger"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_customerId_key" ON "Ledger"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_transportId_key" ON "Ledger"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_creditorId_key" ON "Ledger"("creditorId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_labourId_key" ON "Ledger"("labourId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_pumpId_key" ON "Ledger"("pumpId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_cashAccountId_key" ON "Ledger"("cashAccountId");

-- CreateIndex
CREATE INDEX "Ledger_kind_name_idx" ON "Ledger"("kind", "name");

-- CreateIndex
CREATE INDEX "Ledger_group_idx" ON "Ledger"("group");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversesId_key" ON "JournalEntry"("reversesId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_voucherType_sourceType_sourceId_key" ON "JournalEntry"("voucherType", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_voucherType_voucherNumber_key" ON "JournalEntry"("voucherType", "voucherNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_branchId_voucherDate_idx" ON "JournalEntry"("branchId", "voucherDate");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");

-- CreateIndex
CREATE INDEX "JournalEntry_tallySyncStatus_idx" ON "JournalEntry"("tallySyncStatus");

-- CreateIndex
CREATE INDEX "JournalEntry_voucherType_fyCode_idx" ON "JournalEntry"("voucherType", "fyCode");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_journalEntryId_lineNumber_key" ON "JournalLine"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE INDEX "JournalLine_ledgerId_idx" ON "JournalLine"("ledgerId");

-- CreateIndex
CREATE INDEX "LedgerAllocation_billId_idx" ON "LedgerAllocation"("billId");

-- CreateIndex
CREATE INDEX "LedgerAllocation_journalEntryId_idx" ON "LedgerAllocation"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_journalEntryId_key" ON "Bill"("journalEntryId");

-- CheckConstraint: a journal line is exactly one-sided, never negative
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_sided_chk"
    CHECK ("debitPaise" >= 0 AND "creditPaise" >= 0 AND ("debitPaise" = 0) <> ("creditPaise" = 0));

-- CheckConstraint: an allocation always moves a positive amount
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_amount_positive_chk"
    CHECK ("amountPaise" > 0);

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
