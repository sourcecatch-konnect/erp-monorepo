-- DropForeignKey
ALTER TABLE "DetentionRate" DROP CONSTRAINT "DetentionRate_agreementId_fkey";

-- AddForeignKey
ALTER TABLE "DetentionRate" ADD CONSTRAINT "DetentionRate_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
