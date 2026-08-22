-- CreateIndex
CREATE INDEX "Agreement_agreementDate_idx" ON "Agreement"("agreementDate" DESC);

-- CreateIndex
CREATE INDEX "Agreement_companyId_idx" ON "Agreement"("companyId");

-- CreateIndex
CREATE INDEX "Agreement_clientId_idx" ON "Agreement"("clientId");

-- CreateIndex
CREATE INDEX "Agreement_leadGeneratedByBranchId_idx" ON "Agreement"("leadGeneratedByBranchId");

-- CreateIndex
CREATE INDEX "Agreement_cityId_idx" ON "Agreement"("cityId");

-- CreateIndex
CREATE INDEX "Area_name_idx" ON "Area"("name");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_cityId_idx" ON "Branch"("cityId");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Branch_warehouseId_idx" ON "Branch"("warehouseId");

-- CreateIndex
CREATE INDEX "CashAccount_deletedAt_name_idx" ON "CashAccount"("deletedAt", "name");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE INDEX "City_stateId_idx" ON "City"("stateId");

-- CreateIndex
CREATE INDEX "Company_cityId_idx" ON "Company"("cityId");

-- CreateIndex
CREATE INDEX "Company_stateId_idx" ON "Company"("stateId");

-- CreateIndex
CREATE INDEX "Creditor_deletedAt_name_idx" ON "Creditor"("deletedAt", "name");

-- CreateIndex
CREATE INDEX "Creditor_branchId_idx" ON "Creditor"("branchId");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_cityId_idx" ON "Customer"("cityId");

-- CreateIndex
CREATE INDEX "Customer_stateId_idx" ON "Customer"("stateId");

-- CreateIndex
CREATE INDEX "Driver_name_idx" ON "Driver"("name");

-- CreateIndex
CREATE INDEX "Goods_name_idx" ON "Goods"("name");

-- CreateIndex
CREATE INDEX "Labour_name_idx" ON "Labour"("name");

-- CreateIndex
CREATE INDEX "Labour_branchId_idx" ON "Labour"("branchId");

-- CreateIndex
CREATE INDEX "Labour_cityId_idx" ON "Labour"("cityId");

-- CreateIndex
CREATE INDEX "Pump_name_idx" ON "Pump"("name");

-- CreateIndex
CREATE INDEX "Pump_cityId_idx" ON "Pump"("cityId");

-- CreateIndex
CREATE INDEX "Pump_stateId_idx" ON "Pump"("stateId");

-- CreateIndex
CREATE INDEX "RateMatrix_routeId_idx" ON "RateMatrix"("routeId");

-- CreateIndex
CREATE INDEX "RateMatrix_vehicleTypeId_idx" ON "RateMatrix"("vehicleTypeId");

-- CreateIndex
CREATE INDEX "RateMatrix_unitId_idx" ON "RateMatrix"("unitId");

-- CreateIndex
CREATE INDEX "RateMatrix_rate_idx" ON "RateMatrix"("rate");

-- CreateIndex
CREATE INDEX "Route_destinationCityId_idx" ON "Route"("destinationCityId");

-- CreateIndex
CREATE INDEX "SpareCategory_name_idx" ON "SpareCategory"("name");

-- CreateIndex
CREATE INDEX "SparePart_name_idx" ON "SparePart"("name");

-- CreateIndex
CREATE INDEX "SparePart_categoryId_idx" ON "SparePart"("categoryId");

-- CreateIndex
CREATE INDEX "SparePart_supplierId_idx" ON "SparePart"("supplierId");

-- CreateIndex
CREATE INDEX "SparePartSupplier_name_idx" ON "SparePartSupplier"("name");

-- CreateIndex
CREATE INDEX "SparePartSupplier_cityId_idx" ON "SparePartSupplier"("cityId");

-- CreateIndex
CREATE INDEX "Transport_name_idx" ON "Transport"("name");

-- CreateIndex
CREATE INDEX "Transport_cityId_idx" ON "Transport"("cityId");

-- CreateIndex
CREATE INDEX "Transport_stateId_idx" ON "Transport"("stateId");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleTypeId_idx" ON "Vehicle"("vehicleTypeId");

-- CreateIndex
CREATE INDEX "VehicleType_name_idx" ON "VehicleType"("name");

-- CreateIndex
CREATE INDEX "Warehouse_name_idx" ON "Warehouse"("name");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE INDEX "Warehouse_cityId_idx" ON "Warehouse"("cityId");

-- CreateIndex
CREATE INDEX "Warehouse_stateId_idx" ON "Warehouse"("stateId");
