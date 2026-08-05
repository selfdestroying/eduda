import { Prisma } from '@repo/db'

export type GroupTypeWithRelations = Prisma.GroupTypeGetPayload<{
  include: {
    rate: true
    _count: { select: { groups: true } }
  }
}>
