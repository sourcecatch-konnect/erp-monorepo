/*
  Warnings:

  - Changed the type of `currentKM` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `openingKM` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "currentKM",
ADD COLUMN     "currentKM" INTEGER NOT NULL,
DROP COLUMN "openingKM",
ADD COLUMN     "openingKM" INTEGER NOT NULL;
