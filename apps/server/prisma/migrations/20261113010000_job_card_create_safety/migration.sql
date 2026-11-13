BEGIN;
ALTER TABLE "JobCard" ADD COLUMN "clientRequestId" TEXT;
ALTER TABLE "JobCard" ADD COLUMN "requestFingerprint" TEXT;
CREATE UNIQUE INDEX "JobCard_clientRequestId_key" ON "JobCard"("clientRequestId");
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_create_request_pair_chk"
  CHECK (("clientRequestId" IS NULL) = ("requestFingerprint" IS NULL));

-- Retain cancelled history and allow a replacement bill, but never silently
-- choose a winner among existing active duplicate provider invoices.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "ServiceBill" WHERE "status" <> 'CANCELLED'
    GROUP BY "serviceProviderId", "fyCode", lower(btrim("providerInvoiceNo"))
    HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Active provider invoice duplicates exist; reconcile before applying invoice uniqueness'; END IF;
END $$;
CREATE UNIQUE INDEX "ServiceBill_active_provider_invoice_key"
  ON "ServiceBill" ("serviceProviderId", "fyCode", lower(btrim("providerInvoiceNo")))
  WHERE "status" <> 'CANCELLED';
COMMIT;
