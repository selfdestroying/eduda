/*
  Warnings:

  - The columns `archiveComment`, `archivedAt` and `isArchived` on the `Group` table
    are being replaced by `status`, `statusChangedAt` and `statusComment`.
    Existing data is migrated:
      isArchived = true  -> status = 'ARCHIVED'
      isArchived = false -> status = 'ACTIVE'
      archivedAt         -> statusChangedAt
      archiveComment     -> statusComment

*/
-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPLETED');

-- AlterTable: add new columns first (status with default so NOT NULL is satisfied)
ALTER TABLE "Group"
    ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "statusChangedAt" DATE,
    ADD COLUMN "statusComment" TEXT;

-- Migrate existing data from old columns into the new ones
UPDATE "Group"
SET "status"          = 'ARCHIVED',
    "statusChangedAt" = "archivedAt",
    "statusComment"   = "archiveComment"
WHERE "isArchived" = true;

-- DropIndex
DROP INDEX "Group_isArchived_idx";

-- AlterTable: drop the old columns now that data has been migrated
ALTER TABLE "Group"
    DROP COLUMN "archiveComment",
    DROP COLUMN "archivedAt",
    DROP COLUMN "isArchived";
