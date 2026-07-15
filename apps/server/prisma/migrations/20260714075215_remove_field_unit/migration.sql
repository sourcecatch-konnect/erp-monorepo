/*
  Warnings:

  - You are about to drop the column `baseUnitCode` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `conversionToBase` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `UnitOfMeasure` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UnitOfMeasure" DROP COLUMN "baseUnitCode",
DROP COLUMN "conversionToBase",
DROP COLUMN "description";
