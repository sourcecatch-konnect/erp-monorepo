-- Reconciles drift: "THIRD_PARTY" was added to the live "BillPartyType" enum
-- directly against the database (outside migration history) and was never
-- part of the schema/migrations. No "Bill" rows use it. Postgres cannot drop
-- a single enum value, so the type is recreated without it.
CREATE TYPE "BillPartyType_new" AS ENUM ('CONSIGNOR', 'CONSIGNEE');

ALTER TABLE "Bill"
ALTER COLUMN "billingPartyType" TYPE "BillPartyType_new"
USING ("billingPartyType"::text::"BillPartyType_new");

DROP TYPE "BillPartyType";

ALTER TYPE "BillPartyType_new" RENAME TO "BillPartyType";
