/*
  Warnings:

  - You are about to drop the column `vpScheduleId` on the `GRN` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GRN" DROP CONSTRAINT "GRN_vpScheduleId_fkey";

-- DropIndex
DROP INDEX "GRN_vpScheduleId_idx";

-- AlterTable
ALTER TABLE "GRN" DROP COLUMN "vpScheduleId";
