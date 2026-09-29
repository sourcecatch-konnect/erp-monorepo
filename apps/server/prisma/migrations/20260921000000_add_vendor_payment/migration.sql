-- CreateEnum
CREATE TYPE "VendorPaymentType" AS ENUM ('TRANSPORTER', 'HAMALI', 'LDC_BROKER', 'JOBCARD');

-- CreateEnum
CREATE TYPE "VendorPaymentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorPaymentSourceType" AS ENUM ('LR', 'GRN_HAMALI', 'RAIL_BRANCH_GRN', 'VP_LOADING');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'VENDOR_PAYMENT_ACCRUAL';

-- AlterTable: LedgerAllocation now references either a Bill or a
-- VendorPaymentSlip (never both, never neither — see the CHECK below).
ALTER TABLE "LedgerAllocation" ALTER COLUMN "billId" DROP NOT NULL;
ALTER TABLE "LedgerAllocation" ADD COLUMN "vendorPaymentSlipId" TEXT;

-- CreateTable
CREATE TABLE "VendorPaymentSlip" (
    "id" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "type" "VendorPaymentType" NOT NULL,
    "branchId" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "transportId" TEXT,
    "labourId" TEXT,
    "grossPayablePaise" BIGINT NOT NULL DEFAULT 0,
    "totalDeductionsPaise" BIGINT NOT NULL DEFAULT 0,
    "netPayablePaise" BIGINT NOT NULL DEFAULT 0,
    "paidPaise" BIGINT NOT NULL DEFAULT 0,
    "status" "VendorPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "accrualJournalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentSlipLine" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "sourceType" "VendorPaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "freightPaise" BIGINT NOT NULL DEFAULT 0,
    "detentionPaise" BIGINT NOT NULL DEFAULT 0,
    "advancePaise" BIGINT NOT NULL DEFAULT 0,
    "commissionPaise" BIGINT NOT NULL DEFAULT 0,
    "hamaliPaise" BIGINT NOT NULL DEFAULT 0,
    "tdsPaise" BIGINT NOT NULL DEFAULT 0,
    "damagePaise" BIGINT NOT NULL DEFAULT 0,
    "stationeryPaise" BIGINT NOT NULL DEFAULT 0,
    "netPaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPaymentSlipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentDisbursement" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "paidPaise" BIGINT NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "referenceNo" TEXT,
    "fundingLedgerId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "settlementJournalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPaymentDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentSlip_slipNumber_key" ON "VendorPaymentSlip"("slipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentSlip_accrualJournalEntryId_key" ON "VendorPaymentSlip"("accrualJournalEntryId");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_branchId_status_idx" ON "VendorPaymentSlip"("branchId", "status");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_type_status_idx" ON "VendorPaymentSlip"("type", "status");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_transportId_idx" ON "VendorPaymentSlip"("transportId");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_labourId_idx" ON "VendorPaymentSlip"("labourId");

-- CreateIndex
CREATE INDEX "VendorPaymentSlipLine_slipId_idx" ON "VendorPaymentSlipLine"("slipId");

-- CreateIndex
CREATE INDEX "VendorPaymentSlipLine_sourceType_sourceId_idx" ON "VendorPaymentSlipLine"("sourceType", "sourceId");

-- A source document (an LR's freight/detention, a GRN's hamali, ...) may have
-- at most one ACTIVE claim at a time. This is what turns two concurrent slip
-- creations against the same source into one success and one clear conflict,
-- instead of a silent double-claim.
CREATE UNIQUE INDEX "VendorPaymentSlipLine_active_source_key"
ON "VendorPaymentSlipLine" ("sourceType", "sourceId")
WHERE "isActive";

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentDisbursement_clientRequestId_key" ON "VendorPaymentDisbursement"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentDisbursement_settlementJournalEntryId_key" ON "VendorPaymentDisbursement"("settlementJournalEntryId");

-- CreateIndex
CREATE INDEX "VendorPaymentDisbursement_slipId_idx" ON "VendorPaymentDisbursement"("slipId");

-- CreateIndex
CREATE INDEX "LedgerAllocation_vendorPaymentSlipId_idx" ON "LedgerAllocation"("vendorPaymentSlipId");

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_accrualJournalEntryId_fkey" FOREIGN KEY ("accrualJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentSlipLine" ADD CONSTRAINT "VendorPaymentSlipLine_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "VendorPaymentSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "VendorPaymentSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_fundingLedgerId_fkey" FOREIGN KEY ("fundingLedgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_settlementJournalEntryId_fkey" FOREIGN KEY ("settlementJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_vendorPaymentSlipId_fkey" FOREIGN KEY ("vendorPaymentSlipId") REFERENCES "VendorPaymentSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: exactly one payee reference per slip. Both current types
-- (TRANSPORTER, HAMALI) are single-payee — TRANSPORTER -> transportId,
-- HAMALI -> labourId. LDC_BROKER/JOBCARD will need their own payee columns
-- (and this constraint revisited) when they're added in a later phase.
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_one_payee_chk"
    CHECK (("transportId" IS NOT NULL) <> ("labourId" IS NOT NULL));

-- CheckConstraint: an allocation belongs to exactly one reference — a Bill
-- (debtor side) or a VendorPaymentSlip (creditor side) — never both, never
-- neither.
ALTER TABLE "LedgerAllocation" ADD CONSTRAINT "LedgerAllocation_one_ref_chk"
    CHECK (("billId" IS NOT NULL) <> ("vendorPaymentSlipId" IS NOT NULL));
