-- A railhead is a physical Area. Branches are operational owners and may
-- share the same railhead, so the relationship is many-to-many.
CREATE TABLE "BranchRailheadArea" (
    "branchId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchRailheadArea_pkey" PRIMARY KEY ("branchId", "areaId")
);

ALTER TABLE "BranchRailheadArea"
ADD CONSTRAINT "BranchRailheadArea_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BranchRailheadArea"
ADD CONSTRAINT "BranchRailheadArea_areaId_fkey"
FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BranchRailheadArea_areaId_idx" ON "BranchRailheadArea"("areaId");
CREATE INDEX "BranchRailheadArea_isActive_idx" ON "BranchRailheadArea"("isActive");

ALTER TABLE "LRGroup"
ADD COLUMN "sourceRailheadAreaId" TEXT,
ADD COLUMN "destinationRailheadAreaId" TEXT;

ALTER TABLE "LRGroup"
ADD CONSTRAINT "LRGroup_sourceRailheadAreaId_fkey"
FOREIGN KEY ("sourceRailheadAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LRGroup"
ADD CONSTRAINT "LRGroup_destinationRailheadAreaId_fkey"
FOREIGN KEY ("destinationRailheadAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LRGroup_sourceRailheadAreaId_idx" ON "LRGroup"("sourceRailheadAreaId");
CREATE INDEX "LRGroup_destinationRailheadAreaId_idx" ON "LRGroup"("destinationRailheadAreaId");

-- Existing VP schedules are authoritative evidence that a branch used an
-- Area as a railway endpoint. Seed mappings without guessing LR assignments.
INSERT INTO "BranchRailheadArea" ("branchId", "areaId", "isActive", "updatedAt")
SELECT DISTINCT "fromBranchId", "sourceAreaId", true, CURRENT_TIMESTAMP
FROM "VPSchedule"
WHERE "deletedAt" IS NULL
ON CONFLICT ("branchId", "areaId") DO NOTHING;

INSERT INTO "BranchRailheadArea" ("branchId", "areaId", "isActive", "updatedAt")
SELECT DISTINCT "toBranchId", "destinationAreaId", true, CURRENT_TIMESTAMP
FROM "VPSchedule"
WHERE "deletedAt" IS NULL
ON CONFLICT ("branchId", "areaId") DO NOTHING;

UPDATE "Area"
SET "isRailHead" = true
WHERE "id" IN (
  SELECT "sourceAreaId" FROM "VPSchedule" WHERE "deletedAt" IS NULL
  UNION
  SELECT "destinationAreaId" FROM "VPSchedule" WHERE "deletedAt" IS NULL
  UNION
  SELECT "sourceAreaId" FROM "RailwayFreightMatrix" WHERE "sourceAreaId" IS NOT NULL
  UNION
  SELECT "destinationAreaId" FROM "RailwayFreightMatrix" WHERE "destinationAreaId" IS NOT NULL
);

-- Keep the legacy Branch flag aligned with the new source-of-truth mapping.
UPDATE "Branch"
SET "isRailHead" = true
WHERE "id" IN (
  SELECT "branchId" FROM "BranchRailheadArea" WHERE "isActive" = true
);
