/*
  Warnings:

  - You are about to drop the column `location` on the `TripUnloadingPoint` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleTripTripId` on the `TripUnloadingPoint` table. All the data in the column will be lost.
  - You are about to drop the column `loadingPoint` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `unloadingPoint` on the `VehicleTrip` table. All the data in the column will be lost.
  - Added the required column `vehicleTripId` to the `TripUnloadingPoint` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TripUnloadingPoint" DROP CONSTRAINT "TripUnloadingPoint_vehicleTripTripId_fkey";

-- AlterTable
ALTER TABLE "TripUnloadingPoint" DROP COLUMN "location",
DROP COLUMN "vehicleTripTripId",
ADD COLUMN     "unloadingLatitude" DECIMAL(65,30),
ADD COLUMN     "unloadingLongitude" DECIMAL(65,30),
ADD COLUMN     "vehicleTripId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleTrip" DROP COLUMN "loadingPoint",
DROP COLUMN "unloadingPoint",
ADD COLUMN     "loadingLatitude" DECIMAL(65,30),
ADD COLUMN     "loadingLongitude" DECIMAL(65,30),
ADD COLUMN     "unloadingLatitude" DECIMAL(65,30),
ADD COLUMN     "unloadingLongitude" DECIMAL(65,30);

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("tripId") ON DELETE RESTRICT ON UPDATE CASCADE;
