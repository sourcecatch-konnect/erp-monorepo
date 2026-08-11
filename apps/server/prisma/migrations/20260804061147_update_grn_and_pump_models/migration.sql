/*
  Warnings:

  - You are about to drop the column `accountName` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `branchIfscCode` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `contactName` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `contactPhone` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `gstIn` on the `Pump` table. All the data in the column will be lost.
  - Added the required column `labourCount` to the `GRN` table without a default value. This is not possible if the table is not empty.
  - Made the column `gateNo` on table `GRN` required. This step will fail if there are existing NULL values in that column.

*/
-- Add the new column as nullable so existing GRNs remain valid while
-- historical rows are backfilled.
ALTER TABLE "GRN" ADD COLUMN "labourCount" INTEGER;

-- Historical GRNs did not record these required values. Use a safe legacy
-- fallback before enforcing the final non-null schema.
UPDATE "GRN"
SET "labourCount" = 1
WHERE "labourCount" IS NULL;

UPDATE "GRN"
SET "gateNo" = '1'
WHERE "gateNo" IS NULL OR BTRIM("gateNo") = '';

-- Match the final Prisma model after every existing row has a value.
ALTER TABLE "GRN"
ALTER COLUMN "labourCount" SET NOT NULL,
ALTER COLUMN "gateNo" SET NOT NULL;

-- AlterTable
ALTER TABLE "Pump" DROP COLUMN "accountName",
DROP COLUMN "bankName",
DROP COLUMN "branchIfscCode",
DROP COLUMN "contactName",
DROP COLUMN "contactPhone",
DROP COLUMN "gstIn";
