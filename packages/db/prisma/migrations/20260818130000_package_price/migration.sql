-- Стоимость самого пакета.
--
-- Выводить её из `unitPrice × lessonCount` нельзя: цена урока округлена вниз, и на
-- пакете «1000 ₽ за 3 занятия» обратное умножение даёт 999. На этих рублях разъехались
-- бы суммы поступлений кошелька. Подарочный пакет стоит ноль — деньгами он и не был.

ALTER TABLE "Package" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;

UPDATE "Package" pk
SET "price" = p."price"
FROM "Payment" p
WHERE p."id" = pk."paymentId";

DO $$
DECLARE
    drifted INT;
BEGIN
    SELECT count(*) INTO drifted
    FROM "Package" pk
    JOIN "Payment" p ON p."id" = pk."paymentId"
    WHERE pk."price" <> p."price";

    IF drifted > 0 THEN
        RAISE EXCEPTION 'у % пакетов стоимость разошлась с оплатой', drifted;
    END IF;
END $$;
