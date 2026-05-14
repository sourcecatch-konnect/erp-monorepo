/*
  Warnings:

  - You are about to drop the column `destinationCity` on the `VehicleTrip` table. All the data in the column will be lost.
  - You are about to drop the column `sourceCity` on the `VehicleTrip` table. All the data in the column will be lost.
  - Added the required column `currentKM` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `openingKM` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rateMatrixId` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `routeId` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalDistance` to the `VehicleTrip` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('planned', 'in_transit', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "currentKM" TEXT NOT NULL,
ADD COLUMN     "openingKM" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VehicleTrip" DROP COLUMN "destinationCity",
DROP COLUMN "sourceCity",
ADD COLUMN     "rateMatrixId" TEXT NOT NULL,
ADD COLUMN     "routeId" TEXT NOT NULL,
ADD COLUMN     "status" "TripStatus" NOT NULL,
ADD COLUMN     "totalDistance" TEXT NOT NULL,
ALTER COLUMN "endDateTime" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_rateMatrixId_fkey" FOREIGN KEY ("rateMatrixId") REFERENCES "RateMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
