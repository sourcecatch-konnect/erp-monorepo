-- DC / LDC broker detention slabs.
--
-- The existing "DetentionRate" hangs off a customer Agreement and cannot
-- express what the business actually negotiates: terms are per broker, vary by
-- vehicle type and freight band, carry two independent free-day rules, and
-- stack in tiers. "DetentionRate" is left in place — it is still read by the
-- agreement master screen — and these tables serve the payable side.

CREATE TYPE "DetentionBasis" AS ENUM ('DAY', 'HOUR');

CREATE TABLE "DetentionSlab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transportId" TEXT,
    "customerId" TEXT,
    "vehicleTypeId" TEXT,
    "freightFromPaise" BIGINT,
    "freightToPaise" BIGINT,
    "basis" "DetentionBasis" NOT NULL DEFAULT 'DAY',
    "firstDayFree" BOOLEAN NOT NULL DEFAULT false,
    "lastDayFree" BOOLEAN NOT NULL DEFAULT false,
    "freeHours" INTEGER,
    "blockHours" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetentionSlab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DetentionSlabBand" (
    "id" TEXT NOT NULL,
    "slabId" TEXT NOT NULL,
    "fromUnit" INTEGER NOT NULL,
    "toUnit" INTEGER,
    "ratePaise" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetentionSlabBand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DetentionSlab_deletedAt_isActive_transportId_idx"
    ON "DetentionSlab"("deletedAt", "isActive", "transportId");
CREATE INDEX "DetentionSlab_customerId_idx" ON "DetentionSlab"("customerId");
CREATE INDEX "DetentionSlab_vehicleTypeId_idx" ON "DetentionSlab"("vehicleTypeId");
CREATE INDEX "DetentionSlab_effectiveFrom_effectiveTo_idx"
    ON "DetentionSlab"("effectiveFrom", "effectiveTo");

CREATE INDEX "DetentionSlabBand_slabId_idx" ON "DetentionSlabBand"("slabId");
-- One band may start at a given unit per slab: overlapping tiers would make
-- the charge depend on row order.
CREATE UNIQUE INDEX "DetentionSlabBand_slabId_fromUnit_key"
    ON "DetentionSlabBand"("slabId", "fromUnit");

ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_transportId_fkey"
    FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_vehicleTypeId_fkey"
    FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DetentionSlabBand" ADD CONSTRAINT "DetentionSlabBand_slabId_fkey"
    FOREIGN KEY ("slabId") REFERENCES "DetentionSlab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guards the money, not just the form: a band that ends before it starts, or a
-- negative rate, would silently produce a wrong charge.
ALTER TABLE "DetentionSlabBand" ADD CONSTRAINT "DetentionSlabBand_range_chk"
    CHECK ("fromUnit" >= 1 AND ("toUnit" IS NULL OR "toUnit" >= "fromUnit"));
ALTER TABLE "DetentionSlabBand" ADD CONSTRAINT "DetentionSlabBand_rate_chk"
    CHECK ("ratePaise" >= 0);
ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_freight_range_chk"
    CHECK ("freightFromPaise" IS NULL OR "freightToPaise" IS NULL
           OR "freightToPaise" >= "freightFromPaise");
ALTER TABLE "DetentionSlab" ADD CONSTRAINT "DetentionSlab_effective_range_chk"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

-- The challan's own reported-for date. Detention counts from the earliest of
-- this, loadingAt, and every linked LR's reporting date.
ALTER TABLE "DeliveryChallan" ADD COLUMN "reportDate" TIMESTAMP(3);
