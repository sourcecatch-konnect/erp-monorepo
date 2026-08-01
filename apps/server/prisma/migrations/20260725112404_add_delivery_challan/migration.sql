-- CreateEnum
CREATE TYPE "DeliveryVehicleMode" AS ENUM ('OWN', 'MARKET', 'CLIENT_DELIVERY');

-- CreateEnum
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "transportId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "branchGrnId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "destinationAreaId" TEXT,
    "destinationLocationId" TEXT,
    "deliveryAddressSnapshot" TEXT,
    "vehicleMode" "DeliveryVehicleMode" NOT NULL,
    "transportId" TEXT,
    "vehicleId" TEXT,
    "transporterNameSnapshot" TEXT,
    "vehicleNumberSnapshot" TEXT,
    "vehicleTypeSnapshot" TEXT,
    "driverName" TEXT,
    "driverMobile" TEXT,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalWeight" DECIMAL(14,4),
    "freightAmount" BIGINT,
    "advanceAmount" BIGINT,
    "paymentBy" TEXT,
    "loadingAt" TIMESTAMP(3) NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" TEXT NOT NULL,
    "deliveryChallanId" TEXT NOT NULL,
    "branchGrnItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lrNumberSnapshot" TEXT NOT NULL,
    "consigneeNameSnapshot" TEXT,
    "goodsNameSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT,
    "deliveryAddressSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_challanNumber_key" ON "DeliveryChallan"("challanNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallan_branchGrnId_status_idx" ON "DeliveryChallan"("branchGrnId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_sourceBranchId_status_idx" ON "DeliveryChallan"("sourceBranchId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_destinationAreaId_idx" ON "DeliveryChallan"("destinationAreaId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_destinationLocationId_idx" ON "DeliveryChallan"("destinationLocationId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_transportId_idx" ON "DeliveryChallan"("transportId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_vehicleId_idx" ON "DeliveryChallan"("vehicleId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_loadingAt_idx" ON "DeliveryChallan"("loadingAt");

-- CreateIndex
CREATE INDEX "DeliveryChallan_fyCode_idx" ON "DeliveryChallan"("fyCode");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_branchGrnItemId_idx" ON "DeliveryChallanItem"("branchGrnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallanItem_deliveryChallanId_branchGrnItemId_key" ON "DeliveryChallanItem"("deliveryChallanId", "branchGrnItemId");

-- CreateIndex
CREATE INDEX "Vehicle_transportId_ownershipType_idx" ON "Vehicle"("transportId", "ownershipType");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_branchGrnId_fkey" FOREIGN KEY ("branchGrnId") REFERENCES "RailBranchGRN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_destinationAreaId_fkey" FOREIGN KEY ("destinationAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "CustomerLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_branchGrnItemId_fkey" FOREIGN KEY ("branchGrnItemId") REFERENCES "RailBranchGRNItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
