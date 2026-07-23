'use server'

import { studentAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'

/**
 * История заказов ученика.
 *
 * Намеренно `studentAction`, а не `shopAction`: коины за эти заказы уже списаны,
 * и выключение магазина школой не должно отбирать у ученика возможность увидеть,
 * за что именно. Покупать при выключенной фиче по-прежнему нельзя.
 */
export const getOrders = studentAction
  .metadata({ actionName: 'getOrders' })
  .action(async ({ ctx }) => {
    const orders = await prisma.order.findMany({
      where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            priceAtPurchase: true,
            product: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      // Сумма по снимку цены: товар мог подорожать после покупки.
      total: order.items.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0),
      items: order.items.map((i) => ({
        name: i.product.name,
        imageUrl: i.product.imageUrl,
        quantity: i.quantity,
        priceAtPurchase: i.priceAtPurchase,
      })),
    }))
  })
