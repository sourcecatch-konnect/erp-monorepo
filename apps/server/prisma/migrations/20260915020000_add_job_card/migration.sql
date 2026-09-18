-- Job Card (Workshop Inventory — Phase 2)

ALTER TYPE "JournalSourceType" ADD VALUE 'JOB_CARD';

CREATE TYPE "JobCardStatus" AS ENUM ('DRAFT', 'FINALISED', 'CANCELLED');
CREATE TYPE "TruckLocationStatus" AS ENUM ('AT_HO', 'IN_TRANSIT');

CREATE TABLE "JobCard" (
  "id" TEXT NOT NULL,
  "jobCardNumber" TEXT,
  "fyCode" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "truckStatus" "TruckLocationStatus" NOT NULL,
  "inDateTime" TIMESTAMP(3) NOT NULL,
  "outDateTime" TIMESTAMP(3),
  "openingKm" INTEGER NOT NULL,
  "closingKm" INTEGER,
  "status" "JobCardStatus" NOT NULL DEFAULT 'DRAFT',
  "remarks" TEXT,
  "totalPartsAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "totalServiceAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "totalAmountPaise" BIGINT NOT NULL DEFAULT 0,
  "journalEntryId" TEXT,
  "createdById" TEXT NOT NULL,
  "finalisedById" TEXT,
  "finalisedAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobCard_jobCardNumber_key" ON "JobCard"("jobCardNumber");
CREATE UNIQUE INDEX "JobCard_journalEntryId_key" ON "JobCard"("journalEntryId");
CREATE INDEX "JobCard_branchId_status_idx" ON "JobCard"("branchId", "status");
CREATE INDEX "JobCard_vehicleId_idx" ON "JobCard"("vehicleId");
CREATE INDEX "JobCard_fyCode_idx" ON "JobCard"("fyCode");

ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "JobCardPartLine" (
  "id" TEXT NOT NULL,
  "jobCardId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "mechanicId" TEXT,
  "qty" INTEGER NOT NULL,
  "unitCostPaise" BIGINT NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "description" TEXT,

  CONSTRAINT "JobCardPartLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobCardPartLine_jobCardId_idx" ON "JobCardPartLine"("jobCardId");
CREATE INDEX "JobCardPartLine_sparePartId_idx" ON "JobCardPartLine"("sparePartId");
CREATE INDEX "JobCardPartLine_batchId_idx" ON "JobCardPartLine"("batchId");

ALTER TABLE "JobCardPartLine" ADD CONSTRAINT "JobCardPartLine_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCardPartLine" ADD CONSTRAINT "JobCardPartLine_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCardPartLine" ADD CONSTRAINT "JobCardPartLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SpareBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCardPartLine" ADD CONSTRAINT "JobCardPartLine_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "JobCardServiceLine" (
  "id" TEXT NOT NULL,
  "jobCardId" TEXT NOT NULL,
  "serviceProviderId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "mechanicId" TEXT,
  "qty" INTEGER NOT NULL,
  "ratePaise" BIGINT NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "description" TEXT,
  "billedInServiceBillId" TEXT,

  CONSTRAINT "JobCardServiceLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobCardServiceLine_jobCardId_idx" ON "JobCardServiceLine"("jobCardId");
CREATE INDEX "JobCardServiceLine_serviceProviderId_idx" ON "JobCardServiceLine"("serviceProviderId");
CREATE INDEX "JobCardServiceLine_billedInServiceBillId_idx" ON "JobCardServiceLine"("billedInServiceBillId");

ALTER TABLE "JobCardServiceLine" ADD CONSTRAINT "JobCardServiceLine_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCardServiceLine" ADD CONSTRAINT "JobCardServiceLine_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCardServiceLine" ADD CONSTRAINT "JobCardServiceLine_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCardServiceLine" ADD CONSTRAINT "JobCardServiceLine_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
