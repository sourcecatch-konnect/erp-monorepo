-- Dispatch-state fields on a trip.
--   plannedStartDateTime -> scheduled/expected dispatch while the trip is still
--     Planned. Never drives status; only startDateTime (the actual dispatch)
--     does.
--   createdAs -> how the trip entered the system. PLANNED is the normal flow;
--     BACKFILLED_IN_TRANSIT means the truck had already left when the trip/LR
--     was entered and it was created straight into InTransit with a back-dated
--     startDateTime.

-- CreateEnum
CREATE TYPE "TripCreatedAs" AS ENUM ('PLANNED', 'BACKFILLED_IN_TRANSIT');

-- AlterTable
ALTER TABLE "VehicleTrip" ADD COLUMN "plannedStartDateTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehicleTrip" ADD COLUMN "createdAs" "TripCreatedAs" NOT NULL DEFAULT 'PLANNED';
