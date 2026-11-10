-- Claims C7: transporter recoveries deducted on the vendor payment slip (docs/CLAIMS_JIRA.md).

-- AlterEnum
ALTER TYPE "VendorPaymentSourceType" ADD VALUE 'CLAIM_RECOVERY';
