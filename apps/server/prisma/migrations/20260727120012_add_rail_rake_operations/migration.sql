-- CreateEnum
CREATE TYPE "RailRakeOperationStage" AS ENUM ('ORIGIN_RAILHEAD', 'DESTINATION_BRANCH');

-- CreateEnum
CREATE TYPE "RailRakeOperationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RailRakeChargeType" AS ENUM ('DEMURRAGE', 'WHARFAGE');

-- CreateEnum
CREATE TYPE "RailRakeChargeStatus" AS ENUM ('DRAFT', 'ASSESSED', 'PARTIALLY_SETTLED', 'SETTLED', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RailRakeWaiverStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RailRakePaymentKind" AS ENUM ('CHARGE_PAYMENT', 'WAIVER_RECEIPT');

-- CreateEnum
CREATE TYPE "RailRakePaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RailRakeChargeParty" AS ENUM ('COMPANY', 'CUSTOMER', 'RAILWAY', 'TRANSPORTER', 'OTHER');

-- CreateTable
CREATE TABLE "RailRakeOperation" (
    "id" TEXT NOT NULL,
    "railRakeId" TEXT NOT NULL,
    "stage" "RailRakeOperationStage" NOT NULL,
    "branchId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "arrivalAt" TIMESTAMP(3),
    "departureAt" TIMESTAMP(3),
    "status" "RailRakeOperationStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRakeOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailRakePlacement" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "freeMinutes" INTEGER,
    "chargeableMinutes" INTEGER,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "calculationCode" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRakePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailRakeCharge" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "type" "RailRakeChargeType" NOT NULL,
    "status" "RailRakeChargeStatus" NOT NULL DEFAULT 'DRAFT',
    "actualMinutes" INTEGER,
    "freeMinutes" INTEGER,
    "chargeableMinutes" INTEGER,
    "ratePerHour" BIGINT,
    "grossAmount" BIGINT NOT NULL DEFAULT 0,
    "approvedWaiverAmount" BIGINT NOT NULL DEFAULT 0,
    "netPayableAmount" BIGINT NOT NULL DEFAULT 0,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "balanceAmount" BIGINT NOT NULL DEFAULT 0,
    "chargeLetterDate" TIMESTAMP(3),
    "paymentBy" "RailRakeChargeParty",
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "calculationCode" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRakeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailRakeChargeWaiver" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "RailRakeWaiverStatus" NOT NULL DEFAULT 'REQUESTED',
    "letterGivenAt" TIMESTAMP(3),
    "letterApprovedAt" TIMESTAMP(3),
    "letterReceivedAt" TIMESTAMP(3),
    "waiverPercentage" DECIMAL(5,2),
    "requestedAmount" BIGINT,
    "approvedAmount" BIGINT,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRakeChargeWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailRakeChargePayment" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "kind" "RailRakePaymentKind" NOT NULL,
    "status" "RailRakePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "paymentBy" "RailRakeChargeParty" NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentAt" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailRakeChargePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RailRakeOperation_branchId_status_idx" ON "RailRakeOperation"("branchId", "status");

-- CreateIndex
CREATE INDEX "RailRakeOperation_stage_status_idx" ON "RailRakeOperation"("stage", "status");

-- CreateIndex
CREATE INDEX "RailRakeOperation_createdAt_idx" ON "RailRakeOperation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RailRakeOperation_railRakeId_stage_key" ON "RailRakeOperation"("railRakeId", "stage");

-- CreateIndex
CREATE INDEX "RailRakePlacement_operationId_idx" ON "RailRakePlacement"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "RailRakePlacement_operationId_sequence_key" ON "RailRakePlacement"("operationId", "sequence");

-- CreateIndex
CREATE INDEX "RailRakeCharge_operationId_idx" ON "RailRakeCharge"("operationId");

-- CreateIndex
CREATE INDEX "RailRakeCharge_status_idx" ON "RailRakeCharge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RailRakeCharge_operationId_type_key" ON "RailRakeCharge"("operationId", "type");

-- CreateIndex
CREATE INDEX "RailRakeChargeWaiver_chargeId_status_idx" ON "RailRakeChargeWaiver"("chargeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RailRakeChargeWaiver_chargeId_sequence_key" ON "RailRakeChargeWaiver"("chargeId", "sequence");

-- CreateIndex
CREATE INDEX "RailRakeChargePayment_chargeId_status_idx" ON "RailRakeChargePayment"("chargeId", "status");

-- CreateIndex
CREATE INDEX "RailRakeChargePayment_paymentAt_idx" ON "RailRakeChargePayment"("paymentAt");

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_railRakeId_fkey" FOREIGN KEY ("railRakeId") REFERENCES "RailRake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeOperation" ADD CONSTRAINT "RailRakeOperation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakePlacement" ADD CONSTRAINT "RailRakePlacement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "RailRakeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeCharge" ADD CONSTRAINT "RailRakeCharge_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "RailRakeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeCharge" ADD CONSTRAINT "RailRakeCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeCharge" ADD CONSTRAINT "RailRakeCharge_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargeWaiver" ADD CONSTRAINT "RailRakeChargeWaiver_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RailRakeCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargeWaiver" ADD CONSTRAINT "RailRakeChargeWaiver_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargeWaiver" ADD CONSTRAINT "RailRakeChargeWaiver_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargePayment" ADD CONSTRAINT "RailRakeChargePayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RailRakeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargePayment" ADD CONSTRAINT "RailRakeChargePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailRakeChargePayment" ADD CONSTRAINT "RailRakeChargePayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
