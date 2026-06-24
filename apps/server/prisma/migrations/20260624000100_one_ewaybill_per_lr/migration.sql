-- Enforce the product rule that one LR can carry only one e-way bill.
-- Dev data is expected to have no duplicates before this migration.
CREATE UNIQUE INDEX "EwayBill_lorryReceiptId_key" ON "EwayBill"("lorryReceiptId");
