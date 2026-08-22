ALTER TABLE "Customer"
ADD COLUMN "splitBillsByChargeType" BOOLEAN NOT NULL DEFAULT false;

-- Whirlpool requires separate freight and additional-charge invoices for the
-- same LR. The master switch remains editable for future contract changes.
UPDATE "Customer"
SET "splitBillsByChargeType" = true
WHERE lower("name") LIKE 'whirlpool%';
