-- AlterTable
ALTER TABLE "LRGroup" ADD COLUMN     "marketTransportId" TEXT,
ADD COLUMN     "marketVehicleId" TEXT,
ADD COLUMN     "transportId" TEXT;

-- CreateIndex
CREATE INDEX "LRGroup_marketTransportId_idx" ON "LRGroup"("marketTransportId");

-- CreateIndex
CREATE INDEX "LRGroup_marketVehicleId_idx" ON "LRGroup"("marketVehicleId");

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_marketTransportId_fkey" FOREIGN KEY ("marketTransportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_marketVehicleId_fkey" FOREIGN KEY ("marketVehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
