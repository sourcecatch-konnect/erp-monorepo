-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('Supervisor', 'Hamal', 'Mechanic');

-- CreateEnum
CREATE TYPE "SpareType" AS ENUM ('Item', 'Service');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('Item', 'Service');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "userName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contactPhone" TEXT,
    "establishmentYear" TIMESTAMP(3) NOT NULL,
    "companyPAN" TEXT,
    "companyTAN" TEXT,
    "mainLogoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "branchCode" TEXT NOT NULL,
    "shortCode" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "weeklyOffDay" TEXT,
    "gstNo" TEXT,
    "workingHours" TEXT,
    "allowLR" BOOLEAN NOT NULL DEFAULT false,
    "isRailHead" BOOLEAN NOT NULL DEFAULT false,
    "allowReceipt" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "monthlyRent" DOUBLE PRECISION,
    "securityDeposit" DOUBLE PRECISION,
    "agreementDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "breadth" DOUBLE PRECISION,
    "gateNo" TEXT,
    "storageCapacity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "capacity" INTEGER,
    "registrationDate" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "customerPAN" TEXT,
    "disallowNewLRBooking" BOOLEAN NOT NULL DEFAULT false,
    "disallowedBranches" TEXT[],
    "interestRateLatePayment" DOUBLE PRECISION,
    "gstNo" TEXT,
    "creditLimit" DOUBLE PRECISION,
    "creditDays" INTEGER,
    "tdsDeductionRate" DOUBLE PRECISION,
    "address" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "contactPhone" TEXT,
    "primaryEmail" TEXT,
    "createLogin" BOOLEAN NOT NULL DEFAULT false,
    "contactPerson" TEXT,
    "mobileNo" TEXT,
    "website" TEXT,
    "billFormat" TEXT,
    "lrFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "agreementDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "rateType" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "detentionRate" DOUBLE PRECISION NOT NULL,
    "rateInclusiveTax" BOOLEAN NOT NULL DEFAULT false,
    "agreementCommittedTrips" INTEGER,
    "carryingCapacity" DOUBLE PRECISION,
    "leadGeneratedByBranchId" INTEGER NOT NULL,
    "applyRateCommittedBusinessMissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "photoPath" TEXT,
    "type" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "anniversaryDate" TIMESTAMP(3),
    "mobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "licenseNo" TEXT NOT NULL,
    "licenseDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3),
    "licenseCity" TEXT,
    "permanentAddress" TEXT,
    "permanentCountry" TEXT,
    "permanentState" TEXT,
    "permanentCity" TEXT,
    "permanentLandline" TEXT,
    "correspondenceAddress" TEXT,
    "correspondenceCountry" TEXT,
    "correspondenceState" TEXT,
    "correspondenceCity" TEXT,
    "correspondenceLandline" TEXT,
    "referencePerson" TEXT,
    "referenceContactNo" TEXT,
    "bloodGroup" TEXT,
    "otherDetails" TEXT,
    "salary" DOUBLE PRECISION,
    "panNo" TEXT,
    "aadharCardNo" TEXT,
    "noTDSApplyAmount" DOUBLE PRECISION,
    "tdsRate" DOUBLE PRECISION,
    "onLeave" BOOLEAN NOT NULL DEFAULT false,
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" SERIAL NOT NULL,
    "truckNumberPrefix" TEXT NOT NULL,
    "truckNumberSuffix" TEXT NOT NULL,
    "chassisNumber" TEXT NOT NULL,
    "engineNumber" TEXT NOT NULL,
    "truckType" TEXT NOT NULL,
    "truckTypeDropdown" TEXT NOT NULL,
    "make" TEXT,
    "capacityMT" DOUBLE PRECISION,
    "insuranceCompany" TEXT NOT NULL,
    "insuranceAmount" DOUBLE PRECISION NOT NULL,
    "insuranceNumber" TEXT,
    "insuranceDate" TIMESTAMP(3) NOT NULL,
    "insuranceDueDate" TIMESTAMP(3) NOT NULL,
    "purchaseDate" TIMESTAMP(3),
    "volume" DOUBLE PRECISION,
    "monthlyFixedExpenses" DOUBLE PRECISION,
    "average" DOUBLE PRECISION,
    "tyres" INTEGER,
    "extraDieselAllowed" BOOLEAN NOT NULL DEFAULT false,
    "emi" DOUBLE PRECISION,
    "fitnessAmt" DOUBLE PRECISION,
    "gpNumber" TEXT,
    "gpDate" TIMESTAMP(3),
    "gpDueDate" TIMESTAMP(3),
    "fitNumber" TEXT,
    "fitDate" TIMESTAMP(3),
    "fitDueDate" TIMESTAMP(3),
    "npNumber" TEXT,
    "npDate" TIMESTAMP(3),
    "npDueDate" TIMESTAMP(3),
    "taxNumber" TEXT,
    "taxDate" TIMESTAMP(3),
    "taxDueDate" TIMESTAMP(3),
    "taxAmount" DOUBLE PRECISION,
    "cft" TEXT,
    "fitness" TEXT,
    "salary" DOUBLE PRECISION,
    "roadPermitNumber" TEXT,
    "permitAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goods" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "category" TEXT,
    "storagePosition" TEXT,
    "storageLayer" TEXT,
    "isStackingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "photoPath" TEXT,
    "address" TEXT,
    "city" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "mobileNo" TEXT,
    "referredBy" TEXT,
    "refContactNo" TEXT,
    "startDate" TIMESTAMP(3),
    "pan" TEXT,
    "tdsAmount" DOUBLE PRECISION,
    "tdsRate" DOUBLE PRECISION,
    "type" "WorkerType" NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailwayFreightMatrix" (
    "id" SERIAL NOT NULL,
    "wagonType" TEXT NOT NULL,
    "sourceCityId" INTEGER NOT NULL,
    "destinationCityId" INTEGER NOT NULL,
    "freightAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailwayFreightMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pump" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "cityId" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "rateLastUpdated" TIMESTAMP(3),
    "currentDieselRate" DOUBLE PRECISION,
    "gstIn" TEXT,
    "pan" TEXT,
    "creditLimit" DOUBLE PRECISION,
    "accountName" TEXT,
    "bankName" TEXT,
    "branchIfscCode" TEXT,
    "isBlackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpareType" NOT NULL,
    "ledgerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpareCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartSupplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shopName" TEXT,
    "address" TEXT,
    "cityId" INTEGER NOT NULL,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "mobileNo" TEXT,
    "email" TEXT,
    "panNo" TEXT,
    "gstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartType" NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "minimumStock" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "isRecyclable" BOOLEAN NOT NULL DEFAULT false,
    "isBatchTracked" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branchCode_key" ON "Branch"("branchCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_leadGeneratedByBranchId_fkey" FOREIGN KEY ("leadGeneratedByBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_sourceCityId_fkey" FOREIGN KEY ("sourceCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartSupplier" ADD CONSTRAINT "SparePartSupplier_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
