-- Claims / Damage Settlement, C1 foundation (docs/CLAIMS_JIRA.md). New tables only.

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('DAMAGE', 'SHORTAGE', 'LOSS');

-- CreateEnum
CREATE TYPE "ClaimOrigin" AS ENUM ('LR_ACK', 'GRN', 'RAIL_BRANCH_GRN', 'MANUAL');

-- CreateEnum
CREATE TYPE "ClaimCause" AS ENUM ('TRANSPORTER', 'LABOUR', 'RAILWAY', 'CUSTOMER', 'DRIVER', 'INSURED_EVENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'ACTIVE', 'SETTLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimRecoverySource" AS ENUM ('INSURANCE', 'TRANSPORTER', 'DRIVER', 'LABOUR', 'RAILWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimRecoveryStatus" AS ENUM ('FILED', 'APPROVED', 'RECEIVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "origin" "ClaimOrigin" NOT NULL,
    "originRefId" TEXT,
    "causedBy" "ClaimCause",
    "damagedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "shortageQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "goodsValuePaise" BIGINT,
    "claimedAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "settledAmountPaise" BIGINT,
    "basisDescription" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "lrGoodsId" TEXT,
    "goodsName" TEXT NOT NULL,
    "damagedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "shortageQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "valuePaise" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimRecovery" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "source" "ClaimRecoverySource" NOT NULL,
    "transportId" TEXT,
    "driverId" TEXT,
    "labourId" TEXT,
    "partyName" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "status" "ClaimRecoveryStatus" NOT NULL DEFAULT 'FILED',
    "referenceNo" TEXT,
    "remarks" TEXT,
    "journalEntryId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" "ClaimStatus",
    "toStatus" "ClaimStatus",
    "note" TEXT,
    "payload" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");

-- CreateIndex
CREATE INDEX "Claim_branchId_status_idx" ON "Claim"("branchId", "status");

-- CreateIndex
CREATE INDEX "Claim_lrId_idx" ON "Claim"("lrId");

-- CreateIndex
CREATE INDEX "Claim_customerId_idx" ON "Claim"("customerId");

-- CreateIndex
CREATE INDEX "Claim_status_claimDate_idx" ON "Claim"("status", "claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_origin_originRefId_lrId_key" ON "Claim"("origin", "originRefId", "lrId");

-- CreateIndex
CREATE INDEX "ClaimItem_claimId_idx" ON "ClaimItem"("claimId");

-- CreateIndex
CREATE INDEX "ClaimItem_lrGoodsId_idx" ON "ClaimItem"("lrGoodsId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRecovery_journalEntryId_key" ON "ClaimRecovery"("journalEntryId");

-- CreateIndex
CREATE INDEX "ClaimRecovery_claimId_idx" ON "ClaimRecovery"("claimId");

-- CreateIndex
CREATE INDEX "ClaimRecovery_status_idx" ON "ClaimRecovery"("status");

-- CreateIndex
CREATE INDEX "ClaimRecovery_transportId_idx" ON "ClaimRecovery"("transportId");

-- CreateIndex
CREATE INDEX "ClaimRecovery_driverId_idx" ON "ClaimRecovery"("driverId");

-- CreateIndex
CREATE INDEX "ClaimEvent_claimId_createdAt_idx" ON "ClaimEvent"("claimId", "createdAt");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_lrId_fkey" FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimItem" ADD CONSTRAINT "ClaimItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimItem" ADD CONSTRAINT "ClaimItem_lrGoodsId_fkey" FOREIGN KEY ("lrGoodsId") REFERENCES "LRGoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRecovery" ADD CONSTRAINT "ClaimRecovery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

