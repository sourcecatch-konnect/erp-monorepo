-- Job Card Removed Parts (Workshop Inventory — Phase 3)

CREATE TYPE "RemovedPartCondition" AS ENUM ('REUSABLE', 'REPAIRABLE', 'SCRAP');

CREATE TABLE "JobCardRemovedPart" (
  "id" TEXT NOT NULL,
  "jobCardId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "relatedPartLineId" TEXT,
  "qty" INTEGER NOT NULL,
  "condition" "RemovedPartCondition" NOT NULL,
  "unitCostPaise" BIGINT,
  "newBatchId" TEXT,
  "journalEntryId" TEXT,
  "remarks" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JobCardRemovedPart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobCardRemovedPart_newBatchId_key" ON "JobCardRemovedPart"("newBatchId");
CREATE UNIQUE INDEX "JobCardRemovedPart_journalEntryId_key" ON "JobCardRemovedPart"("journalEntryId");
CREATE INDEX "JobCardRemovedPart_jobCardId_idx" ON "JobCardRemovedPart"("jobCardId");
CREATE INDEX "JobCardRemovedPart_sparePartId_idx" ON "JobCardRemovedPart"("sparePartId");

ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_relatedPartLineId_fkey" FOREIGN KEY ("relatedPartLineId") REFERENCES "JobCardPartLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_newBatchId_fkey" FOREIGN KEY ("newBatchId") REFERENCES "SpareBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCardRemovedPart" ADD CONSTRAINT "JobCardRemovedPart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SpareBatch.inwardLineId was NOT NULL (every batch used to come only from
-- an inward). A reusable-return now also creates a batch, with no inward
-- line behind it, so this FK column must become optional.
ALTER TABLE "SpareBatch" ALTER COLUMN "inwardLineId" DROP NOT NULL;
