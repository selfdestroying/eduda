import { Prisma } from '@/prisma/generated/client'

export type ParentWithStudents = Prisma.ParentGetPayload<{
  include: { students: { include: { student: true } } }
}>
