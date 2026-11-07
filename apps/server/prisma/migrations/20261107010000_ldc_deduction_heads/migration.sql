-- LDC deduction heads (phase L4).
--
-- The DC approval already captures approvedParkingPaise / approvedLabourPaise
-- / approvedOtherPaise / approvedDamagePaise / approvedShortagePaise, and the
-- payment slip ignored every one of them: an approver could approve parking
-- and the broker would never be paid it. These columns are where the approved
-- figures land on the slip, so the money follows the ruling.
--
-- Parking, labour and other are the broker's own charges and add to the
-- payable. Shortage is recovered from him, like the existing damagePaise.
--
-- Additive and defaulted, so every existing slip line keeps its current net.

ALTER TABLE "VendorPaymentSlipLine"
  ADD COLUMN "parkingPaise"  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "labourPaise"   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "otherPaise"    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "shortagePaise" BIGINT NOT NULL DEFAULT 0;
