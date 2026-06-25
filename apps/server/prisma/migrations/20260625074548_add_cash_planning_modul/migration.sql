-- CreateEnum
CREATE TYPE "CreditorCategory" AS ENUM ('DIESEL', 'RENT', 'FREIGHT', 'EXPENSE', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "CashDayStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK', 'UPI', 'CHEQUE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'HOLD', 'REJECTED');

-- CreateTable
CREATE TABLE "Creditor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CreditorCategory" NOT NULL,
    "defaultMode" "PaymentMode",
    "branchId" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "bankName" TEXT,
    "accountLast4" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashPlanDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "CashDayStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAccountBalance" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "openingBalance" BIGINT NOT NULL,
    "carriedOpening" BIGINT,

    CONSTRAINT "CashAccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashPayment" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "creditorId" TEXT,
    "payeeName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" "CreditorCategory" NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "branchId" TEXT,
    "fromAccountId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashPlanDay_date_key" ON "CashPlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CashAccountBalance_dayId_accountId_key" ON "CashAccountBalance"("dayId", "accountId");

-- CreateIndex
CREATE INDEX "CashPayment_dayId_idx" ON "CashPayment"("dayId");

-- CreateIndex
CREATE INDEX "CashPayment_status_idx" ON "CashPayment"("status");

-- AddForeignKey
ALTER TABLE "Creditor" ADD CONSTRAINT "Creditor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountBalance" ADD CONSTRAINT "CashAccountBalance_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CashPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccountBalance" ADD CONSTRAINT "CashAccountBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPayment" ADD CONSTRAINT "CashPayment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CashPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPayment" ADD CONSTRAINT "CashPayment_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPayment" ADD CONSTRAINT "CashPayment_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPayment" ADD CONSTRAINT "CashPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
