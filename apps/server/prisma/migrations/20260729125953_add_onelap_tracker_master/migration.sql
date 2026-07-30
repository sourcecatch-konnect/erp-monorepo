-- CreateEnum
CREATE TYPE "OneLapTrackerReleaseReason" AS ENUM ('RAKE_RECEIVED', 'TRACKER_REPLACED', 'SCHEDULE_CANCELLED', 'MANUAL_RELEASE', 'INSTALLATION_ERROR');

-- CreateTable
CREATE TABLE "OneLapTracker" (
    "id" TEXT NOT NULL,
    "oneLapDeviceId" INTEGER NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "providerStatus" TEXT,
    "vehicleNumber" TEXT,
    "validityAt" TIMESTAMP(3),
    "attributes" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPresentOnProvider" BOOLEAN NOT NULL DEFAULT true,
    "lastProviderUpdateAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneLapTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneLapTrackerAssignment" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "vpScheduleId" TEXT NOT NULL,
    "installedOnMrRrRowId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releaseReason" "OneLapTrackerReleaseReason",
    "releaseRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneLapTrackerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OneLapTracker_oneLapDeviceId_key" ON "OneLapTracker"("oneLapDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "OneLapTracker_uniqueId_key" ON "OneLapTracker"("uniqueId");

-- CreateIndex
CREATE INDEX "OneLapTracker_isEnabled_idx" ON "OneLapTracker"("isEnabled");

-- CreateIndex
CREATE INDEX "OneLapTracker_isPresentOnProvider_idx" ON "OneLapTracker"("isPresentOnProvider");

-- CreateIndex
CREATE INDEX "OneLapTracker_providerStatus_idx" ON "OneLapTracker"("providerStatus");

-- CreateIndex
CREATE INDEX "OneLapTracker_lastSyncedAt_idx" ON "OneLapTracker"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "OneLapTrackerAssignment_trackerId_idx" ON "OneLapTrackerAssignment"("trackerId");

-- CreateIndex
CREATE INDEX "OneLapTrackerAssignment_vpScheduleId_idx" ON "OneLapTrackerAssignment"("vpScheduleId");

-- CreateIndex
CREATE INDEX "OneLapTrackerAssignment_installedOnMrRrRowId_idx" ON "OneLapTrackerAssignment"("installedOnMrRrRowId");

-- CreateIndex
CREATE INDEX "OneLapTrackerAssignment_releasedAt_idx" ON "OneLapTrackerAssignment"("releasedAt");

-- AddForeignKey
ALTER TABLE "OneLapTrackerAssignment" ADD CONSTRAINT "OneLapTrackerAssignment_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "OneLapTracker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneLapTrackerAssignment" ADD CONSTRAINT "OneLapTrackerAssignment_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneLapTrackerAssignment" ADD CONSTRAINT "OneLapTrackerAssignment_installedOnMrRrRowId_fkey" FOREIGN KEY ("installedOnMrRrRowId") REFERENCES "MRRRRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneLapTrackerAssignment" ADD CONSTRAINT "OneLapTrackerAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneLapTrackerAssignment" ADD CONSTRAINT "OneLapTrackerAssignment_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
