-- CreateIndex
CREATE INDEX "LRGroup_railheadBranchId_idx" ON "LRGroup"("railheadBranchId");

-- CreateIndex
CREATE INDEX "VPSchedule_fromBranchId_status_createdAt_idx" ON "VPSchedule"("fromBranchId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VPSchedule_fromBranchId_toBranchId_sourceAreaId_destination_idx" ON "VPSchedule"("fromBranchId", "toBranchId", "sourceAreaId", "destinationAreaId", "scheduleDate");
