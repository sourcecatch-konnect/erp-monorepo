-- GRN unloading supervisors now come from the Labour master (WorkerType.Supervisor)
-- instead of application users. Existing user ids cannot be mapped reliably to
-- Labour rows, so clear those historical selections before replacing the FK.
ALTER TABLE "GRN"
DROP CONSTRAINT IF EXISTS "GRN_unloadingSupervisorId_fkey";

UPDATE "GRN"
SET "unloadingSupervisorId" = NULL
WHERE "unloadingSupervisorId" IS NOT NULL;

ALTER TABLE "GRN"
ADD CONSTRAINT "GRN_unloadingSupervisorId_fkey"
FOREIGN KEY ("unloadingSupervisorId") REFERENCES "Labour"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
