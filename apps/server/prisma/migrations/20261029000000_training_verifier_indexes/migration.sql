-- Indexes for the training verifiers (training.verifiers.ts).
--
-- Each verifier asks "has this user ever created / approved / finalised one
-- of these?" with findFirst on a created-by style column. Without an index
-- Postgres must scan the whole table — and the common case is the expensive
-- one: a verifier only runs for a step that is NOT yet done, so the answer is
-- usually "no", which cannot short-circuit and must read every row.
--
-- Added while the tables are small. The same migration on a multi-million
-- row table needs a maintenance window, so the cost only grows.
--
-- GRN.createdById and MRRR.createdById already had theirs.

-- CreateIndex
CREATE INDEX "Bill_approvedById_idx" ON "Bill"("approvedById");

-- CreateIndex
CREATE INDEX "Bill_createdById_idx" ON "Bill"("createdById");

-- CreateIndex
CREATE INDEX "Bill_finalisedById_idx" ON "Bill"("finalisedById");

-- CreateIndex
CREATE INDEX "DeliveryChallan_createdById_idx" ON "DeliveryChallan"("createdById");

-- CreateIndex
CREATE INDEX "JobCard_createdById_idx" ON "JobCard"("createdById");

-- CreateIndex
CREATE INDEX "JobCard_finalisedById_idx" ON "JobCard"("finalisedById");

-- CreateIndex
CREATE INDEX "LRAcknowledgement_createdById_idx" ON "LRAcknowledgement"("createdById");

-- CreateIndex
CREATE INDEX "LRDelivery_createdById_idx" ON "LRDelivery"("createdById");

-- CreateIndex
CREATE INDEX "LRGroup_finalisedById_idx" ON "LRGroup"("finalisedById");

-- CreateIndex
CREATE INDEX "LogSlip_generatedById_idx" ON "LogSlip"("generatedById");

-- CreateIndex
CREATE INDEX "LorryReceipt_createdById_idx" ON "LorryReceipt"("createdById");

-- CreateIndex
CREATE INDEX "Order_approvedById_idx" ON "Order"("approvedById");

-- CreateIndex
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdById_idx" ON "PurchaseOrder"("createdById");

-- CreateIndex
CREATE INDEX "RailBranchGRN_createdById_idx" ON "RailBranchGRN"("createdById");

-- CreateIndex
CREATE INDEX "RailRakeOperation_createdById_idx" ON "RailRakeOperation"("createdById");

-- CreateIndex
CREATE INDEX "Receipt_createdById_idx" ON "Receipt"("createdById");

-- CreateIndex
CREATE INDEX "ServiceBill_createdById_idx" ON "ServiceBill"("createdById");

-- CreateIndex
CREATE INDEX "SpareInward_createdById_idx" ON "SpareInward"("createdById");

-- CreateIndex
CREATE INDEX "TripExpense_approvedById_idx" ON "TripExpense"("approvedById");

-- CreateIndex
CREATE INDEX "TripExpense_createdById_idx" ON "TripExpense"("createdById");

-- CreateIndex
CREATE INDEX "VPLoading_createdById_idx" ON "VPLoading"("createdById");

-- CreateIndex
CREATE INDEX "VPSchedule_createdById_idx" ON "VPSchedule"("createdById");

-- CreateIndex
CREATE INDEX "VehicleTrip_createdById_idx" ON "VehicleTrip"("createdById");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_approvedById_idx" ON "VendorPaymentSlip"("approvedById");

-- CreateIndex
CREATE INDEX "VendorPaymentSlip_createdById_idx" ON "VendorPaymentSlip"("createdById");

