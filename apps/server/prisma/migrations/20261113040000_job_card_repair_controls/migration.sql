BEGIN;
ALTER TABLE "Vehicle" ADD COLUMN "maintenanceHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobCard" ADD COLUMN "repairControlRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobCard" ALTER COLUMN "repairControlRequired" SET DEFAULT true;
CREATE TABLE "JobCardRepairControl" (
  "jobCardId" TEXT PRIMARY KEY, "status" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "maintenanceReason" TEXT NOT NULL, "replacementIntent" TEXT NOT NULL, "inspection" JSONB NOT NULL, "release" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedById" TEXT NOT NULL,
  "clearedAt" TIMESTAMP(3), "clearedById" TEXT,
  CONSTRAINT "JobCardRepairControl_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "JobCardRepairControl_state_chk" CHECK ("status" IN ('IN_PROGRESS', 'RELEASED', 'CANCELLED')),
  CONSTRAINT "JobCardRepairControl_clearance_chk" CHECK (("status" = 'IN_PROGRESS' AND "release" IS NULL AND "clearedAt" IS NULL AND "clearedById" IS NULL) OR ("status" <> 'IN_PROGRESS' AND "release" IS NOT NULL AND "clearedAt" IS NOT NULL AND "clearedById" IS NOT NULL))
);
CREATE INDEX "JobCardRepairControl_status_jobCardId_idx" ON "JobCardRepairControl"("status", "jobCardId");
CREATE TABLE "JobCardRepairEvent" (
  "id" TEXT PRIMARY KEY, "jobCardId" TEXT NOT NULL, "clientRequestId" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL,
  "action" TEXT NOT NULL, "actorId" TEXT NOT NULL, "details" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobCardRepairEvent_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobCardRepairEvent_clientRequestId_key" ON "JobCardRepairEvent"("clientRequestId");
CREATE INDEX "JobCardRepairEvent_jobCardId_createdAt_id_idx" ON "JobCardRepairEvent"("jobCardId", "createdAt", "id");
COMMIT;
