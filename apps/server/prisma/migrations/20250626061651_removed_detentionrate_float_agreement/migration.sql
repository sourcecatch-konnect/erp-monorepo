/*
  Warnings:

  - You are about to drop the column `agreementCommittedTrips` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `applyRateCommittedBusinessMissed` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `detentionRate` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `rateInclusiveTax` on the `Agreement` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DetentionRateType" AS ENUM ('DAY', 'HOUR');

-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "agreementCommittedTrips",
DROP COLUMN "applyRateCommittedBusinessMissed",
DROP COLUMN "detentionRate",
DROP COLUMN "rateInclusiveTax";

-- CreateTable
CREATE TABLE "DetentionRate" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "type" "DetentionRateType" NOT NULL,
    "fromDuration" INTEGER NOT NULL,
    "toDuration" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetentionRate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DetentionRate" ADD CONSTRAINT "DetentionRate_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
