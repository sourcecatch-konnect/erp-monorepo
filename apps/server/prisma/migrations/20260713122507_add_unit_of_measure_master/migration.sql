/*
  Warnings:

  - You are about to alter the column `weight` on the `GRNGoods` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `weight` on the `LRGoods` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `totalWeight` on the `LorryReceipt` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `totalWeight` on the `OrderConsignment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `weight` on the `OrderConsignmentGoods` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.

*/
-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('WEIGHT', 'PACKAGING', 'COUNT', 'LENGTH', 'VOLUME');

-- AlterTable
ALTER TABLE "GRNGoods" ADD COLUMN     "quantityUnitId" TEXT,
ADD COLUMN     "weightUnitId" TEXT,
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "LRGoods" ADD COLUMN     "quantityUnitId" TEXT,
ADD COLUMN     "weightUnitId" TEXT,
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "LorryReceipt" ADD COLUMN     "weightUnitId" TEXT,
ALTER COLUMN "totalWeight" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "OrderConsignment" ADD COLUMN     "weightUnitId" TEXT,
ALTER COLUMN "totalWeight" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "OrderConsignmentGoods" ADD COLUMN     "quantityUnitId" TEXT,
ADD COLUMN     "weightUnitId" TEXT,
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(14,4);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "UnitCategory" NOT NULL,
    "conversionToBase" DECIMAL(14,6),
    "baseUnitCode" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_category_idx" ON "UnitOfMeasure"("category");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_isActive_idx" ON "UnitOfMeasure"("isActive");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_name_idx" ON "UnitOfMeasure"("name");

-- CreateIndex
CREATE INDEX "GRNGoods_quantityUnitId_idx" ON "GRNGoods"("quantityUnitId");

-- CreateIndex
CREATE INDEX "GRNGoods_weightUnitId_idx" ON "GRNGoods"("weightUnitId");

-- CreateIndex
CREATE INDEX "LRGoods_quantityUnitId_idx" ON "LRGoods"("quantityUnitId");

-- CreateIndex
CREATE INDEX "LRGoods_weightUnitId_idx" ON "LRGoods"("weightUnitId");

-- CreateIndex
CREATE INDEX "LorryReceipt_weightUnitId_idx" ON "LorryReceipt"("weightUnitId");

-- CreateIndex
CREATE INDEX "OrderConsignment_weightUnitId_idx" ON "OrderConsignment"("weightUnitId");

-- CreateIndex
CREATE INDEX "OrderConsignmentGoods_quantityUnitId_idx" ON "OrderConsignmentGoods"("quantityUnitId");

-- CreateIndex
CREATE INDEX "OrderConsignmentGoods_weightUnitId_idx" ON "OrderConsignmentGoods"("weightUnitId");

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_quantityUnitId_fkey" FOREIGN KEY ("quantityUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGoods" ADD CONSTRAINT "LRGoods_quantityUnitId_fkey" FOREIGN KEY ("quantityUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGoods" ADD CONSTRAINT "LRGoods_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNGoods" ADD CONSTRAINT "GRNGoods_quantityUnitId_fkey" FOREIGN KEY ("quantityUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNGoods" ADD CONSTRAINT "GRNGoods_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
