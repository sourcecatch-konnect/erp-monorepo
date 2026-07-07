-- DropForeignKey
ALTER TABLE "GRN" DROP CONSTRAINT "GRN_unloadingSupervisorId_fkey";

-- AlterTable
ALTER TABLE "GRN" ADD COLUMN     "labourName" TEXT;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_unloadingSupervisorId_fkey" FOREIGN KEY ("unloadingSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
