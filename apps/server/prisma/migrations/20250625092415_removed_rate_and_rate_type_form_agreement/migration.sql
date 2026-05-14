/*
  Warnings:

  - You are about to drop the column `rate` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `rateType` on the `Agreement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "rate",
DROP COLUMN "rateType";
