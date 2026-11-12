-- Preserve the billed service even when its job card is later corrected.
ALTER TABLE "ServiceBillLine" ADD COLUMN "serviceSnapshot" JSONB;
UPDATE "ServiceBillLine" AS bl
SET "serviceSnapshot" = jsonb_build_object(
  'id', sl."id", 'sparePartId', sl."sparePartId", 'qty', sl."qty",
  'ratePaise', sl."ratePaise"::text, 'amountPaise', bl."amountPaise"::text,
  'description', sl."description",
  'jobCard', jsonb_build_object('id', jc."id", 'jobCardNumber', jc."jobCardNumber",
    'vehicleId', jc."vehicleId", 'finalisedAt', jc."finalisedAt"),
  'sparePart', jsonb_build_object('id', sp."id", 'name', sp."name")
)
FROM "JobCardServiceLine" sl
JOIN "JobCard" jc ON jc."id" = sl."jobCardId"
JOIN "SparePart" sp ON sp."id" = sl."sparePartId"
WHERE sl."id" = bl."jobCardServiceLineId";
ALTER TABLE "ServiceBillLine" ALTER COLUMN "serviceSnapshot" SET NOT NULL;
DROP INDEX "ServiceBillLine_jobCardServiceLineId_key";
ALTER TABLE "ServiceBillLine" DROP CONSTRAINT "ServiceBillLine_jobCardServiceLineId_fkey";
ALTER TABLE "ServiceBillLine" ALTER COLUMN "jobCardServiceLineId" DROP NOT NULL;
ALTER TABLE "ServiceBillLine" ADD CONSTRAINT "ServiceBillLine_jobCardServiceLineId_fkey"
  FOREIGN KEY ("jobCardServiceLineId") REFERENCES "JobCardServiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ServiceBillLine_serviceBillId_jobCardServiceLineId_key"
  ON "ServiceBillLine"("serviceBillId", "jobCardServiceLineId");
CREATE INDEX "ServiceBillLine_jobCardServiceLineId_idx" ON "ServiceBillLine"("jobCardServiceLineId");
CREATE INDEX "JobCardServiceLine_serviceProviderId_billedInServiceBillId_idx"
  ON "JobCardServiceLine"("serviceProviderId", "billedInServiceBillId");
CREATE INDEX "ServiceBill_createdAt_id_idx" ON "ServiceBill"("createdAt", "id");
CREATE INDEX "ServiceBill_branchId_createdAt_id_idx" ON "ServiceBill"("branchId", "createdAt", "id");
