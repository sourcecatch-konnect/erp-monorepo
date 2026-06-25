-- AlterTable
ALTER TABLE "RailwayFreightMatrix" ADD COLUMN     "destinationAreaId" TEXT,
ADD COLUMN     "sourceAreaId" TEXT;

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_wagonType_idx" ON "RailwayFreightMatrix"("wagonType");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_sourceCityId_idx" ON "RailwayFreightMatrix"("sourceCityId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_destinationCityId_idx" ON "RailwayFreightMatrix"("destinationCityId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_sourceAreaId_idx" ON "RailwayFreightMatrix"("sourceAreaId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_destinationAreaId_idx" ON "RailwayFreightMatrix"("destinationAreaId");

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_sourceAreaId_fkey" FOREIGN KEY ("sourceAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_destinationAreaId_fkey" FOREIGN KEY ("destinationAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
