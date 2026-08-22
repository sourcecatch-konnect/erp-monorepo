-- Keep LR movement and customer billing as independent lifecycles.
CREATE TYPE "LRBillingStatus" AS ENUM (
    'NOT_BILLABLE',
    'READY_TO_BILL',
    'PARTIALLY_BILLED',
    'BILLED',
    'DISPUTED'
);

CREATE TYPE "LRChargeType" AS ENUM (
    'FREIGHT',
    'DETENTION',
    'HAMALI',
    'UNLOADING',
    'TOLL',
    'MULTIPOINT',
    'FREIGHT_ADJUSTMENT',
    'DAMAGE_DEDUCTION',
    'OTHER'
);

CREATE TYPE "LRChargeEffect" AS ENUM ('ADDITION', 'DEDUCTION');

CREATE TYPE "LRChargeSource" AS ENUM (
    'LR_FREIGHT',
    'ACKNOWLEDGEMENT',
    'DETENTION_CALCULATION',
    'AGREEMENT',
    'MANUAL'
);

CREATE TYPE "LRChargeStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'PARTIALLY_BILLED',
    'BILLED',
    'CANCELLED'
);

CREATE TYPE "BillType" AS ENUM ('ROAD', 'ROAD_RAIL', 'ROAD_GTA');
CREATE TYPE "BillPartyType" AS ENUM ('CONSIGNOR', 'CONSIGNEE');
CREATE TYPE "BillChargeMechanism" AS ENUM ('NOT_APPLICABLE', 'FORWARD_CHARGE', 'REVERSE_CHARGE');
CREATE TYPE "BillTaxTreatment" AS ENUM ('NO_GST', 'INTRA_STATE', 'INTER_STATE', 'REVERSE_CHARGE');
CREATE TYPE "BillTaxType" AS ENUM ('CGST', 'SGST', 'IGST');

CREATE TYPE "BillStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'FINALISED',
    'SENT',
    'PARTIALLY_PAID',
    'PAID',
    'CANCELLED'
);

ALTER TABLE "LorryReceipt"
ADD COLUMN "billingStatus" "LRBillingStatus" NOT NULL DEFAULT 'NOT_BILLABLE';

