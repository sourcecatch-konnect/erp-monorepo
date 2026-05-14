/*
  Warnings:

  - You are about to drop the column `distanceCovered` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `loadingLatitude` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `loadingLongitude` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `totalDistance` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `tripNature` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `unloadingLatitude` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `unloadingLongitude` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleEndKM` on the `VehicleTrip` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "VehicleTrip" DROP COLUMN "distanceCovered",
DROP COLUMN "loadingLatitude",
DROP COLUMN "loadingLongitude",
DROP COLUMN "totalDistance",
DROP COLUMN "tripNature",
DROP COLUMN "unloadingLatitude",
DROP COLUMN "unloadingLongitude",
DROP COLUMN "vehicleEndKM",
ALTER COLUMN "paymentMode" DROP NOT NULL;

-- DropEnum
DROP TYPE "TripNature";
