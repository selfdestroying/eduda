-- Add the new id-based key first so we can backfill existing snoozes.
ALTER TABLE "SnoozedAlert" ADD COLUMN "entityId" INTEGER;

-- Convert keys like "wallet:12" or "student:7:group:3" into
-- entityKey = "wallet" / "student" and entityId = 12 / 7.
UPDATE "SnoozedAlert"
SET
  "entityId" = NULLIF(split_part("entityKey", ':', 2), '')::INTEGER,
  "entityKey" = split_part("entityKey", ':', 1);

-- Collapse duplicates that only differed by the legacy alert type.
DELETE FROM "SnoozedAlert" a
USING "SnoozedAlert" b
WHERE a.id < b.id
  AND a."organizationId" = b."organizationId"
  AND a."entityId" = b."entityId"
  AND a."entityKey" = b."entityKey";

ALTER TABLE "SnoozedAlert" ALTER COLUMN "entityId" SET NOT NULL;

DROP INDEX "SnoozedAlert_organizationId_alertType_entityKey_key";
ALTER TABLE "SnoozedAlert" DROP COLUMN "alertType";

CREATE UNIQUE INDEX "SnoozedAlert_organizationId_entityId_entityKey_key"
  ON "SnoozedAlert"("organizationId", "entityId", "entityKey");
