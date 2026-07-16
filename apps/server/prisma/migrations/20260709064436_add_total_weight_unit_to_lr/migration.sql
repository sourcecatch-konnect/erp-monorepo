-- AlterTable
ALTER TABLE "LRGoods" ALTER COLUMN "unit" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LorryReceipt" ADD COLUMN     "totalWeight" DECIMAL(65,30),
ADD COLUMN     "unit" TEXT;
