-- Vehicle P&L monthly costs: per-vehicle standing fixed costs (defaults) and
-- per-month cost rows (overrides + salary/tyre/other). Additive only.

CREATE TABLE "VehicleCostDefault" (
    "vehicleId" TEXT NOT NULL,
    "taxPaise" BIGINT NOT NULL DEFAULT 0,
    "insurancePaise" BIGINT NOT NULL DEFAULT 0,
    "permitPaise" BIGINT NOT NULL DEFAULT 0,
    "fitnessPaise" BIGINT NOT NULL DEFAULT 0,
    "emiPaise" BIGINT NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCostDefault_pkey" PRIMARY KEY ("vehicleId")
);

CREATE TABLE "VehicleMonthlyCost" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "taxPaise" BIGINT NOT NULL DEFAULT 0,
    "insurancePaise" BIGINT NOT NULL DEFAULT 0,
    "permitPaise" BIGINT NOT NULL DEFAULT 0,
    "fitnessPaise" BIGINT NOT NULL DEFAULT 0,
    "emiPaise" BIGINT NOT NULL DEFAULT 0,
    "salaryPaise" BIGINT NOT NULL DEFAULT 0,
    "tyrePaise" BIGINT NOT NULL DEFAULT 0,
    "otherPaise" BIGINT NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMonthlyCost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleMonthlyCost_vehicleId_month_key" ON "VehicleMonthlyCost"("vehicleId", "month");
CREATE INDEX "VehicleMonthlyCost_month_idx" ON "VehicleMonthlyCost"("month");

ALTER TABLE "VehicleCostDefault" ADD CONSTRAINT "VehicleCostDefault_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMonthlyCost" ADD CONSTRAINT "VehicleMonthlyCost_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
