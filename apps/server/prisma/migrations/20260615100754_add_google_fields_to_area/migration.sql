/*
  Warnings:

  - A unique constraint covering the columns `[cityId,name]` on the table `Area` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googlePlaceId]` on the table `Area` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "formattedAddress" TEXT,
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Area_cityId_name_key" ON "Area"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Area_googlePlaceId_key" ON "Area"("googlePlaceId");
