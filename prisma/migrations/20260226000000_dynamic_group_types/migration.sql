-- Step 1: Save existing type data into a temp table before dropping the column
CREATE TEMP TABLE "_group_type_backup" AS
SELECT "id", "organizationId", "type"::text AS "type"
FROM "Group"
WHERE "type" IS NOT NULL;

-- Step 2: Drop the old enum column and enum type to free the name "GroupType"
ALTER TABLE "Group" DROP COLUMN "type";
DROP TYPE "GroupType";

-- Step 3: Create the new GroupType model table
CREATE TABLE "GroupType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "rateId" INTEGER NOT NULL,

    CONSTRAINT "GroupType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupType_organizationId_idx" ON "GroupType"("organizationId");
CREATE INDEX "GroupType_rateId_idx" ON "GroupType"("rateId");

-- Step 4: Add groupTypeId column to Group
ALTER TABLE "Group" ADD COLUMN "groupTypeId" INTEGER;
CREATE INDEX "Group_groupTypeId_idx" ON "Group"("groupTypeId");

-- Step 5: Data migration — create GroupType records from backed-up enum values
INSERT INTO "GroupType" ("name", "organizationId", "rateId", "updatedAt")
SELECT
    CASE b."type"
        WHEN 'GROUP' THEN 'Группа'
        WHEN 'INDIVIDUAL' THEN 'Индив.'
        WHEN 'INTENSIVE' THEN 'Интенсив'
        WHEN 'SPLIT' THEN 'Сплит'
    END AS "name",
    b."organizationId",
    COALESCE(
        (SELECT tg."rateId"
         FROM "TeacherGroup" tg
         JOIN "Group" g2 ON g2."id" = tg."groupId"
         JOIN "_group_type_backup" b2 ON b2."id" = g2."id"
         WHERE b2."organizationId" = b."organizationId" AND b2."type" = b."type"
         GROUP BY tg."rateId"
         ORDER BY COUNT(*) DESC
         LIMIT 1),
        (SELECT r."id" FROM "Rate" r WHERE r."organizationId" = b."organizationId" ORDER BY r."id" LIMIT 1)
    ) AS "rateId",
    NOW() AS "updatedAt"
FROM "_group_type_backup" b
GROUP BY b."organizationId", b."type"
HAVING COALESCE(
    (SELECT tg."rateId"
     FROM "TeacherGroup" tg
     JOIN "Group" g2 ON g2."id" = tg."groupId"
     JOIN "_group_type_backup" b2 ON b2."id" = g2."id"
     WHERE b2."organizationId" = b."organizationId" AND b2."type" = b."type"
     GROUP BY tg."rateId"
     ORDER BY COUNT(*) DESC
     LIMIT 1),
    (SELECT r."id" FROM "Rate" r WHERE r."organizationId" = b."organizationId" ORDER BY r."id" LIMIT 1)
) IS NOT NULL;

-- Step 6: Link groups to new GroupType records
UPDATE "Group" g
SET "groupTypeId" = gt."id"
FROM "_group_type_backup" b
JOIN "GroupType" gt ON gt."organizationId" = b."organizationId"
    AND gt."name" = CASE b."type"
        WHEN 'GROUP' THEN 'Группа'
        WHEN 'INDIVIDUAL' THEN 'Индив.'
        WHEN 'INTENSIVE' THEN 'Интенсив'
        WHEN 'SPLIT' THEN 'Сплит'
    END
WHERE b."id" = g."id";

-- Step 7: Clean up temp table
DROP TABLE "_group_type_backup";

-- Step 8: Add foreign keys
ALTER TABLE "Group" ADD CONSTRAINT "Group_groupTypeId_fkey" FOREIGN KEY ("groupTypeId") REFERENCES "GroupType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroupType" ADD CONSTRAINT "GroupType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupType" ADD CONSTRAINT "GroupType_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
