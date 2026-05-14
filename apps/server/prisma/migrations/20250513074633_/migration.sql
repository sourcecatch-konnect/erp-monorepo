/*
  Warnings:

  - You are about to drop the `Worker` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Worker" DROP CONSTRAINT "Worker_branchId_fkey";

-- DropTable
DROP TABLE "Worker";

-- CreateTable
CREATE TABLE "Labour" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "photoPath" TEXT,
    "address" TEXT,
    "city" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "mobileNo" TEXT,
    "referredBy" TEXT,
    "refContactNo" TEXT,
    "startDate" TIMESTAMP(3),
    "pan" TEXT,
    "tdsAmount" DOUBLE PRECISION,
    "tdsRate" DOUBLE PRECISION,
    "type" "WorkerType" NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labour_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
