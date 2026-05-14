/*
  Warnings:

  - You are about to drop the column `endDateTime` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `startDateTime` on the `VehicleTrip` table. All the data in the column will be lost.
  - Added the required column `onwardFreight` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tripType` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleStartKM` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMode` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `totalDistance` on the `VehicleTrip` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('Partial_Stop', 'Multi_Stop');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'ONLINE', 'CHEQUE');

-- AlterTable
ALTER TABLE "VehicleTrip" DROP COLUMN "endDateTime",
DROP COLUMN "startDateTime",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "distanceCovered" INTEGER,
ADD COLUMN     "loadingPoint" TEXT,
ADD COLUMN     "onwardFreight" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "tripType" "TripType" NOT NULL,
ADD COLUMN     "unloadingPoint" TEXT,
ADD COLUMN     "vehicleEndKM" INTEGER,
ADD COLUMN     "vehicleStartKM" INTEGER NOT NULL,
DROP COLUMN "paymentMode",
ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL,
DROP COLUMN "totalDistance",
ADD COLUMN     "totalDistance" DECIMAL(65,30) NOT NULL;

-- CreateTable
CREATE TABLE "TripUnloadingPoint" (
    "id" TEXT NOT NULL,
    "vehicleTripTripId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "TripUnloadingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStatusHistory" (
    "id" TEXT NOT NULL,
    "vehicleTripId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TripStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleTrip_status_idx" ON "VehicleTrip"("status");

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_vehicleTripTripId_fkey" FOREIGN KEY ("vehicleTripTripId") REFERENCES "VehicleTrip"("tripId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStatusHistory" ADD CONSTRAINT "TripStatusHistory_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("tripId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStatusHistory" ADD CONSTRAINT "TripStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
