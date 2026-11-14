-- Support deterministic register pagination, both across all branches and
-- within assigned branches. No historical costs or vouchers are changed.
CREATE INDEX "JobCard_createdAt_id_idx" ON "JobCard"("createdAt", "id");
CREATE INDEX "JobCard_branchId_createdAt_id_idx" ON "JobCard"("branchId", "createdAt", "id");
