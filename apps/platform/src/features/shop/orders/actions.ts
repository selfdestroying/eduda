'use server'

import { prisma } from '@repo/db'
import { CoinTxReason } from '@repo/db/enums'

import { recordCoins } from '@/src/lib/coins'
import { ConflictError } from '@/src/lib/error'
import { featureAction } from '@/src/lib/safe-action'
import { ChangeOrderStatusSchema } from './schemas'

export const getOrders = featureAction('shop')
  .metadata({ actionName: 'getOrders' })
  .action(async ({ ctx }) => {
    return await prisma.order.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

export const changeOrderStatus = featureAction('shop')
  .metadata({ actionName: 'changeOrderStatus' })
  .inputSchema(ChangeOrderStatusSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, newStatus } = parsedInput
    const organizationId = ctx.session.organizationId!

    // Возврат коинов, возврат остатка и смена статуса — одной транзакцией:
    // строка леджера обязана появиться вместе с изменением баланса.
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id, organizationId },
        include: { items: true },
      })

      await tx.order.update({
        where: { id, organizationId },
        data: { status: newStatus },
      })

      const wasCharged = order.status === 'PENDING' || order.status === 'COMPLETED'
      const isCharged = newStatus === 'PENDING' || newStatus === 'COMPLETED'
      if (wasCharged === isCharged) return

      // Сумма считается по снимку цены в позициях, а не по текущей цене товара:
      // вернуть надо ровно столько, сколько было списано.
      const total = order.items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0)
      // Отмена возвращает коины и остаток, возврат из отмены — списывает обратно.
      const sign = isCharged ? -1 : 1

      for (const item of order.items) {
        if (sign > 0) {
          // Отмена: остаток просто возвращается.
          await tx.product.update({
            where: { id: item.productId, organizationId },
            data: { quantity: { increment: item.quantity } },
          })
          continue
        }
        // Возврат заказа из отмены снова забирает остаток — условным апдейтом,
        // иначе за время отмены школа могла распродать товар и остаток ушёл бы
        // в минус.
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, organizationId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        })
        if (count !== 1) {
          throw new ConflictError('Товара из заказа больше нет в наличии — вернуть заказ нельзя')
        }
      }

      const { count } = await tx.studentAccount.updateMany({
        where: {
          studentId: order.studentId,
          organizationId,
          // Возврат заказа из отмены снова списывает коины — условно, иначе
          // потраченный возврат увёл бы баланс в минус.
          ...(isCharged ? { coins: { gte: total } } : {}),
        },
        data: { coins: { increment: sign * total } },
      })
      // Ноль строк — либо не хватило коинов, либо у ученика нет аккаунта. И то и
      // другое означает, что остаток уже сдвинут, а списания нет: откатываем всё,
      // чтобы склад не разъехался с леджером.
      if (count === 0) {
        throw new ConflictError(
          isCharged
            ? 'У ученика не хватает коинов, чтобы вернуть заказ в работу'
            : 'Не удалось вернуть коины: у ученика нет учётной записи',
        )
      }

      await recordCoins(tx, {
        organizationId,
        studentId: order.studentId,
        amount: sign * total,
        reason: isCharged ? CoinTxReason.ORDER_PURCHASE : CoinTxReason.ORDER_CANCELLED,
        orderId: order.id,
      })
    })
  })
