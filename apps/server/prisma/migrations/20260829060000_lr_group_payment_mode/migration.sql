-- Freight billing basis on the LR group.
--   TO_BE_BILLED -> GST invoice to a contracted client (Road GTA / Road & Rail)
--   TO_PAY       -> non-GST "to pay" freight to a transporter-as-customer,
--                   billed under the ROAD bill type, any transport mode.
-- Chosen at LR creation, editable only while the group is DRAFT.

-- CreateEnum
CREATE TYPE "LRPaymentMode" AS ENUM ('TO_BE_BILLED', 'TO_PAY');

-- AlterTable
ALTER TABLE "LRGroup" ADD COLUMN "paymentMode" "LRPaymentMode" NOT NULL DEFAULT 'TO_BE_BILLED';

-- Back-fill: a group already invoiced under a non-cancelled ROAD bill was a
-- "to pay" movement. Everything else keeps the TO_BE_BILLED default.
UPDATE "LRGroup" g
SET "paymentMode" = 'TO_PAY'
WHERE EXISTS (
  SELECT 1
  FROM "LorryReceipt" lr
  JOIN "BillLine" bl ON bl."lrId" = lr."id"
  JOIN "Bill" b ON b."id" = bl."billId"
  WHERE lr."groupId" = g."id"
    AND b."billType" = 'ROAD'
    AND b."status" <> 'CANCELLED'
);

-- CreateIndex
CREATE INDEX "LRGroup_paymentMode_idx" ON "LRGroup"("paymentMode");
