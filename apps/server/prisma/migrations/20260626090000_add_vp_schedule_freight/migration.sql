ALTER TABLE "VPScheduleWagonCount"
ADD COLUMN "freightMatrixId" TEXT,
ADD COLUMN "freightAmount" BIGINT,
ADD COLUMN "totalFreight" BIGINT;

WITH matched_freight AS (
  SELECT
    wagon_count."id" AS "wagonCountId",
    matrix."id" AS "freightMatrixId",
    matrix."freightAmount" AS "freightAmount",
    matrix."freightAmount" * wagon_count."count"::BIGINT AS "totalFreight"
  FROM "VPScheduleWagonCount" wagon_count
  JOIN "VPSchedule" schedule ON schedule."id" = wagon_count."vpScheduleId"
  JOIN "Area" source_area ON source_area."id" = schedule."sourceAreaId"
  JOIN "Area" destination_area ON destination_area."id" = schedule."destinationAreaId"
  JOIN LATERAL (
    SELECT railway_freight."id", railway_freight."freightAmount"
    FROM "RailwayFreightMatrix" railway_freight
    WHERE railway_freight."wagonId" = wagon_count."wagonId"
      AND railway_freight."sourceCityId" = source_area."cityId"
      AND railway_freight."destinationCityId" = destination_area."cityId"
      AND (
        (
          railway_freight."sourceAreaId" = source_area."id"
          AND railway_freight."destinationAreaId" = destination_area."id"
        )
        OR (
          railway_freight."sourceAreaId" = source_area."id"
          AND railway_freight."destinationAreaId" IS NULL
        )
        OR (
          railway_freight."sourceAreaId" IS NULL
          AND railway_freight."destinationAreaId" = destination_area."id"
        )
        OR (
          railway_freight."sourceAreaId" IS NULL
          AND railway_freight."destinationAreaId" IS NULL
        )
      )
    ORDER BY
      CASE
        WHEN railway_freight."sourceAreaId" = source_area."id"
          AND railway_freight."destinationAreaId" = destination_area."id" THEN 0
        WHEN railway_freight."sourceAreaId" = source_area."id"
          AND railway_freight."destinationAreaId" IS NULL THEN 1
        WHEN railway_freight."sourceAreaId" IS NULL
          AND railway_freight."destinationAreaId" = destination_area."id" THEN 2
        ELSE 3
      END
    LIMIT 1
  ) matrix ON TRUE
)
UPDATE "VPScheduleWagonCount" wagon_count
SET
  "freightMatrixId" = matched_freight."freightMatrixId",
  "freightAmount" = matched_freight."freightAmount",
  "totalFreight" = matched_freight."totalFreight"
FROM matched_freight
WHERE wagon_count."id" = matched_freight."wagonCountId";

CREATE INDEX "VPScheduleWagonCount_freightMatrixId_idx" ON "VPScheduleWagonCount"("freightMatrixId");

ALTER TABLE "VPScheduleWagonCount"
ADD CONSTRAINT "VPScheduleWagonCount_freightMatrixId_fkey"
FOREIGN KEY ("freightMatrixId") REFERENCES "RailwayFreightMatrix"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
