-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'COMPLETED';

-- Step 1: add new columns as nullable so we can fill them before setting NOT NULL
ALTER TABLE "StudentGroup"
    ADD COLUMN "statusChangedAt" TIMESTAMP(3),
    ADD COLUMN "statusComment"   TEXT;

-- Step 2: migrate DISMISSED rows
--   dismissedAt (DATE) → statusChangedAt, fallback to createdAt if NULL
--   dismissComment     → statusComment
UPDATE "StudentGroup"
SET
    "statusChangedAt" = COALESCE("dismissedAt"::TIMESTAMP(3), "createdAt"),
    "statusComment"   = "dismissComment"
WHERE "status" = 'DISMISSED';

-- Step 3: migrate TRANSFERRED rows
--   transferredAt (DATE) → statusChangedAt, fallback to createdAt if NULL
--   transferComment      → statusComment
UPDATE "StudentGroup"
SET
    "statusChangedAt" = COALESCE("transferredAt"::TIMESTAMP(3), "createdAt"),
    "statusComment"   = "transferComment"
WHERE "status" = 'TRANSFERRED';

-- Step 4: fill ACTIVE / TRIAL rows with createdAt
UPDATE "StudentGroup"
SET "statusChangedAt" = "createdAt"
WHERE "statusChangedAt" IS NULL;

-- Step 5: enforce NOT NULL and set default for future inserts
ALTER TABLE "StudentGroup"
    ALTER COLUMN "statusChangedAt" SET NOT NULL,
    ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Step 6: drop old columns now that data has been migrated
ALTER TABLE "StudentGroup"
    DROP COLUMN "dismissComment",
    DROP COLUMN "dismissedAt",
    DROP COLUMN "transferComment",
    DROP COLUMN "transferredAt";
