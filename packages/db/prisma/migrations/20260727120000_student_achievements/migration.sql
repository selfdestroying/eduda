-- Достижения ученика.
--
-- Хранится ТОЛЬКО факт получения. Прогресс (посещения, покупки, потраченные
-- коины, день рождения) считается на чтение из существующих таблиц, поэтому
-- накопительных счётчиков здесь нет — их пришлось бы чинить каждый раз, когда
-- учитель правит посещаемость задним числом.
--
-- Каталог достижений живёт в коде (`apps/shop/src/features/achievements/registry.ts`),
-- а не в БД: добавить достижение — дописать строчку, без миграции.

-- AlterEnum
ALTER TYPE "CoinTxReason" ADD VALUE 'ACHIEVEMENT_CLAIM';

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Вся защита от повторного получения, включая гонку двух вкладок: claim делает
-- INSERT и ловит нарушение уникальности как «уже забрал».
CREATE UNIQUE INDEX "StudentAchievement_studentId_key_key" ON "StudentAchievement"("studentId", "key");

-- CreateIndex
CREATE INDEX "StudentAchievement_organizationId_idx" ON "StudentAchievement"("organizationId");

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
