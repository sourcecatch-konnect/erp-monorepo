-- Historical returns remain unchanged and have no request identity.
ALTER TABLE "JobCardRemovedPart" ADD COLUMN "clientRequestId" TEXT;
ALTER TABLE "JobCardRemovedPart" ADD COLUMN "requestFingerprint" TEXT;
CREATE UNIQUE INDEX "JobCardRemovedPart_clientRequestId_key" ON "JobCardRemovedPart"("clientRequestId");
CREATE INDEX "JobCardRemovedPart_jobCardId_createdAt_id_idx" ON "JobCardRemovedPart"("jobCardId", "createdAt", "id");
CREATE INDEX "JobCardRemovedPart_relatedPartLineId_idx" ON "JobCardRemovedPart"("relatedPartLineId");
