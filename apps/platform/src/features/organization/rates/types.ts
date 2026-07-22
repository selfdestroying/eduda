import { Prisma } from '@repo/db'

export type RateWithCount = Prisma.RateGetPayload<{
  include: { _count: { select: { teacherGroups: true } } }
}>
