-- Trim TripStatus: drop AtDestination + Completed (never used in logic).
-- Existing rows in those states (if any) collapse to Closed.
-- openingKm becomes required (captured at trip creation).

-- 1. Backfill openingKm for any rows that predate the required field.
--    0 is a sentinel for "unknown" on legacy rows; new rows always provide it.
UPDATE "VehicleTrip" SET "openingKm" = 0 WHERE "openingKm" IS NULL;
ALTER TABLE "VehicleTrip" ALTER COLUMN "openingKm" SET NOT NULL;

-- 2. Recreate the TripStatus enum without AtDestination / Completed.
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";

CREATE TYPE "TripStatus" AS ENUM ('Planned', 'InTransit', 'Closed', 'Cancelled');

-- Remap the dropped values to Closed on existing data.
ALTER TABLE "VehicleTrip"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TripStatus"
    USING (
      CASE "status"::text
        WHEN 'AtDestination' THEN 'Closed'
        WHEN 'Completed' THEN 'Closed'
        ELSE "status"::text
      END
    )::"TripStatus",
  ALTER COLUMN "status" SET DEFAULT 'Planned';

ALTER TABLE "TripStatusHistory"
  ALTER COLUMN "status" TYPE "TripStatus"
    USING (
      CASE "status"::text
        WHEN 'AtDestination' THEN 'Closed'
        WHEN 'Completed' THEN 'Closed'
        ELSE "status"::text
      END
    )::"TripStatus";

DROP TYPE "TripStatus_old";