CREATE TABLE "LRCharge" (
    "id" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "type" "LRChargeType" NOT NULL,
    "effect" "LRChargeEffect" NOT NULL DEFAULT 'ADDITION',
    "source" "LRChargeSource" NOT NULL,
    "sourceReferenceId" TEXT,
    "description" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "approvedAmountPaise" BIGINT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "sacCode" TEXT,
    "status" "LRChargeStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingTaxRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billType" "BillType" NOT NULL,
    "chargeMechanism" "BillChargeMechanism" NOT NULL,
    "sacCode" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "cgstRateBps" INTEGER NOT NULL DEFAULT 0,
    "sgstRateBps" INTEGER NOT NULL DEFAULT 0,
    "igstRateBps" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingTaxRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT,
    "fyCode" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "billType" "BillType" NOT NULL,
    "billingPartyType" "BillPartyType" NOT NULL,
    "chargeMechanism" "BillChargeMechanism" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "taxTreatment" "BillTaxTreatment" NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "billingCutoffDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "branchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceCustomerId" TEXT NOT NULL,
    "billingCustomerId" TEXT NOT NULL,
    "billingLocationId" TEXT,
    "supplierStateId" TEXT NOT NULL,
    "placeOfSupplyStateId" TEXT NOT NULL,
    "taxRuleId" TEXT,
    "billingPartyNameSnapshot" TEXT NOT NULL,
    "billingGstinSnapshot" TEXT,
    "billingAddressSnapshot" TEXT,
    "supplierNameSnapshot" TEXT NOT NULL,
    "supplierGstinSnapshot" TEXT,
    "supplierAddressSnapshot" TEXT,
    "supplierStateNameSnapshot" TEXT NOT NULL,
    "placeOfSupplyNameSnapshot" TEXT NOT NULL,
    "subtotalAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "taxableAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "taxAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "roundOffPaise" BIGINT NOT NULL DEFAULT 0,
    "totalAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "paidAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "outstandingAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "cancellationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "finalisedById" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "lrChargeId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "chargeTypeSnapshot" "LRChargeType" NOT NULL,
    "effectSnapshot" "LRChargeEffect" NOT NULL,
    "descriptionSnapshot" TEXT,
    "sacCodeSnapshot" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "ratePaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "taxableAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillTaxLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "taxType" "BillTaxType" NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "taxableAmountPaise" BIGINT NOT NULL,
    "taxAmountPaise" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillTaxLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillStatusHistory" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "fromStatus" "BillStatus",
    "toStatus" "BillStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE UNIQUE INDEX "BillLine_billId_lineNumber_key" ON "BillLine"("billId", "lineNumber");
CREATE UNIQUE INDEX "BillLine_billId_lrChargeId_key" ON "BillLine"("billId", "lrChargeId");
CREATE UNIQUE INDEX "BillTaxLine_billId_taxType_rateBps_key" ON "BillTaxLine"("billId", "taxType", "rateBps");

CREATE INDEX "LorryReceipt_billingStatus_idx" ON "LorryReceipt"("billingStatus");
CREATE INDEX "LRCharge_lrId_status_idx" ON "LRCharge"("lrId", "status");
CREATE INDEX "LRCharge_type_status_idx" ON "LRCharge"("type", "status");
CREATE INDEX "LRCharge_source_sourceReferenceId_idx" ON "LRCharge"("source", "sourceReferenceId");
CREATE INDEX "BillingTaxRule_billType_chargeMechanism_effectiveFrom_isActive_idx" ON "BillingTaxRule"("billType", "chargeMechanism", "effectiveFrom", "isActive");
CREATE INDEX "BillingTaxRule_effectiveTo_idx" ON "BillingTaxRule"("effectiveTo");
CREATE INDEX "Bill_branchId_status_idx" ON "Bill"("branchId", "status");
CREATE INDEX "Bill_serviceCustomerId_status_idx" ON "Bill"("serviceCustomerId", "status");
CREATE INDEX "Bill_billingCustomerId_status_idx" ON "Bill"("billingCustomerId", "status");
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");
CREATE INDEX "Bill_fyCode_idx" ON "Bill"("fyCode");
CREATE INDEX "Bill_placeOfSupplyStateId_idx" ON "Bill"("placeOfSupplyStateId");
CREATE INDEX "BillLine_lrId_idx" ON "BillLine"("lrId");
CREATE INDEX "BillLine_lrChargeId_idx" ON "BillLine"("lrChargeId");
CREATE INDEX "BillTaxLine_billId_idx" ON "BillTaxLine"("billId");
CREATE INDEX "BillStatusHistory_billId_changedAt_idx" ON "BillStatusHistory"("billId", "changedAt");

ALTER TABLE "LRCharge"
ADD CONSTRAINT "LRCharge_lrId_fkey"
FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LRCharge"
ADD CONSTRAINT "LRCharge_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LRCharge"
ADD CONSTRAINT "LRCharge_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LRCharge"
ADD CONSTRAINT "LRCharge_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingTaxRule"
ADD CONSTRAINT "BillingTaxRule_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingTaxRule"
ADD CONSTRAINT "BillingTaxRule_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_serviceCustomerId_fkey"
FOREIGN KEY ("serviceCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_billingCustomerId_fkey"
FOREIGN KEY ("billingCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_billingLocationId_fkey"
FOREIGN KEY ("billingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_supplierStateId_fkey"
FOREIGN KEY ("supplierStateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_placeOfSupplyStateId_fkey"
FOREIGN KEY ("placeOfSupplyStateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_taxRuleId_fkey"
FOREIGN KEY ("taxRuleId") REFERENCES "BillingTaxRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_finalisedById_fkey"
FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_cancelledById_fkey"
FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillLine"
ADD CONSTRAINT "BillLine_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillLine"
ADD CONSTRAINT "BillLine_lrId_fkey"
FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillLine"
ADD CONSTRAINT "BillLine_lrChargeId_fkey"
FOREIGN KEY ("lrChargeId") REFERENCES "LRCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillTaxLine"
ADD CONSTRAINT "BillTaxLine_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillStatusHistory"
ADD CONSTRAINT "BillStatusHistory_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillStatusHistory"
ADD CONSTRAINT "BillStatusHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
