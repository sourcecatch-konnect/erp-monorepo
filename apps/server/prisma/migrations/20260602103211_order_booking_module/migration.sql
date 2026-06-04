-- Order Booking module: replace OrderBooking/OrderGoods stub with Order/OrderItem/OrderEvent,
-- introduce VehicleType master (convert Vehicle.vehicleType enum -> FK), CustomerLocation,
-- DocumentSequence, and add RateMatrix.vehicleTypeId.

-- 1. Drop old order stub tables (both empty) and their FKs
ALTER TABLE "OrderGoods" DROP CONSTRAINT IF EXISTS "OrderGoods_goodsId_fkey";
ALTER TABLE "OrderGoods" DROP CONSTRAINT IF EXISTS "OrderGoods_orderBookingId_fkey";
DROP TABLE "OrderGoods";

ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_approvedById_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_cityId_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_createdById_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_customerId_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_fromBranchId_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_toBranchId_fkey";
ALTER TABLE "OrderBooking" DROP CONSTRAINT IF EXISTS "OrderBooking_updatedById_fkey";
DROP TABLE "OrderBooking";

-- 2. Replace order enums (old values lived only on the dropped tables)
DROP TYPE "OrderBy";
DROP TYPE "OrderStatus";
CREATE TYPE "OrderType" AS ENUM ('Truck', 'Item');
CREATE TYPE "OrderStatus" AS ENUM ('PendingApproval', 'Confirmed', 'Rejected', 'Cancelled', 'InProgress', 'Completed');

-- 3. VehicleType master + seed the 5 legacy enum values
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "freightRangeFrom" DECIMAL(65,30),
    "freightRangeTo" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleType_code_key" ON "VehicleType"("code");

INSERT INTO "VehicleType" ("id", "code", "name") VALUES
  ('vt_container', 'Container', 'Container'),
  ('vt_open_body', 'Open_Body', 'Open Body'),
  ('vt_tata_407', 'TATA_407', 'TATA 407'),
  ('vt_dcm_lorry', 'DCM_Lorry', 'DCM Lorry'),
  ('vt_di_pickup', 'DI_Pickup', 'DI Pickup');

-- 4. Vehicle: enum -> FK (add nullable, backfill from old enum text, then enforce)
ALTER TABLE "Vehicle" ADD COLUMN "vehicleTypeId" TEXT;
UPDATE "Vehicle" v SET "vehicleTypeId" = vt."id"
  FROM "VehicleType" vt WHERE vt."code" = v."vehicleType"::text;
ALTER TABLE "Vehicle" ALTER COLUMN "vehicleTypeId" SET NOT NULL;
ALTER TABLE "Vehicle" DROP COLUMN "vehicleType";

-- 5. RateMatrix: add optional vehicleTypeId, widen unique key
DROP INDEX "RateMatrix_agreementId_routeId_key";
ALTER TABLE "RateMatrix" ADD COLUMN "vehicleTypeId" TEXT;
CREATE UNIQUE INDEX "RateMatrix_agreementId_routeId_vehicleTypeId_key" ON "RateMatrix"("agreementId", "routeId", "vehicleTypeId");

-- 6. New tables
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "customerLocationId" TEXT,
    "pickupAddressOverride" TEXT,
    "specialInstructions" TEXT,
    "orderType" "OrderType" NOT NULL,
    "truckQuantity" INTEGER,
    "vehicleTypeId" TEXT,
    "contactPersonName" TEXT,
    "contactMobile" TEXT,
    "contactEmail" TEXT,
    "bookingFreightAmount" DECIMAL(65,30),
    "freightOverrideReason" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PendingApproval',
    "rejectionReason" TEXT,
    "cancelReason" TEXT,
    "fyCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "cityId" TEXT,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "payloadDiff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerLocation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "cityId" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "gstNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- 7. Indexes
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_fromBranchId_idx" ON "Order"("fromBranchId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_fyCode_idx" ON "Order"("fyCode");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");
CREATE INDEX "CustomerLocation_customerId_idx" ON "CustomerLocation"("customerId");
CREATE UNIQUE INDEX "DocumentSequence_branchCode_fyCode_docType_key" ON "DocumentSequence"("branchCode", "fyCode", "docType");

-- 8. Foreign keys
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerLocationId_fkey" FOREIGN KEY ("customerLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
