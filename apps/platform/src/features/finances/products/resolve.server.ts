import type { Prisma } from '@repo/db'
import { NotFoundError } from '@/src/lib/error'

/**
 * Продукт новой оплаты: сумма, количество занятий и снимок названия на момент
 * продажи. Полей «сумма» и «количество занятий» в форме оплаты нет — цена приходит
 * отсюда и только отсюда, поэтому функция и возвращает всю строку прайса, а не
 * одно название.
 *
 * Живёт отдельно от `payments/actions.ts` по той же причине, что и остальные
 * `*.server.ts` помощники: файл с `'use server'` может экспортировать только сами
 * экшены, а эту функцию должен уметь позвать скрипт проверки
 * (`scripts/check-payment-product.ts`).
 *
 * Два инварианта, ради которых она существует:
 *   - цена и название читаются из базы, а не из запроса — клиент прислал бы любые;
 *   - продукт ищется в своей организации, иначе к оплате прицепилась бы строка
 *     чужого прайс-листа.
 *
 * Снятый с продажи продукт принимается: в форме его не предложат, но разобрать
 * старую оплату задним числом — законно.
 */
export async function loadPaymentProductTx(
  tx: Prisma.TransactionClient,
  productId: number,
  organizationId: number,
): Promise<{ id: number; name: string; price: number; lessonCount: number }> {
  const product = await tx.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true, name: true, price: true, lessonCount: true },
  })
  if (!product) throw new NotFoundError('Продукт не найден')

  return product
}
