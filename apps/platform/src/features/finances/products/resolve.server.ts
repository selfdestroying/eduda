import type { Prisma } from '@repo/db'
import { NotFoundError } from '@/src/lib/error'

/**
 * Продукт нового пакета: ссылка плюс снимок названия на момент продажи.
 *
 * Живёт отдельно от `payments/actions.ts` по той же причине, что и остальные
 * `*.server.ts` помощники: файл с `'use server'` может экспортировать только сами
 * экшены, а эту функцию должен уметь позвать скрипт проверки
 * (`scripts/check-package-product.ts`).
 *
 * Два инварианта, ради которых она существует:
 *   - название читается из базы, а не из запроса — клиент прислал бы любое;
 *   - продукт ищется в своей организации, иначе к пакету прицепилась бы строка
 *     чужого прайс-листа.
 *
 * Сумму и количество занятий отсюда не берём: форма подставляет их из продукта,
 * но разрешает поправить, и правка обязана доехать до базы.
 *
 * Снятый с продажи продукт принимается: в форме его не предложат, но разобрать
 * старую оплату задним числом — законно.
 */
export async function loadPackageProductTx(
  tx: Prisma.TransactionClient,
  productId: number,
  organizationId: number,
): Promise<{ id: number; name: string }> {
  const product = await tx.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true, name: true },
  })
  if (!product) throw new NotFoundError('Продукт не найден')

  return product
}
