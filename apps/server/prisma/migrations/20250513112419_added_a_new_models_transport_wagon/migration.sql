/*
  Warnings:

  - The primary key for the `Agreement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Branch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `City` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Company` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Customer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Driver` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Goods` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Labour` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Pump` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RailwayFreightMatrix` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Role` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SpareCategory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SparePart` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SparePartSupplier` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Truck` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Warehouse` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_leadGeneratedByBranchId_fkey";

-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Labour" DROP CONSTRAINT "Labour_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Pump" DROP CONSTRAINT "Pump_cityId_fkey";

-- DropForeignKey
ALTER TABLE "RailwayFreightMatrix" DROP CONSTRAINT "RailwayFreightMatrix_destinationCityId_fkey";

-- DropForeignKey
ALTER TABLE "RailwayFreightMatrix" DROP CONSTRAINT "RailwayFreightMatrix_sourceCityId_fkey";

-- DropForeignKey
ALTER TABLE "SparePart" DROP CONSTRAINT "SparePart_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "SparePart" DROP CONSTRAINT "SparePart_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "SparePartSupplier" DROP CONSTRAINT "SparePartSupplier_cityId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_branchId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_branchId_fkey";

-- AlterTable
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "clientId" SET DATA TYPE TEXT,
ALTER COLUMN "leadGeneratedByBranchId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Agreement_id_seq";

-- AlterTable
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "warehouseId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Branch_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Branch_id_seq";

-- AlterTable
ALTER TABLE "City" DROP CONSTRAINT "City_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "City_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "City_id_seq";

-- AlterTable
ALTER TABLE "Company" DROP CONSTRAINT "Company_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Company_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Company_id_seq";

-- AlterTable
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Customer_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Customer_id_seq";

-- AlterTable
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Driver_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Driver_id_seq";

-- AlterTable
ALTER TABLE "Goods" DROP CONSTRAINT "Goods_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Goods_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Goods_id_seq";

-- AlterTable
ALTER TABLE "Labour" DROP CONSTRAINT "Labour_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "branchId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Labour_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Labour_id_seq";

-- AlterTable
ALTER TABLE "Pump" DROP CONSTRAINT "Pump_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "cityId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Pump_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Pump_id_seq";

-- AlterTable
ALTER TABLE "RailwayFreightMatrix" DROP CONSTRAINT "RailwayFreightMatrix_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sourceCityId" SET DATA TYPE TEXT,
ALTER COLUMN "destinationCityId" SET DATA TYPE TEXT,
ADD CONSTRAINT "RailwayFreightMatrix_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RailwayFreightMatrix_id_seq";

-- AlterTable
ALTER TABLE "Role" DROP CONSTRAINT "Role_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Role_id_seq";

-- AlterTable
ALTER TABLE "SpareCategory" DROP CONSTRAINT "SpareCategory_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "SpareCategory_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SpareCategory_id_seq";

-- AlterTable
ALTER TABLE "SparePart" DROP CONSTRAINT "SparePart_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "categoryId" SET DATA TYPE TEXT,
ALTER COLUMN "supplierId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SparePart_id_seq";

-- AlterTable
ALTER TABLE "SparePartSupplier" DROP CONSTRAINT "SparePartSupplier_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "cityId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SparePartSupplier_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SparePartSupplier_id_seq";

-- AlterTable
ALTER TABLE "Truck" DROP CONSTRAINT "Truck_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Truck_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Truck_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "branchId" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- AlterTable
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "branchId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Warehouse_id_seq";

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phoneNo" TEXT NOT NULL,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transport_phoneNo_key" ON "Transport"("phoneNo");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_leadGeneratedByBranchId_fkey" FOREIGN KEY ("leadGeneratedByBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_sourceCityId_fkey" FOREIGN KEY ("sourceCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartSupplier" ADD CONSTRAINT "SparePartSupplier_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
