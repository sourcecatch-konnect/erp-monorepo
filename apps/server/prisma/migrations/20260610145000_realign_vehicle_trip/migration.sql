-- AlterEnum
BEGIN;
CREATE TYPE "TripStatus_new" AS ENUM ('Planned', 'InTransit', 'AtDestination', 'Completed', 'Closed', 'Cancelled');
ALTER TABLE "VehicleTrip" ALTER COLUMN "status" TYPE "TripStatus_new" USING ("status"::text::"TripStatus_new");
ALTER TABLE "TripStatusHistory" ALTER COLUMN "status" TYPE "TripStatus_new" USING ("status"::text::"TripStatus_new");
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";
ALTER TYPE "TripStatus_new" RENAME TO "TripStatus";
DROP TYPE "public"."TripStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "LorryReceipt" DROP CONSTRAINT "LorryReceipt_tripId_fkey";

-- DropForeignKey
ALTER TABLE "TripStatusHistory" DROP CONSTRAINT "TripStatusHistory_vehicleTripId_fkey";

-- DropForeignKey
ALTER TABLE "TripUnloadingPoint" DROP CONSTRAINT "TripUnloadingPoint_vehicleTripId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleTrip" DROP CONSTRAINT "VehicleTrip_consignorId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleTrip" DROP CONSTRAINT "VehicleTrip_rateMatrixId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleTrip" DROP CONSTRAINT "VehicleTrip_tripAddedById_fkey";

-- AlterTable
ALTER TABLE "TripUnloadingPoint" DROP COLUMN "notes",
DROP COLUMN "unloadingLatitude",
DROP COLUMN "unloadingLongitude",
ADD COLUMN     "actualDate" TIMESTAMP(3),
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "plannedDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehicleTrip" DROP CONSTRAINT "VehicleTrip_pkey",
DROP COLUMN "advancePayment",
DROP COLUMN "description",
DROP COLUMN "paymentMode",
DROP COLUMN "totalGoodsQuantity",
DROP COLUMN "tripAddedById",
DROP COLUMN "tripId",
DROP COLUMN "vehicleStartKM",
ADD COLUMN     "closingKm" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "endDateTime" TIMESTAMP(3),
ADD COLUMN     "fyCode" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "openingKm" INTEGER,
ADD COLUMN     "rakeDate" TIMESTAMP(3),
ADD COLUMN     "startDateTime" TIMESTAMP(3),
ADD COLUMN     "tripName" TEXT NOT NULL,
ADD COLUMN     "tripNumber" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "consignorId" DROP NOT NULL,
ALTER COLUMN "isTripEmpty" SET DEFAULT false,
ALTER COLUMN "rateMatrixId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Planned',
ADD CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("id");

-- DropEnum
DROP TYPE "PaymentMode";

-- CreateIndex
CREATE INDEX "TripUnloadingPoint_vehicleTripId_idx" ON "TripUnloadingPoint"("vehicleTripId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrip_tripNumber_key" ON "VehicleTrip"("tripNumber");

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_rateMatrixId_fkey" FOREIGN KEY ("rateMatrixId") REFERENCES "RateMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStatusHistory" ADD CONSTRAINT "TripStatusHistory_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
