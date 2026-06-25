-- CreateEnum
CREATE TYPE "VPScheduleStatus" AS ENUM ('DRAFT', 'PLANNED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "isRailHead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Wagon" ADD COLUMN     "capacityMt" DOUBLE PRECISION,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totalCft" DOUBLE PRECISION;

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
CREATE INDEX "Area_isRailHead_idx" ON "Area"("isRailHead");

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
