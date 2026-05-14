/*
  Warnings:

  - You are about to drop the column `goodsId` on the `OrderBooking` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceExpiry` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `registrationDate` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the `Truck` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[chasisNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[engineNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `capacityMT` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chasisNumber` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engineNumber` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownershipType` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `vehicleType` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ownershipType" AS ENUM ('Own_Vehicle', 'Market_Vehicle');

-- CreateEnum
CREATE TYPE "vehicleType" AS ENUM ('Container', 'Open_Body', 'TATA_407', 'DCM_Lorry', 'DI_Pickup');

-- DropForeignKey
ALTER TABLE "OrderBooking" DROP CONSTRAINT "OrderBooking_goodsId_fkey";

-- AlterTable
ALTER TABLE "OrderBooking" DROP COLUMN "goodsId";

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "capacity",
DROP COLUMN "insuranceExpiry",
DROP COLUMN "registrationDate",
ADD COLUMN     "bodyType" TEXT,
ADD COLUMN     "capacityMT" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "chasisNumber" TEXT NOT NULL,
ADD COLUMN     "engineNumber" TEXT NOT NULL,
ADD COLUMN     "insuranceCompany" TEXT,
ADD COLUMN     "insuranceDueDate" TIMESTAMP(3),
ADD COLUMN     "insuranceIssueDate" TIMESTAMP(3),
ADD COLUMN     "insuranceNumber" TEXT,
ADD COLUMN     "lengthFeet" TEXT,
ADD COLUMN     "ownershipType" "ownershipType" NOT NULL,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "wheels" TEXT,
DROP COLUMN "vehicleType",
ADD COLUMN     "vehicleType" "vehicleType" NOT NULL;

-- DropTable
DROP TABLE "Truck";

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chasisNumber_key" ON "Vehicle"("chasisNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_engineNumber_key" ON "Vehicle"("engineNumber");
