-- Delivery Challan unloading supervisors now come from the Labour master
-- (WorkerType.Supervisor) instead of application users. Existing User ids
-- cannot be mapped reliably to Labour rows, so clear those selections first.
ALTER TABLE "DeliveryChallan"
DROP CONSTRAINT IF EXISTS "DeliveryChallan_supervisorId_fkey";

ALTER TABLE "DeliveryChallan"
ALTER COLUMN "supervisorId" DROP NOT NULL;

UPDATE "DeliveryChallan"
SET "supervisorId" = NULL
WHERE "supervisorId" IS NOT NULL;

ALTER TABLE "DeliveryChallan"
ADD CONSTRAINT "DeliveryChallan_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "Labour"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
