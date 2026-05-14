/*
  Warnings:

  - You are about to drop the column `description` on the `City` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `City` table. All the data in the column will be lost.
  - Added the required column `stateId` to the `City` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "City" DROP COLUMN "description",
DROP COLUMN "state",
ADD COLUMN     "stateId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
