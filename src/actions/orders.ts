'use server'

import prisma from '@/src/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'
import { OrderStatus } from '../../prisma/generated/enums'

export type OrderWithProductAndStudent = Prisma.OrderGetPayload<{
  include: { product: true; student: true }
}>

export const getOrders = async <T extends Prisma.OrderFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.OrderFindManyArgs>,
) => {
  return await prisma.order.findMany(payload)
}

export const changeOrderStatus = async (
  order: OrderWithProductAndStudent,
  newStatus: OrderStatus,
) => {
  await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } })
  if ((order.status == 'PENDING' || order.status == 'COMPLETED') && newStatus == 'CANCELLED') {
    await prisma.student.update({
      where: { id: order.studentId },
      data: { coins: { increment: order.product.price } },
    })
  } else if (order.status == 'CANCELLED' && (newStatus == 'COMPLETED' || newStatus == 'PENDING')) {
    await prisma.student.update({
      where: { id: order.studentId },
      data: { coins: { decrement: order.product.price } },
    })
  }

  revalidatePath('dashboard/orders')
}
