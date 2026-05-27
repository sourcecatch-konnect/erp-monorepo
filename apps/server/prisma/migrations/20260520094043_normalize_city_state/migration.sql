/*
  Warnings:

  - You are about to drop the column `city` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Branch` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Labour` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Transport` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Transport` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Warehouse` table. All the data in the column will be lost.
  - Added the required column `cityId` to the `Agreement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stateId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Labour` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stateId` to the `Pump` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Transport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stateId` to the `Transport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Warehouse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stateId` to the `Warehouse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "city",
ADD COLUMN     "cityId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "city",
ADD COLUMN     "cityId" TEXT;

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "city",
DROP COLUMN "state",
ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "stateId" TEXT;

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "city",
DROP COLUMN "state",
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "stateId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Labour" DROP COLUMN "city",
ADD COLUMN     "cityId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pump" DROP COLUMN "state",
ADD COLUMN     "stateId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transport" DROP COLUMN "city",
DROP COLUMN "state",
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "stateId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Warehouse" DROP COLUMN "city",
DROP COLUMN "state",
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "stateId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
