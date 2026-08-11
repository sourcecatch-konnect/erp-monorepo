-- VP wagon loading supervisors now come from the Labour master
-- (WorkerType.Supervisor) instead of application users. Existing User ids
-- cannot be mapped reliably to Labour rows, so clear those selections first.
ALTER TABLE "VPWagonLoading"
DROP CONSTRAINT IF EXISTS "VPWagonLoading_loadingSupervisorId_fkey";

UPDATE "VPWagonLoading"
SET "loadingSupervisorId" = NULL
WHERE "loadingSupervisorId" IS NOT NULL;

ALTER TABLE "VPWagonLoading"
ADD CONSTRAINT "VPWagonLoading_loadingSupervisorId_fkey"
FOREIGN KEY ("loadingSupervisorId") REFERENCES "Labour"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
