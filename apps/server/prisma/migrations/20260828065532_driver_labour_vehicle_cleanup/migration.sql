/*
  Warnings:

  - You are about to drop the column `alternateMobile` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `bloodGroup` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `correspondenceAddress` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `correspondenceCity` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `correspondenceCountry` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `correspondenceLandline` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `correspondenceState` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `noTDSApplyAmount` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `permanentAddress` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `permanentCity` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `permanentCountry` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `permanentState` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `tdsRate` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `tdsAmount` on the `Labour` table. All the data in the column will be lost.
  - You are about to drop the column `tdsRate` on the `Labour` table. All the data in the column will be lost.
  - You are about to drop the column `chasisNumber` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `engineNumber` on the `Vehicle` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Vehicle_chasisNumber_key";

-- DropIndex
DROP INDEX "Vehicle_engineNumber_key";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "alternateMobile",
DROP COLUMN "bloodGroup",
DROP COLUMN "correspondenceAddress",
DROP COLUMN "correspondenceCity",
DROP COLUMN "correspondenceCountry",
DROP COLUMN "correspondenceLandline",
DROP COLUMN "correspondenceState",
DROP COLUMN "noTDSApplyAmount",
DROP COLUMN "permanentAddress",
DROP COLUMN "permanentCity",
DROP COLUMN "permanentCountry",
DROP COLUMN "permanentState",
DROP COLUMN "tdsRate",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "licenseNo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Labour" DROP COLUMN "tdsAmount",
DROP COLUMN "tdsRate";

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "chasisNumber",
DROP COLUMN "engineNumber";
