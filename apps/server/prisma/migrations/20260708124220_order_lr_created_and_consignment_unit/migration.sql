-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'LRCreated';

-- AlterTable
ALTER TABLE "OrderConsignment" ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "OrderConsignmentGoods" ALTER COLUMN "unit" DROP NOT NULL;
