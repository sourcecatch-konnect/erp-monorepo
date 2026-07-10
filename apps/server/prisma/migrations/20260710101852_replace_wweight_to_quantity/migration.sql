/*
  Warnings:

  - You are about to drop the column `weight` on the `OrderItem` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "weight",
ADD COLUMN     "quantity" INTEGER NOT NULL;
