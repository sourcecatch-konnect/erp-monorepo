-- Supplier Replacement (Workshop Inventory — final piece)

ALTER TYPE "JournalSourceType" ADD VALUE 'SUPPLIER_REPLACEMENT';

CREATE TYPE "ReplacementListStatus" AS ENUM ('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "ReplacementType" AS ENUM ('FREE', 'PAYABLE');

CREATE TABLE "ReplacementList" (
  "id" TEXT NOT NULL,
  "replacementNumber" TEXT,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "originalInwardId" TEXT NOT NULL,
  "status" "ReplacementListStatus" NOT NULL DEFAULT 'PENDING',
  "requestDate" TIMESTAMP(3) NOT NULL,
  "remarks" TEXT,
  "createdById" TEXT NOT NULL,
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReplacementList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReplacementList_replacementNumber_key" ON "ReplacementList"("replacementNumber");
CREATE INDEX "ReplacementList_branchId_status_idx" ON "ReplacementList"("branchId", "status");
CREATE INDEX "ReplacementList_supplierId_status_idx" ON "ReplacementList"("supplierId", "status");
CREATE INDEX "ReplacementList_fyCode_idx" ON "ReplacementList"("fyCode");

ALTER TABLE "ReplacementList" ADD CONSTRAINT "ReplacementList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementList" ADD CONSTRAINT "ReplacementList_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementList" ADD CONSTRAINT "ReplacementList_originalInwardId_fkey" FOREIGN KEY ("originalInwardId") REFERENCES "SpareInward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementList" ADD CONSTRAINT "ReplacementList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementList" ADD CONSTRAINT "ReplacementList_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReplacementListLine" (
  "id" TEXT NOT NULL,
  "replacementListId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "originalInwardLineId" TEXT NOT NULL,
  "originalBatchId" TEXT NOT NULL,
  "qtyRequested" INTEGER NOT NULL,
  "qtyReceived" INTEGER NOT NULL DEFAULT 0,
  "replacementType" "ReplacementType" NOT NULL,
  "remarks" TEXT,

  CONSTRAINT "ReplacementListLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplacementListLine_replacementListId_idx" ON "ReplacementListLine"("replacementListId");
CREATE INDEX "ReplacementListLine_originalInwardLineId_idx" ON "ReplacementListLine"("originalInwardLineId");
CREATE INDEX "ReplacementListLine_originalBatchId_idx" ON "ReplacementListLine"("originalBatchId");

ALTER TABLE "ReplacementListLine" ADD CONSTRAINT "ReplacementListLine_replacementListId_fkey" FOREIGN KEY ("replacementListId") REFERENCES "ReplacementList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplacementListLine" ADD CONSTRAINT "ReplacementListLine_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementListLine" ADD CONSTRAINT "ReplacementListLine_originalInwardLineId_fkey" FOREIGN KEY ("originalInwardLineId") REFERENCES "PurchaseOrderInwardLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementListLine" ADD CONSTRAINT "ReplacementListLine_originalBatchId_fkey" FOREIGN KEY ("originalBatchId") REFERENCES "SpareBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReplacementInward" (
  "id" TEXT NOT NULL,
  "replacementInwardNumber" TEXT,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "replacementListId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "SpareInwardStatus" NOT NULL DEFAULT 'POSTED',
  "inwardDate" TIMESTAMP(3) NOT NULL,
  "supplierChallanNo" TEXT,
  "supplierChallanDate" TIMESTAMP(3),
  "differentialAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "journalEntryId" TEXT,
  "createdById" TEXT NOT NULL,
  "postedById" TEXT,
  "postedAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReplacementInward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReplacementInward_replacementInwardNumber_key" ON "ReplacementInward"("replacementInwardNumber");
CREATE UNIQUE INDEX "ReplacementInward_journalEntryId_key" ON "ReplacementInward"("journalEntryId");
CREATE INDEX "ReplacementInward_branchId_status_idx" ON "ReplacementInward"("branchId", "status");
CREATE INDEX "ReplacementInward_replacementListId_idx" ON "ReplacementInward"("replacementListId");
CREATE INDEX "ReplacementInward_fyCode_idx" ON "ReplacementInward"("fyCode");

ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_replacementListId_fkey" FOREIGN KEY ("replacementListId") REFERENCES "ReplacementList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplacementInward" ADD CONSTRAINT "ReplacementInward_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReplacementInwardLine" (
  "id" TEXT NOT NULL,
  "replacementInwardId" TEXT NOT NULL,
  "replacementListLineId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "qtyReceived" INTEGER NOT NULL,
  "differentialRatePaise" BIGINT NOT NULL DEFAULT 0,
  "differentialAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "batchNo" TEXT,
  "warrantyExpiry" TIMESTAMP(3),
  "guaranteeExpiry" TIMESTAMP(3),
  "newBatchId" TEXT,

  CONSTRAINT "ReplacementInwardLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReplacementInwardLine_newBatchId_key" ON "ReplacementInwardLine"("newBatchId");
CREATE INDEX "ReplacementInwardLine_replacementInwardId_idx" ON "ReplacementInwardLine"("replacementInwardId");
CREATE INDEX "ReplacementInwardLine_replacementListLineId_idx" ON "ReplacementInwardLine"("replacementListLineId");

ALTER TABLE "ReplacementInwardLine" ADD CONSTRAINT "ReplacementInwardLine_replacementInwardId_fkey" FOREIGN KEY ("replacementInwardId") REFERENCES "ReplacementInward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplacementInwardLine" ADD CONSTRAINT "ReplacementInwardLine_replacementListLineId_fkey" FOREIGN KEY ("replacementListLineId") REFERENCES "ReplacementListLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInwardLine" ADD CONSTRAINT "ReplacementInwardLine_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplacementInwardLine" ADD CONSTRAINT "ReplacementInwardLine_newBatchId_fkey" FOREIGN KEY ("newBatchId") REFERENCES "SpareBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
