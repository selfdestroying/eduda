-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE';
