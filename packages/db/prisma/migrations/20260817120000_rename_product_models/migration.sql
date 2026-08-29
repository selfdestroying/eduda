-- Переименование двух моделей за один заход.
--
-- 1) Магазинный `Product` (товар за астрокоины) → `ShopItem`.
-- 2) Финансовый `PaymentProduct` (прайс-лист абонементов) → `Product`.
-- 3) `PaymentProduct.productId` переименовывается в `externalId`. Это id товара
--    в amoCRM: по нему парсер оплат находит продукт школы. Ни один экшен его не
--    пишет — колонку заполняли руками, — и именно поэтому удалять её нельзя:
--    соответствие «товар CRM → продукт школы» больше нигде не записано.
--
-- Зачем: в языке школы родителю продают продукт, а ученик покупает товар. В
-- коде было наоборот, и справочник абонементов — тот, на котором держится вся
-- бонусная схема, — назывался приставкой к чужому имени.
--
-- Порядок обязателен: пока магазинная таблица зовётся `Product`, второе
-- переименование упирается в занятое имя — и таблицы, и первичного ключа, и
-- индекса по организации, и последовательности. Имена индексов и
-- последовательностей уникальны в пределах схемы, а не таблицы.
--
-- Всё через RENAME, а не DROP+CREATE (как сделала автогенерация в
-- 20260425231843_rename_table): в этих таблицах живая история заказов, и
-- пересоздание её сотрёт. Индексы и ограничения переименованы поимённо —
-- Prisma сверяет их имена буквально, расхождение станет вечным дрейфом схемы.

-- ── 1. Магазин: Product → ShopItem ──────────────────────────────────────────
ALTER TABLE "Product" RENAME TO "ShopItem";
ALTER TABLE "ShopItem" RENAME CONSTRAINT "Product_pkey" TO "ShopItem_pkey";
ALTER TABLE "ShopItem" RENAME CONSTRAINT "Product_organizationId_fkey" TO "ShopItem_organizationId_fkey";
ALTER TABLE "ShopItem" RENAME CONSTRAINT "Product_categoryId_fkey" TO "ShopItem_categoryId_fkey";
ALTER INDEX "Product_categoryId_idx" RENAME TO "ShopItem_categoryId_idx";
ALTER INDEX "Product_organizationId_idx" RENAME TO "ShopItem_organizationId_idx";
ALTER INDEX "Product_organizationId_archivedAt_idx" RENAME TO "ShopItem_organizationId_archivedAt_idx";
ALTER SEQUENCE "Product_id_seq" RENAME TO "ShopItem_id_seq";

ALTER TABLE "CartItem" RENAME COLUMN "productId" TO "shopItemId";
ALTER TABLE "CartItem" RENAME CONSTRAINT "CartItem_productId_fkey" TO "CartItem_shopItemId_fkey";
ALTER INDEX "CartItem_productId_idx" RENAME TO "CartItem_shopItemId_idx";
-- Составной уникальный создан как CREATE UNIQUE INDEX (0_init), а не ADD
-- CONSTRAINT, поэтому ALTER INDEX, а не RENAME CONSTRAINT.
ALTER INDEX "CartItem_cartId_productId_key" RENAME TO "CartItem_cartId_shopItemId_key";

ALTER TABLE "OrderItem" RENAME COLUMN "productId" TO "shopItemId";
ALTER TABLE "OrderItem" RENAME CONSTRAINT "OrderItem_productId_fkey" TO "OrderItem_shopItemId_fkey";
ALTER INDEX "OrderItem_productId_idx" RENAME TO "OrderItem_shopItemId_idx";

-- ── 2. Финансы: PaymentProduct → Product ────────────────────────────────────
ALTER TABLE "PaymentProduct" RENAME TO "Product";
ALTER TABLE "Product" RENAME CONSTRAINT "PaymentProduct_pkey" TO "Product_pkey";
ALTER TABLE "Product" RENAME CONSTRAINT "PaymentProduct_organizationId_fkey" TO "Product_organizationId_fkey";
ALTER INDEX "PaymentProduct_organizationId_idx" RENAME TO "Product_organizationId_idx";
-- Через временное имя: `Product_id_seq` на этот момент уже занято магазинной
-- последовательностью, переименованной выше.
ALTER SEQUENCE "PaymentProduct_id_seq" RENAME TO "PaymentProduct_id_seq_tmp";
ALTER SEQUENCE "PaymentProduct_id_seq_tmp" RENAME TO "Product_id_seq";

-- Имя было приставкой к чужому: `Product.productId` читается как «id продукта у
-- продукта». Это внешний ключ CRM, поэтому `externalId`.
ALTER TABLE "Product" RENAME COLUMN "productId" TO "externalId";
-- Один товар CRM — один продукт школы, иначе оплата не знает, какой из двух
-- выбрать. NULL уникальность не задевает, так что школы без интеграции живут
-- как жили.
CREATE UNIQUE INDEX "Product_organizationId_externalId_key" ON "Product"("organizationId", "externalId");

-- ── 3. Сверка: не забыли ли что-нибудь ──────────────────────────────────────
-- Каждый RENAME падает сам, если объекта нет, — опечатку он ловит. Не ловит он
-- пропуск: забытый индекс останется со старым именем и всплывёт дрейфом схемы
-- на следующем migrate dev. Поэтому проверяем не поимённо, а на отсутствие
-- следов старых имён.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND (c.relname LIKE 'PaymentProduct%' OR c.relname LIKE '%productId%'))
        THEN RAISE EXCEPTION 'остались объекты со старым именем: таблица, индекс или последовательность';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname LIKE 'PaymentProduct%' OR conname LIKE '%productId%')
        THEN RAISE EXCEPTION 'остались ограничения со старым именем';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND column_name = 'productId')
        THEN RAISE EXCEPTION 'колонка productId где-то осталась';
    END IF;

    IF to_regclass('public."ShopItem"') IS NULL OR to_regclass('public."Product"') IS NULL
        THEN RAISE EXCEPTION 'нет таблицы ShopItem или Product';
    END IF;
END $$;
