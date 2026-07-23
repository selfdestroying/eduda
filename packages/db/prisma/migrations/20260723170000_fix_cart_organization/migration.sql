-- `createStudent` создавал корзину без `organizationId`, и она молча уезжала в
-- организацию из `@default(1)`. Пока корзину никто не читал с фильтром по школе,
-- это было незаметно; кабинет ученика фильтрует, и такая корзина не находится
-- никогда — ученик кладёт товары, а корзина остаётся пустой.
--
-- Чиним данные: организация корзины — это всегда организация её ученика.
UPDATE "Cart" c
SET "organizationId" = s."organizationId"
FROM "Student" s
WHERE s.id = c."studentId" AND c."organizationId" <> s."organizationId";

-- Позиции ссылаются на ту же школу, что и их корзина.
UPDATE "CartItem" ci
SET "organizationId" = c."organizationId"
FROM "Cart" c
WHERE c.id = ci."cartId" AND ci."organizationId" <> c."organizationId";

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM "Cart" c JOIN "Student" s ON s.id = c."studentId"
        WHERE c."organizationId" <> s."organizationId"
    ) THEN RAISE EXCEPTION 'остались корзины с чужой организацией'; END IF;
END $$;
