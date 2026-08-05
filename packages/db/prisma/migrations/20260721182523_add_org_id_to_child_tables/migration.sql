-- Добавляем organizationId в дочерние таблицы для единой RLS-политики.
-- Порядок: nullable-колонка → backfill из родителя → SET NOT NULL.

-- AlterTable: nullable
ALTER TABLE "AssistantMessage" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "StudentAccount" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "StudentParent" ADD COLUMN "organizationId" INTEGER;

-- Backfill из родителя
UPDATE "AssistantMessage" m
SET "organizationId" = t."organizationId"
FROM "AssistantThread" t
WHERE m."threadId" = t."id";

UPDATE "StudentAccount" sa
SET "organizationId" = s."organizationId"
FROM "Student" s
WHERE sa."studentId" = s."id";

UPDATE "StudentParent" sp
SET "organizationId" = s."organizationId"
FROM "Student" s
WHERE sp."studentId" = s."id";

-- SET NOT NULL
ALTER TABLE "AssistantMessage" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StudentAccount" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StudentParent" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AssistantMessage_organizationId_idx" ON "AssistantMessage"("organizationId");
CREATE INDEX "StudentAccount_organizationId_idx" ON "StudentAccount"("organizationId");
CREATE INDEX "StudentParent_organizationId_idx" ON "StudentParent"("organizationId");

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentParent" ADD CONSTRAINT "StudentParent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
