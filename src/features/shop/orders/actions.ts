'use server'

import prisma from '@/src/lib/db/prisma'

import { ChangeOrderStatusSchema } from './schemas'
import { featureAction } from '@/src/lib/safe-action'

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

    const order = await prisma.order.findUniqueOrThrow({
      where: { id, organizationId: ctx.session.organizationId! },
      include: { product: true },
    })

    await prisma.order.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data: { status: newStatus },
    })

    if ((order.status === 'PENDING' || order.status === 'COMPLETED') && newStatus === 'CANCELLED') {
      await prisma.studentAccount.update({
        where: { studentId: order.studentId },
        data: { coins: { increment: order.product.price } },
      })
    } else if (
      order.status === 'CANCELLED' &&
      (newStatus === 'COMPLETED' || newStatus === 'PENDING')
    ) {
      await prisma.studentAccount.update({
        where: { studentId: order.studentId },
        data: { coins: { decrement: order.product.price } },
      })
    }
  })
