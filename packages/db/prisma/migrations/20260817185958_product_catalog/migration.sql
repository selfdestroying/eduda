-- Прайс-лист становится живой сущностью: у продукта появляются описание, признак
-- «в продаже» и временные метки, а оплата получает необязательную ссылку на строку
-- прайса. `Payment.productName` остаётся на месте — это снимок названия на момент
-- продажи, и он обязан переживать переименование и удаление продукта.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "productId" INTEGER;

-- AlterTable
-- `updatedAt` объявлен NOT NULL без дефолта в схеме (его пишет Prisma), но в таблице
-- уже есть строки — сначала заполняем их текущим временем, потом дефолт снимаем,
-- чтобы состояние базы совпало со схемой и следующая миграция не увидела дрейф.
ALTER TABLE "Product" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Product" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Payment_productId_idx" ON "Payment"("productId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
