import type { Prisma } from '@repo/db'
import { NotFoundError } from '@/src/lib/error'

/**
 * Продукт оплаты: ссылка плюс снимок названия на момент продажи.
 *
 * Живёт отдельно от `payments/actions.ts` по той же причине, что и остальные
 * `*.server.ts` помощники: файл с `'use server'` может экспортировать только сами
 * экшены, а эту функцию должен уметь позвать скрипт проверки
 * (`scripts/check-payment-product.ts`).
 *
 * Два инварианта, ради которых она существует:
 *   - название читается из базы, а не из запроса — клиент прислал бы любое;
 *   - продукт ищется в своей организации, иначе к оплате прицепилась бы строка
 *     чужого прайс-листа.
 *
 * Снятый с продажи продукт принимается: в форме его не предложат, но разобрать
 * старую оплату задним числом — законно.
 */
export async function resolveProductTx(
  tx: Prisma.TransactionClient,
  productId: number | null | undefined,
  organizationId: number,
): Promise<{ productId: number | null; productName?: string }> {
  if (productId == null) return { productId: null }

  const product = await tx.product.findFirst({
    where: { id: productId, organizationId },
    select: { name: true },
  })
  if (!product) throw new NotFoundError('Продукт не найден')

  return { productId, productName: product.name }
}
