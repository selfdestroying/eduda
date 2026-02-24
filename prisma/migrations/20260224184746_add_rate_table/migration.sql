/*
  Warnings:

  - You are about to drop the column `bid` on the `TeacherGroup` table. All the data in the column will be lost.
  - You are about to drop the column `bonusPerStudent` on the `TeacherGroup` table. All the data in the column will be lost.
  - You are about to drop the column `bidForIndividual` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `bidForLesson` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `bonusPerStudent` on the `User` table. All the data in the column will be lost.
  - Added the required column `rateId` to the `TeacherGroup` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "Rate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "bid" INTEGER NOT NULL,
    "bonusPerStudent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- -- Step 2: Populate Rate from existing TeacherGroup combinations
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
