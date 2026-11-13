BEGIN;
ALTER TABLE "ServiceBillLine" ADD COLUMN "discountPaise" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ServiceBillLine" ADD COLUMN "netAmountPaise" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ServiceBillLine" ADD COLUMN "jobCardIdSnapshot" TEXT;
ALTER TABLE "ServiceBillLine" ADD COLUMN "vehicleIdSnapshot" TEXT;

-- Refuse to manufacture allocations from inconsistent financial history.
-- Old cancelled bills whose rows were deleted cannot be reconstructed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "ServiceBill" b LEFT JOIN "ServiceBillLine" l ON l."serviceBillId" = b."id"
    GROUP BY b."id"
    HAVING (COUNT(l."id") > 0 OR b."status" = 'POSTED') AND (
      COALESCE(SUM(l."amountPaise"), 0) <> b."grossAmountPaise"
      OR b."discountPaise" < 0 OR b."discountPaise" > b."grossAmountPaise"
      OR b."netAmountPaise" <> b."grossAmountPaise" - b."discountPaise"
    )
  ) THEN RAISE EXCEPTION 'Service bill totals do not reconcile; review history before allocating discounts'; END IF;
END $$;

WITH weights AS (
  SELECT l."id", l."amountPaise", b."discountPaise",
    SUM(l."amountPaise") OVER (PARTITION BY l."serviceBillId") AS gross,
    l."serviceBillId",
    COALESCE(l."serviceSnapshot"->>'id', l."jobCardServiceLineId", l."id") AS tie_key
  FROM "ServiceBillLine" l JOIN "ServiceBill" b ON b."id" = l."serviceBillId"
), shares AS (
  SELECT *, CASE WHEN gross = 0 THEN 0 ELSE FLOOR("discountPaise"::numeric * "amountPaise" / gross) END AS base,
    CASE WHEN gross = 0 THEN 0 ELSE MOD("discountPaise"::numeric * "amountPaise", gross) END AS remainder
  FROM weights
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "serviceBillId" ORDER BY remainder DESC, tie_key COLLATE "C", "id") AS rank,
    "discountPaise" - SUM(base) OVER (PARTITION BY "serviceBillId") AS leftover
  FROM shares
), allocated AS (
  SELECT "id", (base + CASE WHEN rank <= leftover THEN 1 ELSE 0 END)::bigint AS discount FROM ranked
)
UPDATE "ServiceBillLine" l SET
  "discountPaise" = a.discount, "netAmountPaise" = l."amountPaise" - a.discount,
  "jobCardIdSnapshot" = l."serviceSnapshot"->'jobCard'->>'id',
  "vehicleIdSnapshot" = l."serviceSnapshot"->'jobCard'->>'vehicleId'
FROM allocated a WHERE a."id" = l."id";

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "ServiceBillLine" l JOIN "ServiceBill" b ON b."id" = l."serviceBillId"
    LEFT JOIN "JobCard" c ON c."id" = l."jobCardIdSnapshot"
    WHERE b."status" = 'POSTED' AND (c."id" IS NULL
      OR l."vehicleIdSnapshot" IS DISTINCT FROM c."vehicleId" OR b."branchId" <> c."branchId")
  ) THEN RAISE EXCEPTION 'Posted service bill has missing or inconsistent job/vehicle attribution; reconcile before reporting'; END IF;
END $$;

CREATE INDEX "ServiceBillLine_jobCardIdSnapshot_idx" ON "ServiceBillLine"("jobCardIdSnapshot");
CREATE INDEX "JobCard_branchId_status_outDateTime_id_idx" ON "JobCard"("branchId", "status", "outDateTime", "id");
ALTER TABLE "ServiceBillLine" ADD CONSTRAINT "ServiceBillLine_allocation_amounts_chk"
  CHECK ("discountPaise" >= 0 AND "netAmountPaise" >= 0 AND "amountPaise" = "discountPaise" + "netAmountPaise");
COMMIT;
