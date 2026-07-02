/*
  Warnings:

  - A unique constraint covering the columns `[journeyId,sequenceNo]` on the table `VehicleTrip` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VehicleJourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETURNED', 'READY_FOR_LOGSLIP', 'SETTLED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JourneySettlementStatus" AS ENUM ('NOT_READY', 'PENDING_REVIEW', 'READY', 'GENERATED', 'POSTED', 'TALLY_SYNCED');

-- CreateEnum
CREATE TYPE "TripLegType" AS ENUM ('LR', 'DC', 'EMPTY', 'LOCAL', 'RETURN', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "TripPaymentMode" AS ENUM ('CASH', 'BANK', 'CARD', 'UPI', 'CREDIT');

-- CreateEnum
CREATE TYPE "TripExpenseType" AS ENUM ('DIESEL', 'TOLL', 'PARKING', 'FOOD', 'REPAIR', 'FINE', 'LOADING', 'UNLOADING', 'MISC');

-- CreateEnum
CREATE TYPE "TripExpenseStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DriverAdvanceStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LogSlipStatus" AS ENUM ('DRAFT', 'GENERATED', 'POSTED_TO_ACCOUNTS', 'TALLY_SYNCED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogSlipLineType" AS ENUM ('TRIP_FREIGHT', 'ADVANCE', 'DIESEL', 'EXPENSE', 'DRIVER_SETTLEMENT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "TripUnloadingPoint" ADD COLUMN     "actualArrivalAt" TIMESTAMP(3),
ADD COLUMN     "actualDepartureAt" TIMESTAMP(3),
ADD COLUMN     "actualUnloadingAt" TIMESTAMP(3),
ADD COLUMN     "damageQty" INTEGER,
ADD COLUMN     "receivedQty" INTEGER,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "shortageQty" INTEGER;

-- AlterTable
ALTER TABLE "VehicleTrip" ADD COLUMN     "arrivalDateTime" TIMESTAMP(3),
ADD COLUMN     "chainExceptionReason" TEXT,
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "fromCityId" TEXT,
ADD COLUMN     "isReturnLeg" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "journeyId" TEXT,
ADD COLUMN     "legType" "TripLegType",
ADD COLUMN     "sequenceNo" INTEGER,
ADD COLUMN     "toCityId" TEXT,
ADD COLUMN     "unloadingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VehicleJourney" (
    "id" TEXT NOT NULL,
    "journeyNumber" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "homeBranchId" TEXT NOT NULL,
    "startCityId" TEXT NOT NULL,
    "returnCityId" TEXT NOT NULL,
    "currentCityId" TEXT NOT NULL,
    "openingKm" INTEGER NOT NULL,
    "closingKm" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "status" "VehicleJourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "settlementStatus" "JourneySettlementStatus" NOT NULL DEFAULT 'NOT_READY',
    "closeReason" TEXT,
    "cancelReason" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VehicleJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripExpense" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "tripId" TEXT,
    "expenseType" "TripExpenseType" NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "paymentMode" "TripPaymentMode" NOT NULL,
    "cityId" TEXT,
    "pumpId" TEXT,
    "dieselQty" DOUBLE PRECISION,
    "dieselRatePaise" BIGINT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "receiptNo" TEXT,
    "paidByDriver" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "status" "TripExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TripExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAdvance" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "tripId" TEXT,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "paymentMode" "TripPaymentMode" NOT NULL,
    "cashAccountId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "status" "DriverAdvanceStatus" NOT NULL DEFAULT 'POSTED',
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogSlip" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "logSlipNumber" TEXT,
    "fyCode" TEXT NOT NULL,
    "logSlipDate" TIMESTAMP(3) NOT NULL,
    "status" "LogSlipStatus" NOT NULL DEFAULT 'DRAFT',
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "openingKm" INTEGER NOT NULL,
    "closingKm" INTEGER NOT NULL,
    "totalKm" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "totalFreightPaise" BIGINT NOT NULL DEFAULT 0,
    "totalAdvancePaise" BIGINT NOT NULL DEFAULT 0,
    "totalDieselQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDieselAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "totalCashExpensePaise" BIGINT NOT NULL DEFAULT 0,
    "totalCreditExpensePaise" BIGINT NOT NULL DEFAULT 0,
    "totalExpensePaise" BIGINT NOT NULL DEFAULT 0,
    "netVehicleResultPaise" BIGINT NOT NULL DEFAULT 0,
    "driverCashExpensePaise" BIGINT NOT NULL DEFAULT 0,
    "driverReceivablePaise" BIGINT NOT NULL DEFAULT 0,
    "driverPayablePaise" BIGINT NOT NULL DEFAULT 0,
    "previousDieselQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dieselRatePaise" BIGINT,
    "standardAverage" DOUBLE PRECISION,
    "actualAverage" DOUBLE PRECISION,
    "expectedDieselQty" DOUBLE PRECISION,
    "shortDieselQty" DOUBLE PRECISION,
    "remarks" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "postedJournalEntryId" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LogSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogSlipLine" (
    "id" TEXT NOT NULL,
    "logSlipId" TEXT NOT NULL,
    "lineType" "LogSlipLineType" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "ratePaise" BIGINT,
    "amountPaise" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "LogSlipLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleJourney_journeyNumber_key" ON "VehicleJourney"("journeyNumber");

-- CreateIndex
CREATE INDEX "VehicleJourney_vehicleId_status_idx" ON "VehicleJourney"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "VehicleJourney_driverId_status_idx" ON "VehicleJourney"("driverId", "status");

-- CreateIndex
CREATE INDEX "VehicleJourney_fyCode_idx" ON "VehicleJourney"("fyCode");

-- CreateIndex
CREATE INDEX "VehicleJourney_homeBranchId_idx" ON "VehicleJourney"("homeBranchId");

-- CreateIndex
CREATE INDEX "VehicleJourney_settlementStatus_idx" ON "VehicleJourney"("settlementStatus");

-- CreateIndex
CREATE INDEX "VehicleJourney_status_idx" ON "VehicleJourney"("status");

-- CreateIndex
CREATE INDEX "TripExpense_journeyId_idx" ON "TripExpense"("journeyId");

-- CreateIndex
CREATE INDEX "TripExpense_tripId_idx" ON "TripExpense"("tripId");

-- CreateIndex
CREATE INDEX "TripExpense_status_idx" ON "TripExpense"("status");

-- CreateIndex
CREATE INDEX "DriverAdvance_journeyId_idx" ON "DriverAdvance"("journeyId");

-- CreateIndex
CREATE INDEX "DriverAdvance_driverId_idx" ON "DriverAdvance"("driverId");

-- CreateIndex
CREATE INDEX "DriverAdvance_status_idx" ON "DriverAdvance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LogSlip_journeyId_key" ON "LogSlip"("journeyId");

-- CreateIndex
CREATE UNIQUE INDEX "LogSlip_logSlipNumber_key" ON "LogSlip"("logSlipNumber");

-- CreateIndex
CREATE INDEX "LogSlip_status_idx" ON "LogSlip"("status");

-- CreateIndex
CREATE INDEX "LogSlip_fyCode_idx" ON "LogSlip"("fyCode");

-- CreateIndex
CREATE INDEX "LogSlipLine_logSlipId_idx" ON "LogSlipLine"("logSlipId");

-- CreateIndex
CREATE INDEX "VehicleTrip_journeyId_idx" ON "VehicleTrip"("journeyId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrip_journeyId_sequenceNo_key" ON "VehicleTrip"("journeyId", "sequenceNo");

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "VehicleJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_startCityId_fkey" FOREIGN KEY ("startCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_returnCityId_fkey" FOREIGN KEY ("returnCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_currentCityId_fkey" FOREIGN KEY ("currentCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleJourney" ADD CONSTRAINT "VehicleJourney_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "VehicleJourney"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "VehicleJourney"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAdvance" ADD CONSTRAINT "DriverAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSlip" ADD CONSTRAINT "LogSlip_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "VehicleJourney"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSlip" ADD CONSTRAINT "LogSlip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSlip" ADD CONSTRAINT "LogSlip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSlip" ADD CONSTRAINT "LogSlip_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSlipLine" ADD CONSTRAINT "LogSlipLine_logSlipId_fkey" FOREIGN KEY ("logSlipId") REFERENCES "LogSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
