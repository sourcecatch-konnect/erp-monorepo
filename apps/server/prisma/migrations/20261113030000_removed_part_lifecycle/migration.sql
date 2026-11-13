BEGIN;
CREATE TYPE "RemovedPartLifecycleStatus" AS ENUM ('HELD', 'IN_REPAIR', 'PENDING_APPROVAL', 'STOCKED', 'SCRAP_HELD', 'DISPOSAL_PENDING', 'DISPOSED');
ALTER TABLE "JobCardRemovedPart"
  ADD COLUMN "lifecycleStatus" "RemovedPartLifecycleStatus" NOT NULL DEFAULT 'HELD',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "custodyLocation" TEXT, ADD COLUMN "provenanceReference" TEXT,
  ADD COLUMN "valuationSubmittedById" TEXT, ADD COLUMN "approvedById" TEXT, ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "repairReference" TEXT, ADD COLUMN "repairReceivedAt" TIMESTAMP(3);
UPDATE "JobCardRemovedPart" SET "lifecycleStatus" = CASE
  WHEN "newBatchId" IS NOT NULL OR "journalEntryId" IS NOT NULL THEN 'STOCKED'::"RemovedPartLifecycleStatus"
  WHEN "condition" = 'REUSABLE' THEN 'PENDING_APPROVAL'::"RemovedPartLifecycleStatus"
  ELSE 'HELD'::"RemovedPartLifecycleStatus" END,
  "valuationSubmittedById" = CASE WHEN "condition" = 'REUSABLE' THEN "createdById" END;
CREATE TABLE "JobCardRemovedPartEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "removedPartId" TEXT NOT NULL,
  "clientRequestId" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL,
  "action" TEXT NOT NULL, "fromStatus" TEXT, "toStatus" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "reason" TEXT NOT NULL, "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobCardRemovedPartEvent_removedPartId_fkey" FOREIGN KEY ("removedPartId") REFERENCES "JobCardRemovedPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobCardRemovedPartEvent_clientRequestId_key" ON "JobCardRemovedPartEvent"("clientRequestId");
CREATE INDEX "JobCardRemovedPartEvent_removedPartId_createdAt_id_idx" ON "JobCardRemovedPartEvent"("removedPartId", "createdAt", "id");
INSERT INTO "JobCardRemovedPartEvent" ("id", "removedPartId", "clientRequestId", "requestFingerprint", "action", "toStatus", "actorId", "reason", "details", "createdAt")
  SELECT 'legacy:' || "id", "id", 'legacy:' || "id", 'LEGACY', 'LEGACY_BASELINE', "lifecycleStatus"::text, "createdById", 'Historical record retained; approval not inferred', '{}'::jsonb, "createdAt" FROM "JobCardRemovedPart";
COMMIT;
