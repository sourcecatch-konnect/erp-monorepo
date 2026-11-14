ALTER TYPE "VendorPaymentSourceType" ADD VALUE 'SERVICE_BILL';
ALTER TABLE "VendorPaymentSlip" ADD COLUMN "serviceBillId" TEXT;
ALTER TABLE "VendorPaymentDisbursement" ADD COLUMN "tdsPaise" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_serviceBillId_fkey"
  FOREIGN KEY ("serviceBillId") REFERENCES "ServiceBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "VendorPaymentSlip_serviceBillId_idx" ON "VendorPaymentSlip"("serviceBillId");
ALTER TABLE "VendorPaymentSlip" DROP CONSTRAINT "VendorPaymentSlip_one_payee_chk";
ALTER TABLE "VendorPaymentSlip" ADD CONSTRAINT "VendorPaymentSlip_one_payee_chk" CHECK (
  (("transportId" IS NOT NULL)::integer + ("labourId" IS NOT NULL)::integer + ("serviceBillId" IS NOT NULL)::integer) = 1
  AND (("type" = 'JOBCARD') = ("serviceBillId" IS NOT NULL))
);
ALTER TABLE "VendorPaymentDisbursement" ADD CONSTRAINT "VendorPaymentDisbursement_tds_nonnegative_chk" CHECK ("tdsPaise" >= 0);
