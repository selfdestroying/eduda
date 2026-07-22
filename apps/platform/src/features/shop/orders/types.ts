import { Prisma } from '@/prisma/generated/client'

export type OrderWithProductAndStudent = Prisma.OrderGetPayload<{
  include: { product: true; student: true }
}>
