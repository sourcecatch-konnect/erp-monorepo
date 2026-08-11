-- Branch GRN unloading supervisors now come from the Labour master
-- (WorkerType.Supervisor) instead of application users. Existing User ids
-- cannot be mapped reliably to Labour rows, so clear those selections first.
ALTER TABLE "RailBranchGRN"
DROP CONSTRAINT IF EXISTS "RailBranchGRN_unloadingSupervisorId_fkey";

UPDATE "RailBranchGRN"
SET "unloadingSupervisorId" = NULL
WHERE "unloadingSupervisorId" IS NOT NULL;

ALTER TABLE "RailBranchGRN"
ADD CONSTRAINT "RailBranchGRN_unloadingSupervisorId_fkey"
FOREIGN KEY ("unloadingSupervisorId") REFERENCES "Labour"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
