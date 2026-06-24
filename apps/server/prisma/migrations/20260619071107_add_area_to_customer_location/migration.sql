-- AlterTable
ALTER TABLE "CustomerLocation" ADD COLUMN     "areaId" TEXT;

-- CreateIndex
CREATE INDEX "CustomerLocation_areaId_idx" ON "CustomerLocation"("areaId");

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
