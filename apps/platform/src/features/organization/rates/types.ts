import { Prisma } from '@/prisma/generated/client'

export type RateWithCount = Prisma.RateGetPayload<{
  include: { _count: { select: { teacherGroups: true } } }
}>
