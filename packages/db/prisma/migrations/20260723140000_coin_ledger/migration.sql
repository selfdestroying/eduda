-- CreateEnum
CREATE TYPE "CoinTxReason" AS ENUM ('ATTENDANCE_PRESENT', 'ATTENDANCE_REVERTED', 'MANUAL_GRANT', 'MANUAL_DEDUCT', 'ORDER_PURCHASE', 'ORDER_CANCELLED', 'INITIAL_BALANCE');

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CoinTxReason" NOT NULL,
    "orderId" INTEGER,
    "attendanceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinTransaction_studentId_createdAt_idx" ON "CoinTransaction"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_organizationId_idx" ON "CoinTransaction"("organizationId");

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ретрофита истории нет: откуда взялись накопленные коины, БД не знает. Одна
-- строка INITIAL_BALANCE на текущий остаток — ровно столько, сколько нужно,
-- чтобы инвариант «сумма леджера = StudentAccount.coins» держался с самого начала.
-- Нулевые остатки строки не получают: пустая сумма и так равна нулю, а «Начальный
-- баланс 0» в истории ученика — мусор.
INSERT INTO "CoinTransaction" ("organizationId", "studentId", "amount", "reason")
SELECT "organizationId", "studentId", coins, 'INITIAL_BALANCE'
FROM "StudentAccount"
WHERE coins <> 0;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM "StudentAccount" a
        LEFT JOIN (SELECT "studentId", sum(amount) s FROM "CoinTransaction" GROUP BY "studentId") t
          ON t."studentId" = a."studentId"
        WHERE coalesce(t.s, 0) <> a.coins
    ) THEN RAISE EXCEPTION 'после backfill баланс разошёлся с леджером'; END IF;
END $$;
