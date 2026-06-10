/*
  Warnings:

  - A unique constraint covering the columns `[agreementId,routeId,vehicleTypeId,unitId,transportType]` on the table `RateMatrix` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RateUnitType" AS ENUM ('HQ', 'LQ');

-- CreateEnum
CREATE TYPE "RateTransportType" AS ENUM ('RAIL_ROAD', 'ROAD');

-- DropIndex
DROP INDEX "RateMatrix_agreementId_routeId_vehicleTypeId_key";

-- AlterTable
ALTER TABLE "RateMatrix" ADD COLUMN     "transportType" "RateTransportType" NOT NULL DEFAULT 'ROAD',
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "VehicleType" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RateUnit" (
    "id" TEXT NOT NULL,
    "unitValue" INTEGER NOT NULL,
    "unitType" "RateUnitType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateUnit_unitValue_unitType_key" ON "RateUnit"("unitValue", "unitType");

-- CreateIndex
CREATE UNIQUE INDEX "RateMatrix_agreementId_routeId_vehicleTypeId_unitId_transpo_key" ON "RateMatrix"("agreementId", "routeId", "vehicleTypeId", "unitId", "transportType");

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RateUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
