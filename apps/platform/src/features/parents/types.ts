import { Prisma } from '@repo/db'

export type ParentWithStudents = Prisma.ParentGetPayload<{
  include: { students: { include: { student: true } } }
}>
