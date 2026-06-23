/*
  Warnings:

  - You are about to drop the column `shortCode` on the `Branch` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Branch_shortCode_key";

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "shortCode";
