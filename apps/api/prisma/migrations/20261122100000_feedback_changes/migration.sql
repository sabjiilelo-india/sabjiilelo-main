-- CreateEnum
CREATE TYPE "CoinTxnType" AS ENUM ('EARN', 'SPEND', 'REFUND');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'ARRIVED';

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coinBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "nutrition" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "codFeePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coinDiscountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coinsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coinsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CoinTxn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "CoinTxnType" NOT NULL,
    "coins" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinTxn_userId_createdAt_idx" ON "CoinTxn"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoinTxn" ADD CONSTRAINT "CoinTxn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTxn" ADD CONSTRAINT "CoinTxn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

