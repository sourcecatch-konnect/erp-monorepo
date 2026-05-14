/*
  Warnings:

  - You are about to drop the column `createLogin` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `creditDays` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `disallowedBranches` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "createLogin",
DROP COLUMN "creditDays",
DROP COLUMN "disallowedBranches";
