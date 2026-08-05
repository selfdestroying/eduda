-- AlterTable: add parent access token (nullable first to allow backfill)
ALTER TABLE "Parent" ADD COLUMN "accessToken" UUID;

-- Backfill existing rows with random UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "Parent" SET "accessToken" = gen_random_uuid() WHERE "accessToken" IS NULL;

-- Enforce NOT NULL + UNIQUE
ALTER TABLE "Parent" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Parent_accessToken_key" ON "Parent"("accessToken");
