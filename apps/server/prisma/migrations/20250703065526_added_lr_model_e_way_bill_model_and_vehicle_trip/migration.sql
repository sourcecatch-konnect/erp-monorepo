-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('Road', 'Rail');

-- CreateEnum
CREATE TYPE "LRPriority" AS ENUM ('Critical', 'Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "LRstatus" AS ENUM ('draft', 'generated', 'trip_attached', 'finalised', 'in_transit', 'delivered', 'closed', 'cancelled');

-- AlterTable
ALTER TABLE "Goods" ADD COLUMN     "lorryReceiptId" TEXT;

-- CreateTable
CREATE TABLE "LorryReceipt" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "isPodUploaded" BOOLEAN NOT NULL,
    "isInvoiceGenerated" BOOLEAN NOT NULL,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "invoiceNo" TEXT,
    "invoiceValue" DECIMAL(65,30),
    "tripId" TEXT NOT NULL,
    "transportType" "TransportType" NOT NULL,
    "priority" "LRPriority" NOT NULL,
    "lrStatus" "LRstatus" NOT NULL,

    CONSTRAINT "LorryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EwayBill" (
    "ewaybill_no" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,

    CONSTRAINT "EwayBill_pkey" PRIMARY KEY ("ewaybill_no")
);

-- CreateTable
CREATE TABLE "VehicleTrip" (
    "tripId" TEXT NOT NULL,
    "sourceCity" TEXT NOT NULL,
    "destinationCity" TEXT NOT NULL,
    "consignorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "isTripEmpty" BOOLEAN NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripAddedById" TEXT NOT NULL,
    "advancePayment" DECIMAL(65,30),
    "paymentMode" TEXT,
    "description" TEXT,

    CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("tripId")
);

-- AddForeignKey
ALTER TABLE "Goods" ADD CONSTRAINT "Goods_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("tripId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EwayBill" ADD CONSTRAINT "EwayBill_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_tripAddedById_fkey" FOREIGN KEY ("tripAddedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
