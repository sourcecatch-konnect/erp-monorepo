-- DC Acknowledgement becomes broker-only.
--
-- The parallel SUPERVISOR acknowledgement is dropped. SK's own account of the
-- delivery already lives on the challan (`supervisorId` -> Labour, the person
-- who ran the unloading) and on the LR (`reportedAt` / `unloadingAt`); the
-- supervisor is not an ERP user and never filed anything himself. The control
-- on an inflated broker claim is the slab ceiling -- min(claimed, slab) -- not
-- a side-by-side comparison.
--
-- DESTRUCTIVE: any SUPERVISOR acknowledgement rows are deleted. Approvals that
-- accepted one are deleted with them (the approval is a ruling on an ack that
-- will no longer exist, so it cannot be left dangling).

-- 1. Drop approvals that ruled on a supervisor acknowledgement.
DELETE FROM "DeliveryChallanApproval" a
USING "DeliveryChallanAcknowledgement" k
WHERE a."acceptedAckId" = k."id"
  AND k."ackType" = 'SUPERVISOR';

-- 2. Drop the supervisor acknowledgements themselves. Their items cascade.
DELETE FROM "DeliveryChallanAcknowledgement"
WHERE "ackType" = 'SUPERVISOR';

-- 3. One acknowledgement per challan, now that only the broker files.
DROP INDEX IF EXISTS "DeliveryChallanAcknowledgement_challanId_ackType_key";

CREATE UNIQUE INDEX "DeliveryChallanAcknowledgement_challanId_key"
  ON "DeliveryChallanAcknowledgement"("challanId");

-- 4. Retire the discriminators.
ALTER TABLE "DeliveryChallanApproval" DROP COLUMN "acceptedAckType";
ALTER TABLE "DeliveryChallanAcknowledgement" DROP COLUMN "ackType";

DROP TYPE "DeliveryChallanAckType";
