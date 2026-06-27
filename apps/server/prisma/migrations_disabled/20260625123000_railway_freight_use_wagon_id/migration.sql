-- Backfill RailwayFreightMatrix from wagon name references to stable wagon ids.
ALTER TABLE "RailwayFreightMatrix" ADD COLUMN "wagonId" TEXT;

UPDATE "RailwayFreightMatrix" AS r
SET "wagonId" = w."id"
FROM "Wagon" AS w
WHERE r."wagonType" = w."name";

ALTER TABLE "RailwayFreightMatrix" ALTER COLUMN "wagonId" SET NOT NULL;

DROP INDEX IF EXISTS "RailwayFreightMatrix_wagonType_idx";

ALTER TABLE "RailwayFreightMatrix"
DROP CONSTRAINT IF EXISTS "RailwayFreightMatrix_wagonType_fkey";

ALTER TABLE "RailwayFreightMatrix" DROP COLUMN "wagonType";

CREATE INDEX "RailwayFreightMatrix_wagonId_idx" ON "RailwayFreightMatrix"("wagonId");

ALTER TABLE "RailwayFreightMatrix"
ADD CONSTRAINT "RailwayFreightMatrix_wagonId_fkey"
FOREIGN KEY ("wagonId") REFERENCES "Wagon"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
