-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN     "metaCategory" TEXT,
ADD COLUMN     "metaFooter" TEXT,
ADD COLUMN     "metaLanguage" TEXT,
ADD COLUMN     "metaName" TEXT,
ADD COLUMN     "metaParamOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "metaRejectedReason" TEXT,
ADD COLUMN     "metaStatus" TEXT,
ADD COLUMN     "metaSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "metaSyncedAt" TIMESTAMP(3),
ADD COLUMN     "metaTemplateId" TEXT;
