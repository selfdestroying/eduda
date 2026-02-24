-- Migration: Extract Rate as a separate entity
-- 1. Create Rate table
-- 2. Populate Rate from unique (bid, bonusPerStudent, organizationId) combinations in TeacherGroup
-- 3. Add rateId FK to TeacherGroup and link existing rows
-- 4. Drop old columns from TeacherGroup and User

-- Step 1: Create Rate table
CREATE TABLE IF NOT EXISTS "Rate" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bid" INTEGER NOT NULL,
    "bonusPerStudent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER NOT NULL,
    CONSTRAINT "Rate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Rate_organizationId_idx" ON "Rate"("organizationId");

-- Step 2: Populate Rate from existing TeacherGroup combinations
INSERT INTO "Rate" ("name", "bid", "bonusPerStudent", "organizationId", "updatedAt")
SELECT DISTINCT
    CASE
        WHEN "bonusPerStudent" > 0 THEN "bid"::TEXT || ' ₽ + ' || "bonusPerStudent"::TEXT || ' ₽/уч.'
        ELSE "bid"::TEXT || ' ₽'
    END AS "name",
    "bid",
    "bonusPerStudent",
    "organizationId",
    CURRENT_TIMESTAMP
FROM "TeacherGroup"
ON CONFLICT DO NOTHING;

-- Step 3: Add rateId column to TeacherGroup (nullable first for migration)
ALTER TABLE "TeacherGroup" ADD COLUMN "rateId" INTEGER;

-- Step 4: Link existing TeacherGroup rows to their Rate
UPDATE "TeacherGroup" tg
SET "rateId" = r."id"
FROM "Rate" r
WHERE r."bid" = tg."bid"
  AND r."bonusPerStudent" = tg."bonusPerStudent"
  AND r."organizationId" = tg."organizationId";

-- Step 5: Make rateId NOT NULL and add FK
ALTER TABLE "TeacherGroup" ALTER COLUMN "rateId" SET NOT NULL;
ALTER TABLE "TeacherGroup" ADD CONSTRAINT "TeacherGroup_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TeacherGroup_rateId_idx" ON "TeacherGroup"("rateId");

-- Step 6: Drop old columns
ALTER TABLE "TeacherGroup" DROP COLUMN "bid";
ALTER TABLE "TeacherGroup" DROP COLUMN "bonusPerStudent";
ALTER TABLE "User" DROP COLUMN IF EXISTS "bidForLesson";
ALTER TABLE "User" DROP COLUMN IF EXISTS "bidForIndividual";
ALTER TABLE "User" DROP COLUMN IF EXISTS "bonusPerStudent";
