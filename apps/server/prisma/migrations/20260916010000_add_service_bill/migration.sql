-- Service Bill (Workshop Inventory — Phase 5, service side)

ALTER TYPE "JournalSourceType" ADD VALUE 'SERVICE_BILL';

CREATE TYPE "ServiceBillStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "ServiceBill" (
  "id" TEXT NOT NULL,
  "serviceBillNumber" TEXT,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "serviceProviderId" TEXT NOT NULL,
  "status" "ServiceBillStatus" NOT NULL DEFAULT 'DRAFT',
  "billDate" TIMESTAMP(3) NOT NULL,
  "providerInvoiceNo" TEXT NOT NULL,
  "providerInvoiceDate" TIMESTAMP(3),
  "grossAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "discountPaise" BIGINT NOT NULL DEFAULT 0,
  "netAmountPaise" BIGINT NOT NULL DEFAULT 0,
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

  CONSTRAINT "ServiceBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceBill_serviceBillNumber_key" ON "ServiceBill"("serviceBillNumber");
CREATE UNIQUE INDEX "ServiceBill_journalEntryId_key" ON "ServiceBill"("journalEntryId");
CREATE INDEX "ServiceBill_branchId_status_idx" ON "ServiceBill"("branchId", "status");
CREATE INDEX "ServiceBill_serviceProviderId_status_idx" ON "ServiceBill"("serviceProviderId", "status");
CREATE INDEX "ServiceBill_fyCode_idx" ON "ServiceBill"("fyCode");

ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceBill" ADD CONSTRAINT "ServiceBill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ServiceBillLine" (
  "id" TEXT NOT NULL,
  "serviceBillId" TEXT NOT NULL,
  "jobCardServiceLineId" TEXT NOT NULL,
  "amountPaise" BIGINT NOT NULL,

  CONSTRAINT "ServiceBillLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceBillLine_jobCardServiceLineId_key" ON "ServiceBillLine"("jobCardServiceLineId");
CREATE INDEX "ServiceBillLine_serviceBillId_idx" ON "ServiceBillLine"("serviceBillId");

ALTER TABLE "ServiceBillLine" ADD CONSTRAINT "ServiceBillLine_serviceBillId_fkey" FOREIGN KEY ("serviceBillId") REFERENCES "ServiceBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceBillLine" ADD CONSTRAINT "ServiceBillLine_jobCardServiceLineId_fkey" FOREIGN KEY ("jobCardServiceLineId") REFERENCES "JobCardServiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
