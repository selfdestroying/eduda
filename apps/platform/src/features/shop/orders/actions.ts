'use server'

import { prisma } from '@repo/db'
import { CoinTxReason } from '@repo/db/enums'

import { recordCoins } from '@/src/lib/coins'
import { featureAction } from '@/src/lib/safe-action'
import { ChangeOrderStatusSchema } from './schemas'

export const getOrders = featureAction('shop')
  .metadata({ actionName: 'getOrders' })
  .action(async ({ ctx }) => {
    return await prisma.order.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      include: { product: true, student: true },
      orderBy: { createdAt: 'desc' },
    })
  })

export const changeOrderStatus = featureAction('shop')
  .metadata({ actionName: 'changeOrderStatus' })
  .inputSchema(ChangeOrderStatusSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, newStatus } = parsedInput
    const organizationId = ctx.session.organizationId!

    // Возврат коинов и смена статуса — одной транзакцией: строка леджера обязана
    // появиться вместе с изменением баланса.
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id, organizationId },
        include: { product: true },
      })

      await tx.order.update({
        where: { id, organizationId },
        data: { status: newStatus },
      })

      const wasCharged = order.status === 'PENDING' || order.status === 'COMPLETED'
      const isCharged = newStatus === 'PENDING' || newStatus === 'COMPLETED'
      if (wasCharged === isCharged) return

      // Отмена возвращает коины, возврат из отмены — списывает их обратно.
      // Считаем по количеству: до этого возврат игнорировал `quantity` и за
      // заказ из трёх штук отдавал цену одной.
      const total = order.product.price * order.quantity
      const amount = isCharged ? -total : total

      const { count } = await tx.studentAccount.updateMany({
        where: { studentId: order.studentId, organizationId },
        data: { coins: { increment: amount } },
      })
      if (count === 0) return

      await recordCoins(tx, {
        organizationId,
        studentId: order.studentId,
        amount,
        reason: isCharged ? CoinTxReason.ORDER_PURCHASE : CoinTxReason.ORDER_CANCELLED,
        orderId: order.id,
      })
    })
  })
