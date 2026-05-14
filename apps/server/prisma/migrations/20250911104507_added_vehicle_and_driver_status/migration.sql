/*
  Warnings:

  - The values [Partial_Stop,Multi_Stop] on the enum `TripType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `totalGoodsQuantity` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tripNature` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "TripNature" AS ENUM ('Direct_Route', 'MultiStop_Route');

-- AlterEnum
BEGIN;
CREATE TYPE "TripType_new" AS ENUM ('lr', 'dc');
ALTER TABLE "VehicleTrip" ALTER COLUMN "tripType" TYPE "TripType_new" USING ("tripType"::text::"TripType_new");
ALTER TYPE "TripType" RENAME TO "TripType_old";
ALTER TYPE "TripType_new" RENAME TO "TripType";
DROP TYPE "TripType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "VehicleTrip" ADD COLUMN     "totalGoodsQuantity" INTEGER NOT NULL,
ADD COLUMN     "tripNature" "TripNature" NOT NULL;
