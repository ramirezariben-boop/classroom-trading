/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `qty` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `deltaPts` on the `Tx` table. All the data in the column will be lost.
  - You are about to drop the column `codeHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `day` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Candle` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `quantity` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Made the column `fromId` on table `Transfer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `toId` on table `Transfer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `deltaPoints` to the `Tx` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Transfer" DROP CONSTRAINT "Transfer_fromId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transfer" DROP CONSTRAINT "Transfer_toId_fkey";

-- DropIndex
DROP INDEX "public"."Transfer_fromId_ts_idx";

-- DropIndex
DROP INDEX "public"."Transfer_toId_ts_idx";

-- DropIndex
DROP INDEX "public"."Transfer_ts_idx";

-- DropIndex
DROP INDEX "public"."Tx_ts_idx";

-- DropIndex
DROP INDEX "public"."Tx_userId_ts_idx";

-- DropIndex
DROP INDEX "public"."User_day_idx";

-- AlterTable
ALTER TABLE "Position" DROP COLUMN "createdAt",
DROP COLUMN "qty",
DROP COLUMN "updatedAt",
ADD COLUMN     "quantity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Transfer" ALTER COLUMN "fromId" SET NOT NULL,
ALTER COLUMN "toId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tx" DROP COLUMN "deltaPts",
ADD COLUMN     "deltaPoints" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "codeHash",
DROP COLUMN "day",
DROP COLUMN "username",
ALTER COLUMN "points" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."Candle";

-- CreateTable
CREATE TABLE "Value" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,

    CONSTRAINT "Value_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
