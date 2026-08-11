-- Record unloading completion separately from vehicle reporting and final
-- consignee handover for the LR Unloading Report.
ALTER TABLE "LRDelivery"
ADD COLUMN "unloadingAt" TIMESTAMP(3);

CREATE INDEX "LRDelivery_unloadingAt_idx"
ON "LRDelivery"("unloadingAt");
