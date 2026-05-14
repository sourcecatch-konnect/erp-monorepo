/*
  Warnings:

  - You are about to drop the column `weightUnit` on the `Goods` table. All the data in the column will be lost.
  - Added the required column `category` to the `Goods` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storagePosition` to the `Goods` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageLayer` to the `Goods` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GoodsCategory" AS ENUM ('Heavy', 'Light');

-- CreateEnum
CREATE TYPE "GoodsStoragePosition" AS ENUM ('Any', 'Horizontal', 'Vertical');

-- CreateEnum
CREATE TYPE "GoodsStorageLayer" AS ENUM ('Both', 'Bottom', 'Upper');

-- AlterTable
ALTER TABLE "Goods" DROP COLUMN "weightUnit",
DROP COLUMN "category",
ADD COLUMN     "category" "GoodsCategory" NOT NULL,
DROP COLUMN "storagePosition",
ADD COLUMN     "storagePosition" "GoodsStoragePosition" NOT NULL,
DROP COLUMN "storageLayer",
ADD COLUMN     "storageLayer" "GoodsStorageLayer" NOT NULL;
