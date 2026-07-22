import { Prisma } from '@repo/db'

export type OrderWithProductAndStudent = Prisma.OrderGetPayload<{
  include: { product: true; student: true }
}>
