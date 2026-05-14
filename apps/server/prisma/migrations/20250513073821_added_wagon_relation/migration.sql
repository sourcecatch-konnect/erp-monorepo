/*
  Warnings:

  - You are about to drop the `Part` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Part" DROP CONSTRAINT "Part_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Part" DROP CONSTRAINT "Part_supplierId_fkey";

-- DropTable
DROP TABLE "Part";

-- CreateTable
CREATE TABLE "Wagon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Wagon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartType" NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "minimumStock" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "isRecyclable" BOOLEAN NOT NULL DEFAULT false,
    "isBatchTracked" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wagon_name_key" ON "Wagon"("name");

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_wagonType_fkey" FOREIGN KEY ("wagonType") REFERENCES "Wagon"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
