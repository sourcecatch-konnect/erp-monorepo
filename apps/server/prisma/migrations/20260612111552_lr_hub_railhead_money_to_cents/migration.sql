-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "isHeadOffice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "interestRateLatePayment" SET DATA TYPE BIGINT,
ALTER COLUMN "creditLimit" SET DATA TYPE BIGINT,
ALTER COLUMN "tdsDeductionRate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Driver" ALTER COLUMN "salary" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "LRCharge" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Labour" ALTER COLUMN "tdsAmount" SET DATA TYPE BIGINT,
ALTER COLUMN "tdsRate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "LorryReceipt" ADD COLUMN     "railheadBranchId" TEXT,
ALTER COLUMN "invoiceAmount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "bookingFreightAmount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Pump" ALTER COLUMN "creditLimit" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "RailwayFreightMatrix" ALTER COLUMN "freightAmount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "RateMatrix" ALTER COLUMN "rate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "RateUnit" ALTER COLUMN "unitValue" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "SparePart" ALTER COLUMN "rate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "VehicleTrip" ALTER COLUMN "onwardFreight" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Warehouse" ALTER COLUMN "monthlyRent" SET DATA TYPE BIGINT,
ALTER COLUMN "securityDeposit" SET DATA TYPE BIGINT;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_railheadBranchId_fkey" FOREIGN KEY ("railheadBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
