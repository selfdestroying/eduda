-- AlterTable
ALTER TABLE "OrganizationMaxBot" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT;
