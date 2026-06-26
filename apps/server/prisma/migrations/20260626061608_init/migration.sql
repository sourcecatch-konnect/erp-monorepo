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

-- CreateEnum
CREATE TYPE "CashSegment" AS ENUM ('ROAD', 'RAIL', 'FCI');

-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('Supervisor', 'Hamal', 'Mechanic');

-- CreateEnum
CREATE TYPE "SpareType" AS ENUM ('Item', 'Service');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('Item', 'Service');

-- CreateEnum
CREATE TYPE "GoodsCategory" AS ENUM ('Heavy', 'Light');

-- CreateEnum
CREATE TYPE "GoodsStoragePosition" AS ENUM ('Any', 'Horizontal', 'Vertical');

-- CreateEnum
CREATE TYPE "GoodsStorageLayer" AS ENUM ('Both', 'Bottom', 'Upper');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('Truck', 'Item');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PendingApproval', 'Confirmed', 'Rejected', 'Cancelled', 'InProgress', 'Completed');

-- CreateEnum
CREATE TYPE "BranchScope" AS ENUM ('ALL', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationEventStatus" AS ENUM ('PENDING', 'FANOUT_COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AntivirusStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'DENY');

-- CreateEnum
CREATE TYPE "ownershipType" AS ENUM ('Own_Vehicle', 'Market_Vehicle');

-- CreateEnum
CREATE TYPE "vehicleType" AS ENUM ('Container', 'Open_Body', 'TATA_407', 'DCM_Lorry', 'DI_Pickup');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "DetentionRateType" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "RateUnitType" AS ENUM ('HQ', 'LQ');

-- CreateEnum
CREATE TYPE "RateTransportType" AS ENUM ('RAIL_ROAD', 'ROAD');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "LRStatus" AS ENUM ('DRAFT', 'FINALISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LRGroupStatus" AS ENUM ('DRAFT', 'FINALISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LRSource" AS ENUM ('FROM_ORDER', 'INSTANT');

-- CreateEnum
CREATE TYPE "LRTransportType" AS ENUM ('Road', 'Rail', 'RoadAndRail');

-- CreateEnum
CREATE TYPE "LRTripLegType" AS ENUM ('DIRECT', 'TO_HUB', 'FROM_HUB');

-- CreateEnum
CREATE TYPE "LRPriority" AS ENUM ('Normal', 'Express', 'Critical');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('Planned', 'InTransit', 'Closed', 'Cancelled');

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('lr', 'dc');

-- CreateEnum
CREATE TYPE "VPScheduleStatus" AS ENUM ('DRAFT', 'PLANNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "branchId" TEXT,
    "s3Key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploaded" BOOLEAN NOT NULL DEFAULT false,
    "antivirusStatus" "AntivirusStatus" NOT NULL DEFAULT 'PENDING',
    "scanError" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT,
    "status" BOOLEAN NOT NULL,
    "branchScope" "BranchScope" NOT NULL DEFAULT 'ASSIGNED',
    "mobile" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
    "notificationQuietHoursStart" TEXT,
    "notificationQuietHoursEnd" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT NOT NULL,
    "contactPhone" TEXT,
    "establishmentYear" TIMESTAMP(3) NOT NULL,
    "companyPAN" TEXT,
    "companyTAN" TEXT,
    "mainLogoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT,
    "stateId" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
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
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "monthlyRent" BIGINT,
    "securityDeposit" BIGINT,
    "agreementDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "breadth" DOUBLE PRECISION,
    "gateNo" TEXT,
    "storageCapacity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionDef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId","branchId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorId" TEXT,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "status" "NotificationEventStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "recipientResolverKey" TEXT NOT NULL,
    "channels" "NotificationChannel"[],
    "templateId" TEXT,
    "sourceModule" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metaCategory" TEXT,
    "metaFooter" TEXT,
    "metaLanguage" TEXT,
    "metaName" TEXT,
    "metaParamOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaRejectedReason" TEXT,
    "metaStatus" TEXT,
    "metaSubmittedAt" TIMESTAMP(3),
    "metaSyncedAt" TIMESTAMP(3),
    "metaTemplateId" TEXT,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationSubscription" (
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationSubscription_pkey" PRIMARY KEY ("userId","eventType","channel")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bodyType" TEXT,
    "capacityMT" DOUBLE PRECISION NOT NULL,
    "chasisNumber" TEXT NOT NULL,
    "engineNumber" TEXT NOT NULL,
    "insuranceCompany" TEXT,
    "insuranceDueDate" TIMESTAMP(3),
    "insuranceIssueDate" TIMESTAMP(3),
    "insuranceNumber" TEXT,
    "lengthFeet" TEXT,
    "ownershipType" "ownershipType" NOT NULL,
    "purchaseDate" TIMESTAMP(3),
    "wheels" TEXT,
    "currentKM" INTEGER NOT NULL,
    "openingKM" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "vehicleTypeId" TEXT NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "customerPAN" TEXT,
    "disallowNewLRBooking" BOOLEAN NOT NULL DEFAULT false,
    "interestRateLatePayment" BIGINT,
    "gstNo" TEXT,
    "creditLimit" BIGINT,
    "tdsDeductionRate" BIGINT,
    "address" TEXT,
    "country" TEXT,
    "contactPhone" TEXT,
    "primaryEmail" TEXT,
    "contactPerson" TEXT,
    "mobileNo" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "agreementDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "leadGeneratedByBranchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetentionRate" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "type" "DetentionRateType" NOT NULL,
    "fromDuration" INTEGER NOT NULL,
    "toDuration" INTEGER NOT NULL,
    "rate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetentionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "sourceCityId" TEXT NOT NULL,
    "destinationCityId" TEXT NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateUnit" (
    "id" TEXT NOT NULL,
    "unitValue" BIGINT NOT NULL,
    "unitType" "RateUnitType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateMatrix" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "rate" BIGINT NOT NULL,
    "transitDays" INTEGER,
    "remarks" TEXT,
    "vehicleTypeId" TEXT,
    "transportType" "RateTransportType" NOT NULL DEFAULT 'ROAD',
    "unitId" TEXT,

    CONSTRAINT "RateMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
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
    "correspondenceAddress" TEXT,
    "correspondenceCountry" TEXT,
    "correspondenceState" TEXT,
    "correspondenceCity" TEXT,
    "correspondenceLandline" TEXT,
    "referencePerson" TEXT,
    "referenceContactNo" TEXT,
    "bloodGroup" TEXT,
    "otherDetails" TEXT,
    "salary" BIGINT,
    "panNo" TEXT,
    "aadharCardNo" TEXT,
    "noTDSApplyAmount" INTEGER,
    "tdsRate" INTEGER,
    "onLeave" BOOLEAN NOT NULL DEFAULT false,
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "isStackingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "GoodsCategory" NOT NULL,
    "storagePosition" "GoodsStoragePosition" NOT NULL,
    "storageLayer" "GoodsStorageLayer" NOT NULL,

    CONSTRAINT "Goods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Labour" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoPath" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "mobileNo" TEXT,
    "referredBy" TEXT,
    "refContactNo" TEXT,
    "startDate" TIMESTAMP(3),
    "pan" TEXT,
    "tdsAmount" BIGINT,
    "tdsRate" BIGINT,
    "type" "WorkerType" NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Labour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stateId" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "googlePlaceId" TEXT,
    "isRailHead" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phoneNo" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RailwayFreightMatrix" (
    "id" TEXT NOT NULL,
    "wagonId" TEXT NOT NULL,
    "sourceCityId" TEXT NOT NULL,
    "destinationCityId" TEXT NOT NULL,
    "sourceAreaId" TEXT,
    "destinationAreaId" TEXT,
    "freightAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RailwayFreightMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wagon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "totalCft" DOUBLE PRECISION,
    "capacityMt" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Wagon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pump" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "cityId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "rateLastUpdated" TIMESTAMP(3),
    "currentDieselRate" INTEGER,
    "gstIn" TEXT,
    "pan" TEXT,
    "creditLimit" BIGINT,
    "accountName" TEXT,
    "bankName" TEXT,
    "branchIfscCode" TEXT,
    "isBlackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stateId" TEXT NOT NULL,

    CONSTRAINT "Pump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpareType" NOT NULL,
    "ledgerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpareCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shopName" TEXT,
    "address" TEXT,
    "cityId" TEXT NOT NULL,
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
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rate" BIGINT NOT NULL,
    "minimumStock" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "isRecyclable" BOOLEAN NOT NULL DEFAULT false,
    "isBatchTracked" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "customerLocationId" TEXT,
    "pickupAddressOverride" TEXT,
    "specialInstructions" TEXT,
    "orderType" "OrderType" NOT NULL,
    "truckQuantity" INTEGER,
    "vehicleTypeId" TEXT,
    "contactPersonName" TEXT,
    "contactMobile" TEXT,
    "contactEmail" TEXT,
    "bookingFreightAmount" BIGINT,
    "freightOverrideReason" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PendingApproval',
    "rejectionReason" TEXT,
    "cancelReason" TEXT,
    "fyCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "cityId" TEXT,
    "routeId" TEXT,
    "consigneeId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderConsignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "truckIndex" INTEGER NOT NULL DEFAULT 1,
    "loadingLocationId" TEXT,
    "unloadingLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderConsignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderConsignmentGoods" (
    "id" TEXT NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "goodsId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),

    CONSTRAINT "OrderConsignmentGoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "payloadDiff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "freightRangeFrom" INTEGER,
    "freightRangeTo" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLocation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "areaId" TEXT,
    "cityId" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "gstNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRGroup" (
    "id" TEXT NOT NULL,
    "groupNumber" TEXT NOT NULL,
    "fyCode" TEXT NOT NULL,
    "source" "LRSource" NOT NULL,
    "orderId" TEXT,
    "truckIndex" INTEGER NOT NULL DEFAULT 1,
    "originBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "consignorId" TEXT NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "transportType" "LRTransportType" NOT NULL DEFAULT 'Road',
    "priority" "LRPriority" NOT NULL DEFAULT 'Normal',
    "isMarketVehicle" BOOLEAN NOT NULL DEFAULT false,
    "primaryTripId" TEXT,
    "secondaryTripId" TEXT,
    "marketVehicleNumber" TEXT,
    "marketDriverName" TEXT,
    "tripLegType" "LRTripLegType" NOT NULL DEFAULT 'DIRECT',
    "hubId" TEXT,
    "railheadBranchId" TEXT,
    "baseFreightAmount" BIGINT,
    "sealNumber" TEXT,
    "status" "LRGroupStatus" NOT NULL DEFAULT 'DRAFT',
    "cancelReason" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "finalisedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LRGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LorryReceipt" (
    "id" TEXT NOT NULL,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "fyCode" TEXT NOT NULL,
    "lrNumber" TEXT NOT NULL,
    "status" "LRStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "invoiceAmount" BIGINT,
    "invoiceNumber" TEXT,
    "groupId" TEXT NOT NULL,
    "loadingLocationId" TEXT,
    "unloadingLocationId" TEXT,

    CONSTRAINT "LorryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LRGoods" (
    "id" TEXT NOT NULL,
    "lorryReceiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(65,30),
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LRGoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EwayBill" (
    "lorryReceiptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentUrl" TEXT,
    "ewayBillNo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT,
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EwayBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTrip" (
    "vehicleId" TEXT NOT NULL,
    "isTripEmpty" BOOLEAN NOT NULL DEFAULT false,
    "driverId" TEXT NOT NULL,
    "rateMatrixId" TEXT,
    "routeId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'Planned',
    "cancelReason" TEXT,
    "onwardFreight" BIGINT NOT NULL,
    "tripType" "TripType" NOT NULL,
    "closingKm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "endDateTime" TIMESTAMP(3),
    "fyCode" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "openingKm" INTEGER NOT NULL,
    "rakeDate" TIMESTAMP(3),
    "startDateTime" TIMESTAMP(3),
    "tripNumber" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "consignorId" TEXT,
    "tripName" TEXT NOT NULL,

    CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripUnloadingPoint" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "vehicleTripId" TEXT NOT NULL,
    "actualDate" TIMESTAMP(3),
    "cityId" TEXT NOT NULL,
    "locationId" TEXT,
    "plannedDate" TIMESTAMP(3),

    CONSTRAINT "TripUnloadingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStatusHistory" (
    "id" TEXT NOT NULL,
    "vehicleTripId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TripStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPSchedule" (
    "id" TEXT NOT NULL,
    "scheduleNumber" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "scheduleName" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "sourceAreaId" TEXT NOT NULL,
    "destinationAreaId" TEXT NOT NULL,
    "status" "VPScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "totalWagonCount" INTEGER NOT NULL DEFAULT 0,
    "totalCapacityCft" DOUBLE PRECISION DEFAULT 0,
    "totalCapacityMt" DOUBLE PRECISION DEFAULT 0,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VPSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPScheduleWagonCount" (
    "id" TEXT NOT NULL,
    "vpScheduleId" TEXT NOT NULL,
    "wagonId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "capacityCft" DOUBLE PRECISION,
    "capacityMt" DOUBLE PRECISION,
    "totalCft" DOUBLE PRECISION,
    "totalMt" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPScheduleWagonCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creditor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CreditorCategory" NOT NULL,
    "defaultMode" "PaymentMode",
    "branchId" TEXT,
    "phone" TEXT,
    "outstandingBalance" BIGINT NOT NULL DEFAULT 0,
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
    "segment" "CashSegment",
    "projectCode" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "CashReceivable" (
    "id" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "expectedAmount" BIGINT NOT NULL DEFAULT 0,
    "expectedDate" DATE,
    "receivedAmount" BIGINT,
    "ackReceived" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_s3Key_key" ON "Attachment"("s3Key");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_antivirusStatus_idx" ON "Attachment"("antivirusStatus");

-- CreateIndex
CREATE INDEX "Attachment_branchId_idx" ON "Attachment"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branchCode_key" ON "Branch"("branchCode");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionDef_key_key" ON "PermissionDef"("key");

-- CreateIndex
CREATE INDEX "PermissionDef_moduleCode_idx" ON "PermissionDef"("moduleCode");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationEvent_eventType_idx" ON "NotificationEvent"("eventType");

-- CreateIndex
CREATE INDEX "NotificationEvent_sourceModule_idx" ON "NotificationEvent"("sourceModule");

-- CreateIndex
CREATE INDEX "NotificationEvent_aggregateType_aggregateId_idx" ON "NotificationEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "NotificationEvent_branchId_idx" ON "NotificationEvent"("branchId");

-- CreateIndex
CREATE INDEX "NotificationEvent_status_createdAt_idx" ON "NotificationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRule_eventType_idx" ON "NotificationRule"("eventType");

-- CreateIndex
CREATE INDEX "NotificationRule_enabled_idx" ON "NotificationRule"("enabled");

-- CreateIndex
CREATE INDEX "NotificationRule_sourceModule_idx" ON "NotificationRule"("sourceModule");

-- CreateIndex
CREATE INDEX "NotificationRule_branchId_idx" ON "NotificationRule"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_code_channel_key" ON "NotificationTemplate"("code", "channel");

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientUserId_status_idx" ON "NotificationDelivery"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_eventId_channel_recipientUserId_key" ON "NotificationDelivery"("eventId", "channel", "recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_deliveryId_key" ON "InAppNotification"("deliveryId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_archivedAt_idx" ON "InAppNotification"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "UserNotificationSubscription_eventType_channel_idx" ON "UserNotificationSubscription"("eventType", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chasisNumber_key" ON "Vehicle"("chasisNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_engineNumber_key" ON "Vehicle"("engineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Route_sourceCityId_destinationCityId_key" ON "Route"("sourceCityId", "destinationCityId");

-- CreateIndex
CREATE UNIQUE INDEX "RateUnit_unitValue_unitType_key" ON "RateUnit"("unitValue", "unitType");

-- CreateIndex
CREATE UNIQUE INDEX "RateMatrix_agreementId_routeId_vehicleTypeId_unitId_transpo_key" ON "RateMatrix"("agreementId", "routeId", "vehicleTypeId", "unitId", "transportType");

-- CreateIndex
CREATE UNIQUE INDEX "Area_googlePlaceId_key" ON "Area"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Area_isRailHead_idx" ON "Area"("isRailHead");

-- CreateIndex
CREATE UNIQUE INDEX "Area_cityId_name_key" ON "Area"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transport_phoneNo_key" ON "Transport"("phoneNo");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_wagonId_idx" ON "RailwayFreightMatrix"("wagonId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_sourceCityId_idx" ON "RailwayFreightMatrix"("sourceCityId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_destinationCityId_idx" ON "RailwayFreightMatrix"("destinationCityId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_sourceAreaId_idx" ON "RailwayFreightMatrix"("sourceAreaId");

-- CreateIndex
CREATE INDEX "RailwayFreightMatrix_destinationAreaId_idx" ON "RailwayFreightMatrix"("destinationAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "Wagon_name_key" ON "Wagon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_fromBranchId_idx" ON "Order"("fromBranchId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_fyCode_idx" ON "Order"("fyCode");

-- CreateIndex
CREATE INDEX "Order_routeId_idx" ON "Order"("routeId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderConsignment_orderId_idx" ON "OrderConsignment"("orderId");

-- CreateIndex
CREATE INDEX "OrderConsignmentGoods_consignmentId_idx" ON "OrderConsignmentGoods"("consignmentId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_code_key" ON "VehicleType"("code");

-- CreateIndex
CREATE INDEX "CustomerLocation_customerId_idx" ON "CustomerLocation"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLocation_areaId_idx" ON "CustomerLocation"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_branchCode_fyCode_docType_key" ON "DocumentSequence"("branchCode", "fyCode", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "LRGroup_groupNumber_key" ON "LRGroup"("groupNumber");

-- CreateIndex
CREATE INDEX "LRGroup_status_idx" ON "LRGroup"("status");

-- CreateIndex
CREATE INDEX "LRGroup_orderId_idx" ON "LRGroup"("orderId");

-- CreateIndex
CREATE INDEX "LRGroup_originBranchId_idx" ON "LRGroup"("originBranchId");

-- CreateIndex
CREATE INDEX "LRGroup_destinationBranchId_idx" ON "LRGroup"("destinationBranchId");

-- CreateIndex
CREATE INDEX "LRGroup_fyCode_idx" ON "LRGroup"("fyCode");

-- CreateIndex
CREATE UNIQUE INDEX "LorryReceipt_lrNumber_key" ON "LorryReceipt"("lrNumber");

-- CreateIndex
CREATE INDEX "LorryReceipt_status_idx" ON "LorryReceipt"("status");

-- CreateIndex
CREATE INDEX "LorryReceipt_groupId_idx" ON "LorryReceipt"("groupId");

-- CreateIndex
CREATE INDEX "LorryReceipt_fyCode_idx" ON "LorryReceipt"("fyCode");

-- CreateIndex
CREATE INDEX "LRGoods_lorryReceiptId_idx" ON "LRGoods"("lorryReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "EwayBill_lorryReceiptId_key" ON "EwayBill"("lorryReceiptId");

-- CreateIndex
CREATE INDEX "EwayBill_lorryReceiptId_idx" ON "EwayBill"("lorryReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrip_tripNumber_key" ON "VehicleTrip"("tripNumber");

-- CreateIndex
CREATE INDEX "VehicleTrip_status_idx" ON "VehicleTrip"("status");

-- CreateIndex
CREATE INDEX "TripUnloadingPoint_vehicleTripId_idx" ON "TripUnloadingPoint"("vehicleTripId");

-- CreateIndex
CREATE UNIQUE INDEX "VPSchedule_scheduleNumber_key" ON "VPSchedule"("scheduleNumber");

-- CreateIndex
CREATE INDEX "VPSchedule_scheduleDate_idx" ON "VPSchedule"("scheduleDate");

-- CreateIndex
CREATE INDEX "VPSchedule_status_idx" ON "VPSchedule"("status");

-- CreateIndex
CREATE INDEX "VPSchedule_fromBranchId_idx" ON "VPSchedule"("fromBranchId");

-- CreateIndex
CREATE INDEX "VPSchedule_toBranchId_idx" ON "VPSchedule"("toBranchId");

-- CreateIndex
CREATE INDEX "VPSchedule_sourceAreaId_idx" ON "VPSchedule"("sourceAreaId");

-- CreateIndex
CREATE INDEX "VPSchedule_destinationAreaId_idx" ON "VPSchedule"("destinationAreaId");

-- CreateIndex
CREATE INDEX "VPSchedule_deletedAt_idx" ON "VPSchedule"("deletedAt");

-- CreateIndex
CREATE INDEX "VPScheduleWagonCount_vpScheduleId_idx" ON "VPScheduleWagonCount"("vpScheduleId");

-- CreateIndex
CREATE INDEX "VPScheduleWagonCount_wagonId_idx" ON "VPScheduleWagonCount"("wagonId");

-- CreateIndex
CREATE UNIQUE INDEX "VPScheduleWagonCount_vpScheduleId_wagonId_key" ON "VPScheduleWagonCount"("vpScheduleId", "wagonId");

-- CreateIndex
CREATE UNIQUE INDEX "CashPlanDay_date_key" ON "CashPlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CashAccountBalance_dayId_accountId_key" ON "CashAccountBalance"("dayId", "accountId");

-- CreateIndex
CREATE INDEX "CashPayment_dayId_idx" ON "CashPayment"("dayId");

-- CreateIndex
CREATE INDEX "CashPayment_status_idx" ON "CashPayment"("status");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PermissionDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PermissionDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationSubscription" ADD CONSTRAINT "UserNotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_leadGeneratedByBranchId_fkey" FOREIGN KEY ("leadGeneratedByBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetentionRate" ADD CONSTRAINT "DetentionRate_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_sourceCityId_fkey" FOREIGN KEY ("sourceCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RateUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_sourceCityId_fkey" FOREIGN KEY ("sourceCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_sourceAreaId_fkey" FOREIGN KEY ("sourceAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_destinationAreaId_fkey" FOREIGN KEY ("destinationAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailwayFreightMatrix" ADD CONSTRAINT "RailwayFreightMatrix_wagonId_fkey" FOREIGN KEY ("wagonId") REFERENCES "Wagon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartSupplier" ADD CONSTRAINT "SparePartSupplier_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SparePartSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerLocationId_fkey" FOREIGN KEY ("customerLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_loadingLocationId_fkey" FOREIGN KEY ("loadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignment" ADD CONSTRAINT "OrderConsignment_unloadingLocationId_fkey" FOREIGN KEY ("unloadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "OrderConsignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsignmentGoods" ADD CONSTRAINT "OrderConsignmentGoods_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "Goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_finalisedById_fkey" FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_primaryTripId_fkey" FOREIGN KEY ("primaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_railheadBranchId_fkey" FOREIGN KEY ("railheadBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_secondaryTripId_fkey" FOREIGN KEY ("secondaryTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGroup" ADD CONSTRAINT "LRGroup_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LRGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_loadingLocationId_fkey" FOREIGN KEY ("loadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_unloadingLocationId_fkey" FOREIGN KEY ("unloadingLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LorryReceipt" ADD CONSTRAINT "LorryReceipt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LRGoods" ADD CONSTRAINT "LRGoods_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EwayBill" ADD CONSTRAINT "EwayBill_lorryReceiptId_fkey" FOREIGN KEY ("lorryReceiptId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_rateMatrixId_fkey" FOREIGN KEY ("rateMatrixId") REFERENCES "RateMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUnloadingPoint" ADD CONSTRAINT "TripUnloadingPoint_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStatusHistory" ADD CONSTRAINT "TripStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStatusHistory" ADD CONSTRAINT "TripStatusHistory_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_sourceAreaId_fkey" FOREIGN KEY ("sourceAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_destinationAreaId_fkey" FOREIGN KEY ("destinationAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPSchedule" ADD CONSTRAINT "VPSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPScheduleWagonCount" ADD CONSTRAINT "VPScheduleWagonCount_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPScheduleWagonCount" ADD CONSTRAINT "VPScheduleWagonCount_wagonId_fkey" FOREIGN KEY ("wagonId") REFERENCES "Wagon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
