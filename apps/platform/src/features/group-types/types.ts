import { Prisma } from '@/prisma/generated/client'

export type GroupTypeWithRelations = Prisma.GroupTypeGetPayload<{
  include: {
    rate: true
    _count: { select: { groups: true } }
  }
}>
