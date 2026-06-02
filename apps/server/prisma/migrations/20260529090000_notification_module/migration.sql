-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationEventStatus" AS ENUM ('PENDING', 'FANOUT_COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "mobile" TEXT,
ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationQuietHoursStart" TEXT,
ADD COLUMN "notificationQuietHoursEnd" TEXT;

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
CREATE TABLE "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
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

  CONSTRAINT "UserNotificationSubscription_pkey" PRIMARY KEY ("userId", "eventType", "channel")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");
CREATE INDEX "NotificationEvent_eventType_idx" ON "NotificationEvent"("eventType");
CREATE INDEX "NotificationEvent_sourceModule_idx" ON "NotificationEvent"("sourceModule");
CREATE INDEX "NotificationEvent_aggregateType_aggregateId_idx" ON "NotificationEvent"("aggregateType", "aggregateId");
CREATE INDEX "NotificationEvent_branchId_idx" ON "NotificationEvent"("branchId");
CREATE INDEX "NotificationEvent_status_createdAt_idx" ON "NotificationEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_code_channel_key" ON "NotificationTemplate"("code", "channel");

-- CreateIndex
CREATE INDEX "NotificationRule_eventType_idx" ON "NotificationRule"("eventType");
CREATE INDEX "NotificationRule_enabled_idx" ON "NotificationRule"("enabled");
CREATE INDEX "NotificationRule_sourceModule_idx" ON "NotificationRule"("sourceModule");
CREATE INDEX "NotificationRule_branchId_idx" ON "NotificationRule"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_eventId_channel_recipientUserId_key" ON "NotificationDelivery"("eventId", "channel", "recipientUserId");
CREATE INDEX "NotificationDelivery_recipientUserId_status_idx" ON "NotificationDelivery"("recipientUserId", "status");
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_deliveryId_key" ON "InAppNotification"("deliveryId");
CREATE INDEX "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");
CREATE INDEX "InAppNotification_userId_archivedAt_idx" ON "InAppNotification"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "UserNotificationSubscription_eventType_channel_idx" ON "UserNotificationSubscription"("eventType", "channel");

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotificationSubscription" ADD CONSTRAINT "UserNotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
