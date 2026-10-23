-- Inward Stock (Workshop Inventory — Phase 1, part 2)

ALTER TYPE "JournalSourceType" ADD VALUE 'PURCHASE_INWARD';

CREATE TYPE "SpareInwardStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
CREATE TYPE "StockMovementType" AS ENUM ('INWARD', 'ISSUE', 'RETURN', 'ADJUSTMENT');

CREATE TABLE "SpareInward" (
  "id" TEXT NOT NULL,
  "inwardNumber" TEXT,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "poId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "SpareInwardStatus" NOT NULL DEFAULT 'DRAFT',
  "inwardDate" TIMESTAMP(3) NOT NULL,
  "supplierInvoiceNo" TEXT NOT NULL,
  "supplierInvoiceDate" TIMESTAMP(3),
  "grossAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "discountPaise" BIGINT NOT NULL DEFAULT 0,
  "payableAmountPaise" BIGINT NOT NULL DEFAULT 0,
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

  CONSTRAINT "SpareInward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpareInward_inwardNumber_key" ON "SpareInward"("inwardNumber");
CREATE UNIQUE INDEX "SpareInward_journalEntryId_key" ON "SpareInward"("journalEntryId");
CREATE INDEX "SpareInward_branchId_status_idx" ON "SpareInward"("branchId", "status");
CREATE INDEX "SpareInward_poId_idx" ON "SpareInward"("poId");
CREATE INDEX "SpareInward_supplierId_idx" ON "SpareInward"("supplierId");
CREATE INDEX "SpareInward_fyCode_idx" ON "SpareInward"("fyCode");

ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpareInward" ADD CONSTRAINT "SpareInward_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PurchaseOrderInwardLine" (
  "id" TEXT NOT NULL,
  "inwardId" TEXT NOT NULL,
  "poLineId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "qtyReceived" INTEGER NOT NULL,
  "qtyRejected" INTEGER NOT NULL DEFAULT 0,
  "ratePaise" BIGINT NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "batchNo" TEXT,
  "warrantyExpiry" TIMESTAMP(3),
  "guaranteeExpiry" TIMESTAMP(3),

  CONSTRAINT "PurchaseOrderInwardLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderInwardLine_inwardId_idx" ON "PurchaseOrderInwardLine"("inwardId");
CREATE INDEX "PurchaseOrderInwardLine_poLineId_idx" ON "PurchaseOrderInwardLine"("poLineId");
CREATE INDEX "PurchaseOrderInwardLine_sparePartId_idx" ON "PurchaseOrderInwardLine"("sparePartId");

ALTER TABLE "PurchaseOrderInwardLine" ADD CONSTRAINT "PurchaseOrderInwardLine_inwardId_fkey" FOREIGN KEY ("inwardId") REFERENCES "SpareInward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderInwardLine" ADD CONSTRAINT "PurchaseOrderInwardLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderInwardLine" ADD CONSTRAINT "PurchaseOrderInwardLine_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SpareBatch" (
  "id" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "inwardLineId" TEXT NOT NULL,
  "batchNo" TEXT,
  "qtyReceived" INTEGER NOT NULL,
  "qtyRemaining" INTEGER NOT NULL,
  "unitCostPaise" BIGINT NOT NULL,
  "warrantyExpiry" TIMESTAMP(3),
  "guaranteeExpiry" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SpareBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpareBatch_inwardLineId_key" ON "SpareBatch"("inwardLineId");
CREATE INDEX "SpareBatch_sparePartId_branchId_idx" ON "SpareBatch"("sparePartId", "branchId");
CREATE INDEX "SpareBatch_qtyRemaining_idx" ON "SpareBatch"("qtyRemaining");

ALTER TABLE "SpareBatch" ADD CONSTRAINT "SpareBatch_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareBatch" ADD CONSTRAINT "SpareBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareBatch" ADD CONSTRAINT "SpareBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpareBatch" ADD CONSTRAINT "SpareBatch_inwardLineId_fkey" FOREIGN KEY ("inwardLineId") REFERENCES "PurchaseOrderInwardLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockLedger" (
  "id" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "currentQty" INTEGER NOT NULL DEFAULT 0,
  "movingAvgCostPaise" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockLedger_sparePartId_branchId_key" ON "StockLedger"("sparePartId", "branchId");

ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "movementType" "StockMovementType" NOT NULL,
  "qtyDelta" INTEGER NOT NULL,
  "unitCostPaise" BIGINT NOT NULL,
  "balanceQtyAfter" INTEGER NOT NULL,
  "refType" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_sparePartId_branchId_createdAt_idx" ON "StockMovement"("sparePartId", "branchId", "createdAt");
CREATE INDEX "StockMovement_refType_refId_idx" ON "StockMovement"("refType", "refId");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
