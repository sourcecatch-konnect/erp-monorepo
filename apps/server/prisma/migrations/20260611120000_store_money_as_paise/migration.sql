-- Store rupee-denominated money values as paise.
-- This is data-only: column types stay the same, values are multiplied once.

UPDATE "RateMatrix"
SET "rate" = "rate" * 100
WHERE "rate" IS NOT NULL;

UPDATE "RailwayFreightMatrix"
SET "freightAmount" = "freightAmount" * 100
WHERE "freightAmount" IS NOT NULL;

UPDATE "SparePart"
SET "rate" = "rate" * 100
WHERE "rate" IS NOT NULL;

UPDATE "Customer"
SET "creditLimit" = "creditLimit" * 100
WHERE "creditLimit" IS NOT NULL;

UPDATE "Pump"
SET
  "currentDieselRate" = "currentDieselRate" * 100,
  "creditLimit" = "creditLimit" * 100
WHERE "currentDieselRate" IS NOT NULL
   OR "creditLimit" IS NOT NULL;

UPDATE "Warehouse"
SET
  "monthlyRent" = "monthlyRent" * 100,
  "securityDeposit" = "securityDeposit" * 100
WHERE "monthlyRent" IS NOT NULL
   OR "securityDeposit" IS NOT NULL;

UPDATE "Labour"
SET "tdsAmount" = "tdsAmount" * 100
WHERE "tdsAmount" IS NOT NULL;

UPDATE "Driver"
SET
  "salary" = "salary" * 100,
  "noTDSApplyAmount" = "noTDSApplyAmount" * 100
WHERE "salary" IS NOT NULL
   OR "noTDSApplyAmount" IS NOT NULL;

UPDATE "VehicleType"
SET
  "freightRangeFrom" = "freightRangeFrom" * 100,
  "freightRangeTo" = "freightRangeTo" * 100
WHERE "freightRangeFrom" IS NOT NULL
   OR "freightRangeTo" IS NOT NULL;

UPDATE "Order"
SET "bookingFreightAmount" = "bookingFreightAmount" * 100
WHERE "bookingFreightAmount" IS NOT NULL;
