-- LDC (Local Delivery Challan) broker payment.
--
-- The broker is a Transport, so VendorPaymentSlip needs no new payee column
-- and its one-payee CHECK constraint holds unchanged. All this adds is a new
-- line source and a typed paymentBy.

ALTER TYPE "VendorPaymentSourceType" ADD VALUE IF NOT EXISTS 'DELIVERY_CHALLAN';

-- paymentBy was free text fed by a four-option dropdown, so the stored values
-- should already be COMPANY / CLIENT / TRANSPORTER / CASH. Normalise case and
-- punctuation anyway; anything unrecognised becomes NULL — the challan simply
-- has no stated payer until someone sets one. Nothing is lost that was not
-- already unreadable.
CREATE TYPE "DeliveryChallanPaymentBy" AS ENUM ('COMPANY', 'CLIENT', 'TRANSPORTER', 'CASH');

ALTER TABLE "DeliveryChallan" ADD COLUMN "paymentBy_new" "DeliveryChallanPaymentBy";

UPDATE "DeliveryChallan"
SET "paymentBy_new" = CASE upper(regexp_replace(coalesce("paymentBy", ''), '[^A-Za-z]', '', 'g'))
    WHEN 'COMPANY'     THEN 'COMPANY'::"DeliveryChallanPaymentBy"
    WHEN 'SELF'        THEN 'COMPANY'::"DeliveryChallanPaymentBy"
    WHEN 'CLIENT'      THEN 'CLIENT'::"DeliveryChallanPaymentBy"
    WHEN 'CUSTOMER'    THEN 'CLIENT'::"DeliveryChallanPaymentBy"
    WHEN 'PARTY'       THEN 'CLIENT'::"DeliveryChallanPaymentBy"
    WHEN 'TRANSPORTER' THEN 'TRANSPORTER'::"DeliveryChallanPaymentBy"
    WHEN 'BROKER'      THEN 'TRANSPORTER'::"DeliveryChallanPaymentBy"
    WHEN 'CASH'        THEN 'CASH'::"DeliveryChallanPaymentBy"
    ELSE NULL
END
WHERE "paymentBy" IS NOT NULL;

ALTER TABLE "DeliveryChallan" DROP COLUMN "paymentBy";
ALTER TABLE "DeliveryChallan" RENAME COLUMN "paymentBy_new" TO "paymentBy";
