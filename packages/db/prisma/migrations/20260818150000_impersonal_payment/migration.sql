-- Счёт становится обезличенным.
--
-- Ученик и продавец относятся к продаже, а продажа — это пакет. Один счёт может
-- закрыть пакеты разных учеников, и тогда `Payment.studentId` был бы прямой ложью;
-- продавец же нужен премиям, которые считаются за проданный продукт, то есть за
-- пакет. «Чей платёж» теперь выводится через `packages`.
--
-- Связь пока один-к-одному, поэтому продавец переезжает одним UPDATE.

ALTER TABLE "Package" ADD COLUMN "managerId" INTEGER;

UPDATE "Package" pk
SET "managerId" = p."managerId"
FROM "Payment" p
WHERE p."id" = pk."paymentId";

CREATE INDEX "Package_managerId_idx" ON "Package"("managerId");

ALTER TABLE "Package" ADD CONSTRAINT "Package_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Продавец обязан был доехать до каждого пакета, у чьего счёта он был проставлен.
DO $$
DECLARE
    lost INT;
BEGIN
    SELECT count(*) INTO lost
    FROM "Package" pk
    JOIN "Payment" p ON p."id" = pk."paymentId"
    WHERE p."managerId" IS NOT NULL AND pk."managerId" IS DISTINCT FROM p."managerId";

    IF lost > 0 THEN
        RAISE EXCEPTION 'у % пакетов продавец не перенёсся со счёта', lost;
    END IF;
END $$;

-- `leadName` уходит вместе с ними: свободная строка с именем, которую никто не
-- читал и не заполнял, — на обезличенном счёте ей тем более не место.
ALTER TABLE "Payment"
    DROP COLUMN "studentId",
    DROP COLUMN "managerId",
    DROP COLUMN "leadName";
