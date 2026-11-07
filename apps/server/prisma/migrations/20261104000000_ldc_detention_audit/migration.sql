-- How an LDC broker slip's detention figure was reached, snapshotted onto the
-- line at slip time. Slabs are editable and soft-deleted, so a paid slip that
-- stored only a rupee amount becomes unexplainable the moment its slab
-- changes. Spec "Detailed DC Detention Working Process" STEP 18 asks for the
-- days and the working alongside the amount.
--
-- All nullable: only LDC_BROKER lines set them, and every existing row
-- predates the feature.

ALTER TABLE "VendorPaymentSlipLine"
  ADD COLUMN "detentionDays" INTEGER,
  ADD COLUMN "detentionSlabId" TEXT,
  ADD COLUMN "detentionSlabName" TEXT,
  ADD COLUMN "claimedDetentionPaise" BIGINT;
