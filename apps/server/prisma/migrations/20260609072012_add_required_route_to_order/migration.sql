-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "routeId" TEXT;

-- CreateIndex
CREATE INDEX "Order_routeId_idx" ON "Order"("routeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
