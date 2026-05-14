/*
  Warnings:

  - You are about to drop the column `billFormat` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `lrFormat` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "billFormat",
DROP COLUMN "lrFormat";
