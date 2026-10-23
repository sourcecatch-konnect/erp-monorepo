-- Salary run: manual payouts made to the driver during the month get their
-- own column, next to salary advance / log slip / previous balance.
ALTER TABLE "DriverSalary" ADD COLUMN "otherPaymentsPaise" BIGINT NOT NULL DEFAULT 0;

-- The month's salary-advance figure comes from the ledger and can go
-- negative when an earlier month's advance is reversed this month, so it is
-- no longer forced to be >= 0 (the compute moves such a remainder into the
-- previous balance anyway — this only stops a valid row being refused).
ALTER TABLE "DriverSalary" DROP CONSTRAINT "DriverSalary_amounts_chk";
ALTER TABLE "DriverSalary" ADD CONSTRAINT "DriverSalary_amounts_chk"
    CHECK ("absentDays" >= 0 AND "presentDays" >= 0
       AND "baseSalaryPaise" >= 0 AND "earnedPaise" >= 0);
