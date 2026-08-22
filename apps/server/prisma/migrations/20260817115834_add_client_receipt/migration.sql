-- CreateEnum
CREATE TYPE "ReceiptPaymentMode" AS ENUM ('CASH', 'CHEQUE', 'BANK', 'UPI');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "fyCode" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "unallocatedPaise" BIGINT NOT NULL DEFAULT 0,
    "paymentMode" "ReceiptPaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amountAppliedPaise" BIGINT NOT NULL,
    "tdsAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "tdsSection" TEXT,
    "tdsCertNumber" TEXT,
    "tdsCertDate" TIMESTAMP(3),
    "damageAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "rateDiffAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptStatusHistory" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "fromStatus" "ReceiptStatus",
    "toStatus" "ReceiptStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_branchId_status_idx" ON "Receipt"("branchId", "status");

-- CreateIndex
CREATE INDEX "Receipt_customerId_status_idx" ON "Receipt"("customerId", "status");

-- CreateIndex
CREATE INDEX "Receipt_receivedAt_idx" ON "Receipt"("receivedAt");

-- CreateIndex
CREATE INDEX "Receipt_fyCode_idx" ON "Receipt"("fyCode");

-- CreateIndex
CREATE INDEX "ReceiptAllocation_billId_idx" ON "ReceiptAllocation"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAllocation_receiptId_billId_key" ON "ReceiptAllocation"("receiptId", "billId");

-- CreateIndex
CREATE INDEX "ReceiptStatusHistory_receiptId_changedAt_idx" ON "ReceiptStatusHistory"("receiptId", "changedAt");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptStatusHistory" ADD CONSTRAINT "ReceiptStatusHistory_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptStatusHistory" ADD CONSTRAINT "ReceiptStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
