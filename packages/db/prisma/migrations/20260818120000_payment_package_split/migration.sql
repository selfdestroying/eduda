-- Разрез оплаты и пакета.
--
-- Была одна строка `Payment`, в которой лежали и деньги, и очередь уроков. Стало
-- две сущности: `Payment` — деньги, `Package` — уроки. Журнал и посещения считают
-- уроки, поэтому ссылаются на пакет.
--
-- Ключевой приём: исторический пакет получает id своей оплаты. Тогда 8 246 ссылок в
-- `Attendance` и 10 911 в `WalletEntry` переезжают переименованием колонки, а не
-- переписыванием значений, и сходимость журнала можно проверить прямо здесь.

-- ── Предусловия ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Payment" WHERE "walletId" IS NULL) THEN
        RAISE EXCEPTION 'есть оплаты без кошелька, а пакету кошелёк обязателен';
    END IF;
    IF EXISTS (SELECT 1 FROM "Payment" WHERE "remaining" IS NULL) THEN
        RAISE EXCEPTION 'есть неразмеченные оплаты (remaining IS NULL)';
    END IF;
END $$;

-- ── Типы ───────────────────────────────────────────────────────────────────
CREATE TYPE "PackageStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED');

-- Значение добавляется, но в этой миграции не используется: все исторические
-- оплаты подтверждены. В PostgreSQL 12+ такое разрешено внутри транзакции.
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING' BEFORE 'ACTIVE';

-- ── Пакет ──────────────────────────────────────────────────────────────────
CREATE TABLE "Package" (
    "id" SERIAL NOT NULL,
    "lessonCount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'PENDING',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "productId" INTEGER,
    "productName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Package_walletId_date_idx" ON "Package"("walletId", "date");
CREATE INDEX "Package_organizationId_date_idx" ON "Package"("organizationId", "date");
CREATE INDEX "Package_paymentId_idx" ON "Package"("paymentId");
CREATE INDEX "Package_productId_idx" ON "Package"("productId");
CREATE INDEX "Package_studentId_idx" ON "Package"("studentId");

ALTER TABLE "Package" ADD CONSTRAINT "Package_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Пакет на каждую оплату, с её же id. Все исторические — подтверждённые: деньги за
-- них получены, уроки списаны, прошлое не переписываем. Корректировки бэкфилла
-- (`isAdjustment`) остаются пакетами без счёта — оплатой они никогда и не были.
INSERT INTO "Package" (
    "id", "lessonCount", "remaining", "unitPrice", "date", "status", "cancelledAt",
    "createdAt", "updatedAt", "organizationId", "studentId", "walletId", "paymentId",
    "productId", "productName"
)
SELECT
    p."id",
    p."lessonCount",
    p."remaining",
    p."bidForLesson",
    p."date",
    CASE WHEN p."status" = 'CANCELLED' THEN 'CANCELLED'::"PackageStatus"
         ELSE 'ACTIVE'::"PackageStatus" END,
    p."cancelledAt",
    p."createdAt",
    p."updatedAt",
    p."organizationId",
    p."studentId",
    p."walletId",
    CASE WHEN p."isAdjustment" THEN NULL ELSE p."id" END,
    p."productId",
    p."productName"
FROM "Payment" p;

SELECT setval(
    pg_get_serial_sequence('"Package"', 'id'),
    (SELECT COALESCE(MAX("id"), 1) FROM "Package")
);

-- ── Ссылки: посещения и журнал считают уроки, значит указывают на пакет ─────
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_paymentId_fkey";
ALTER TABLE "Attendance" RENAME COLUMN "paymentId" TO "packageId";
ALTER INDEX "Attendance_paymentId_idx" RENAME TO "Attendance_packageId_idx";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WalletEntry" DROP CONSTRAINT "WalletEntry_paymentId_fkey";
ALTER TABLE "WalletEntry" RENAME COLUMN "paymentId" TO "packageId";
ALTER INDEX "WalletEntry_paymentId_idx" RENAME TO "WalletEntry_packageId_idx";
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Оплата остаётся деньгами ───────────────────────────────────────────────
-- Корректировки бэкфилла деньгами не были: строки удаляются, их пакеты уже созданы
-- и на ссылки не влияют — те смотрят на `Package`, а не на `Payment`.
DELETE FROM "Payment" WHERE "isAdjustment";

ALTER TABLE "Payment"
    DROP COLUMN "lessonCount",
    DROP COLUMN "remaining",
    DROP COLUMN "bidForLesson",
    DROP COLUMN "walletId",
    DROP COLUMN "groupId",
    DROP COLUMN "productId",
    DROP COLUMN "productName",
    DROP COLUMN "isAdjustment";

-- ── Постусловия ────────────────────────────────────────────────────────────
DO $$
DECLARE
    packages INT;
    payments INT;
    gifts INT;
    drifted INT;
BEGIN
    SELECT count(*) INTO packages FROM "Package";
    SELECT count(*) INTO payments FROM "Payment";
    SELECT count(*) INTO gifts FROM "Package" WHERE "paymentId" IS NULL;

    IF packages <> payments + gifts THEN
        RAISE EXCEPTION 'пакетов %, оплат %, без счёта % — не сходится',
            packages, payments, gifts;
    END IF;

    -- Главный инвариант журнала, перенесённый с оплаты на пакет. До миграции он
    -- выполнялся на всех строках, значит обязан выполняться и после: если id
    -- разъехались, разойдётся и он.
    SELECT count(*) INTO drifted
    FROM "Package" pk
    LEFT JOIN (
        SELECT "packageId", SUM("quantity") AS q FROM "WalletEntry" GROUP BY "packageId"
    ) j ON j."packageId" = pk."id"
    WHERE COALESCE(j.q, 0) <> pk."remaining";

    IF drifted > 0 THEN
        RAISE EXCEPTION 'у % пакетов остаток разошёлся с журналом', drifted;
    END IF;
END $$;
