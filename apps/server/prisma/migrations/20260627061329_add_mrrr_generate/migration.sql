-- CreateEnum
CREATE TYPE "MRRRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RakeType" AS ENUM ('INDENT', 'LEASE');

-- CreateTable
CREATE TABLE "MRRR" (
    "id" TEXT NOT NULL,
    "mrRrNumber" TEXT,
    "vpScheduleId" TEXT NOT NULL,
    "rakeType" "RakeType",
    "status" "MRRRStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MRRR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MRRRRow" (
    "id" TEXT NOT NULL,
    "mrRrId" TEXT NOT NULL,
    "vpScheduleWagonCountId" TEXT NOT NULL,
    "wagonId" TEXT NOT NULL,
    "wagonTypeLabel" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "sequenceNo" TEXT,
    "vpNo" TEXT,
    "mrRrNo" TEXT,
    "sealNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MRRRRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MRRR_mrRrNumber_key" ON "MRRR"("mrRrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MRRR_vpScheduleId_key" ON "MRRR"("vpScheduleId");

-- CreateIndex
CREATE INDEX "MRRR_vpScheduleId_idx" ON "MRRR"("vpScheduleId");

-- CreateIndex
CREATE INDEX "MRRR_status_idx" ON "MRRR"("status");

-- CreateIndex
CREATE INDEX "MRRR_deletedAt_idx" ON "MRRR"("deletedAt");

-- CreateIndex
CREATE INDEX "MRRR_createdById_idx" ON "MRRR"("createdById");

-- CreateIndex
CREATE INDEX "MRRRRow_mrRrId_idx" ON "MRRRRow"("mrRrId");

-- CreateIndex
CREATE INDEX "MRRRRow_wagonId_idx" ON "MRRRRow"("wagonId");

-- CreateIndex
CREATE INDEX "MRRRRow_vpScheduleWagonCountId_idx" ON "MRRRRow"("vpScheduleWagonCountId");

-- CreateIndex
CREATE INDEX "MRRRRow_mrRrNo_idx" ON "MRRRRow"("mrRrNo");

-- CreateIndex
CREATE INDEX "MRRRRow_vpNo_idx" ON "MRRRRow"("vpNo");

-- CreateIndex
CREATE INDEX "MRRRRow_sealNo_idx" ON "MRRRRow"("sealNo");

-- CreateIndex
CREATE UNIQUE INDEX "MRRRRow_mrRrId_rowNumber_key" ON "MRRRRow"("mrRrId", "rowNumber");

-- AddForeignKey
ALTER TABLE "MRRR" ADD CONSTRAINT "MRRR_vpScheduleId_fkey" FOREIGN KEY ("vpScheduleId") REFERENCES "VPSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRR" ADD CONSTRAINT "MRRR_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRR" ADD CONSTRAINT "MRRR_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRRRow" ADD CONSTRAINT "MRRRRow_mrRrId_fkey" FOREIGN KEY ("mrRrId") REFERENCES "MRRR"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRRRow" ADD CONSTRAINT "MRRRRow_vpScheduleWagonCountId_fkey" FOREIGN KEY ("vpScheduleWagonCountId") REFERENCES "VPScheduleWagonCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRRRow" ADD CONSTRAINT "MRRRRow_wagonId_fkey" FOREIGN KEY ("wagonId") REFERENCES "Wagon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
