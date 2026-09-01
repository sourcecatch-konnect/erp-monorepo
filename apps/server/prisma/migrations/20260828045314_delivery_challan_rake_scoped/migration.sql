-- DeliveryChallan is no longer scoped to a single Branch GRN (one wagon) — it
-- now aggregates goods lines across any of a rake's SUBMITTED Branch GRNs, so
-- a split LR can be reassembled onto one vehicle. Scope the challan by rake
-- instead, backfilling railRakeId from the existing branchGrnId (both FKs
-- are NOT NULL today, so every row resolves unambiguously).
ALTER TABLE "DeliveryChallan" ADD COLUMN "railRakeId" TEXT;

UPDATE "DeliveryChallan" AS dc
SET "railRakeId" = grn."railRakeId"
FROM "RailBranchGRN" AS grn
WHERE dc."branchGrnId" = grn."id";

ALTER TABLE "DeliveryChallan" ALTER COLUMN "railRakeId" SET NOT NULL;

-- DropIndex
DROP INDEX "DeliveryChallan_branchGrnId_status_idx";

-- DropForeignKey
ALTER TABLE "DeliveryChallan" DROP CONSTRAINT "DeliveryChallan_branchGrnId_fkey";

-- AlterTable
ALTER TABLE "DeliveryChallan" DROP COLUMN "branchGrnId";

-- CreateIndex
CREATE INDEX "DeliveryChallan_railRakeId_status_idx" ON "DeliveryChallan"("railRakeId", "status");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_railRakeId_fkey" FOREIGN KEY ("railRakeId") REFERENCES "RailRake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
